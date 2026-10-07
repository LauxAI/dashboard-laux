import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import type { DueRun, EngineStore, RunStepRecord } from "./engine"
import { logAutomation } from "./log"
import { rowsToSteps, type StepRow } from "./serialize"
import type { AutomationCategory, AutomationStatus, EventValue, StoredAutomation } from "./types"

type AutomationRow = {
  id: string
  company_id: string
  name: string
  description: string | null
  status: AutomationStatus
  category: AutomationCategory | null
  trigger_type: string | null
}

type StepRowWithAutomation = StepRow & { automation_id: string }

const AUTOMATION_COLUMNS = "id, company_id, name, description, status, category, trigger_type"
const UNIQUE_VIOLATION = "23505"

function sanitizeContext(context: Record<string, EventValue>): Record<string, EventValue> {
  const clean: Record<string, EventValue> = {}
  for (const [key, value] of Object.entries(context)) {
    if (value === null || typeof value === "boolean" || typeof value === "number") clean[key] = value
    else if (typeof value === "string") clean[key] = value.slice(0, 500)
  }
  return clean
}

function toStored(row: AutomationRow, stepRows: StepRow[]): StoredAutomation | null {
  const steps = rowsToSteps(stepRows)
  if (!steps) {
    logAutomation("warn", "automation_steps_invalid", { automationId: row.id })
    return null
  }
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
    status: row.status,
    category: row.category,
    triggerType: row.trigger_type,
    steps,
  }
}

export function createEngineStore(db: SupabaseClient = createAdminClient()): EngineStore {
  return {
    async listActiveAutomations(companyId, triggerType) {
      const { data, error } = await db
        .from("automations")
        .select(AUTOMATION_COLUMNS)
        .eq("company_id", companyId)
        .eq("status", "active")
        .eq("trigger_type", triggerType)
        .returns<AutomationRow[]>()
      if (error) throw new Error("automations_lookup_failed")
      const rows = data ?? []
      if (rows.length === 0) return []

      const steps = await db
        .from("automation_steps")
        .select("automation_id, step_order, step_type, config")
        .eq("company_id", companyId)
        .in("automation_id", rows.map((row) => row.id))
        .returns<StepRowWithAutomation[]>()
      if (steps.error) throw new Error("automation_steps_lookup_failed")

      const byAutomation = new Map<string, StepRow[]>()
      for (const step of steps.data ?? []) {
        byAutomation.set(step.automation_id, [...(byAutomation.get(step.automation_id) ?? []), step])
      }
      return rows.flatMap((row) => {
        const stored = toStored(row, byAutomation.get(row.id) ?? [])
        return stored ? [stored] : []
      })
    },

    async loadAutomation(companyId, automationId) {
      const { data, error } = await db
        .from("automations")
        .select(AUTOMATION_COLUMNS)
        .eq("id", automationId)
        .eq("company_id", companyId)
        .maybeSingle<AutomationRow>()
      if (error) throw new Error("automation_lookup_failed")
      if (!data) return null
      const steps = await db
        .from("automation_steps")
        .select("step_order, step_type, config")
        .eq("automation_id", automationId)
        .eq("company_id", companyId)
        .returns<StepRow[]>()
      if (steps.error) throw new Error("automation_steps_lookup_failed")
      return toStored(data, steps.data ?? [])
    },

    async claimRun(input) {
      const { data, error } = await db
        .from("automation_runs")
        .insert({
          automation_id: input.automationId,
          company_id: input.companyId,
          trigger_event_id: input.eventId.slice(0, 200),
          trigger_type: input.triggerType,
          context: sanitizeContext(input.context),
        })
        .select("id")
        .single<{ id: string }>()
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return null
        throw new Error("run_claim_failed")
      }
      return data
    },

    async recordStep(runId: string, companyId: string, step: RunStepRecord) {
      const { error } = await db.from("automation_run_steps").upsert(
        {
          run_id: runId,
          company_id: companyId,
          step_order: step.order,
          step_type: step.type,
          status: step.status,
          label: step.label.slice(0, 200),
          error_code: step.errorCode?.slice(0, 80) ?? null,
          error_message: step.errorMessage?.slice(0, 300) ?? null,
        },
        { onConflict: "run_id,step_order" },
      )
      if (error) throw new Error("run_step_failed")
    },

    async waitRun(runId, nextStepOrder, resumeAt) {
      const { error } = await db
        .from("automation_runs")
        .update({ status: "waiting", next_step_order: nextStepOrder, resume_at: resumeAt.toISOString() })
        .eq("id", runId)
        .eq("status", "running")
      if (error) throw new Error("run_wait_failed")
    },

    async finishRun(runId, status, errorCode, errorMessage) {
      const { error } = await db.rpc("finish_automation_run", {
        p_run_id: runId,
        p_status: status,
        p_error_code: errorCode ?? null,
        p_error_message: errorMessage ?? null,
      })
      if (error) throw new Error("run_finish_failed")
    },

    async listDueRuns(now, limit) {
      const { data, error } = await db
        .from("automation_runs")
        .select("id, automation_id, company_id, next_step_order, context")
        .eq("status", "waiting")
        .lte("resume_at", now.toISOString())
        .order("resume_at", { ascending: true })
        .limit(limit)
        .returns<{ id: string; automation_id: string; company_id: string; next_step_order: number; context: Record<string, EventValue> }[]>()
      if (error) throw new Error("due_runs_lookup_failed")
      return (data ?? []).map(
        (row): DueRun => ({
          id: row.id,
          automationId: row.automation_id,
          companyId: row.company_id,
          nextStepOrder: row.next_step_order,
          context: row.context ?? {},
        }),
      )
    },

    async claimDueRun(runId, now) {
      const { data, error } = await db
        .from("automation_runs")
        .update({ status: "running", resume_at: null, last_activity_at: now.toISOString() })
        .eq("id", runId)
        .eq("status", "waiting")
        .lte("resume_at", now.toISOString())
        .select("id")
      if (error) throw new Error("due_run_claim_failed")
      return (data ?? []).length > 0
    },

    async listStaleRunningRuns(olderThan, limit) {
      const { data, error } = await db
        .from("automation_runs")
        .select("id")
        .eq("status", "running")
        .lt("last_activity_at", olderThan.toISOString())
        .limit(limit)
        .returns<{ id: string }[]>()
      if (error) throw new Error("stale_runs_lookup_failed")
      return (data ?? []).map((row) => row.id)
    },
  }
}
