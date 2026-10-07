import "server-only"
import { listConnectionsForCompany } from "@/lib/whatsapp/connections"
import { rowsToSteps, type StepRow } from "./serialize"
import { getSessionContext } from "./session"
import type {
  AutomationCategory,
  AutomationListItem,
  AutomationRunItem,
  AutomationRunStepItem,
  AutomationStatus,
  RunStatus,
  RunStepStatus,
  StoredAutomation,
} from "./types"
import type { ReadinessContext } from "./validation"

type Result<T> = { data: T; error: null } | { data: null; error: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

type ListRow = {
  id: string
  name: string
  description: string | null
  status: AutomationStatus
  category: AutomationCategory | null
  trigger_type: string | null
  executions_count: number
  errors_count: number
  last_run_at: string | null
  updated_at: string
  automation_steps: { count: number }[] | null
}

export async function listAutomations(): Promise<Result<AutomationListItem[]>> {
  const context = await getSessionContext()
  if (context.error !== undefined) return { data: null, error: context.error }

  const { data, error } = await context.supabase
    .from("automations")
    .select(
      "id, name, description, status, category, trigger_type, executions_count, errors_count, last_run_at, updated_at, automation_steps(count)",
    )
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false })
    .returns<ListRow[]>()
  if (error) return { data: null, error: "Não foi possível carregar as automações." }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      category: row.category,
      triggerType: row.trigger_type,
      stepsCount: row.automation_steps?.[0]?.count ?? 0,
      executionsCount: row.executions_count,
      errorsCount: row.errors_count,
      lastRunAt: row.last_run_at,
      updatedAt: row.updated_at,
    })),
    error: null,
  }
}

export async function getAutomation(id: string): Promise<Result<StoredAutomation | null>> {
  if (!isUuid(id)) return { data: null, error: "Automação inválida." }
  const context = await getSessionContext()
  if (context.error !== undefined) return { data: null, error: context.error }

  const { data, error } = await context.supabase
    .from("automations")
    .select("id, company_id, name, description, status, category, trigger_type")
    .eq("id", id)
    .eq("company_id", context.companyId)
    .maybeSingle<{
      id: string
      company_id: string
      name: string
      description: string | null
      status: AutomationStatus
      category: AutomationCategory | null
      trigger_type: string | null
    }>()
  if (error) return { data: null, error: "Não foi possível carregar a automação." }
  if (!data) return { data: null, error: null }

  const steps = await context.supabase
    .from("automation_steps")
    .select("step_order, step_type, config")
    .eq("automation_id", id)
    .eq("company_id", context.companyId)
    .returns<StepRow[]>()
  if (steps.error) return { data: null, error: "Não foi possível carregar as etapas." }

  const parsed = rowsToSteps(steps.data ?? [])
  if (!parsed) return { data: null, error: "As etapas desta automação estão inválidas." }

  return {
    data: {
      id: data.id,
      companyId: data.company_id,
      name: data.name,
      description: data.description,
      status: data.status,
      category: data.category,
      triggerType: data.trigger_type,
      steps: parsed,
    },
    error: null,
  }
}

type RunRow = {
  id: string
  automation_id: string
  trigger_type: string
  status: RunStatus
  started_at: string
  completed_at: string | null
  error_code: string | null
  error_message: string | null
  automations: { name: string } | null
}

export async function listRuns(options: { automationId?: string; limit?: number } = {}): Promise<Result<AutomationRunItem[]>> {
  if (options.automationId !== undefined && !isUuid(options.automationId)) return { data: null, error: "Automação inválida." }
  const context = await getSessionContext()
  if (context.error !== undefined) return { data: null, error: context.error }

  let query = context.supabase
    .from("automation_runs")
    .select("id, automation_id, trigger_type, status, started_at, completed_at, error_code, error_message, automations(name)")
    .eq("company_id", context.companyId)
    .order("started_at", { ascending: false })
    .limit(Math.min(options.limit ?? 30, 100))
  if (options.automationId) query = query.eq("automation_id", options.automationId)

  const { data, error } = await query.returns<RunRow[]>()
  if (error) return { data: null, error: "Não foi possível carregar o histórico." }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      automationId: row.automation_id,
      automationName: row.automations?.name ?? "Automação removida",
      triggerType: row.trigger_type,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      errorCode: row.error_code,
      errorMessage: row.error_message,
    })),
    error: null,
  }
}

export async function listRunSteps(runId: string): Promise<Result<AutomationRunStepItem[]>> {
  if (!isUuid(runId)) return { data: null, error: "Execução inválida." }
  const context = await getSessionContext()
  if (context.error !== undefined) return { data: null, error: context.error }

  const { data, error } = await context.supabase
    .from("automation_run_steps")
    .select("id, step_order, step_type, status, label, error_code, error_message")
    .eq("run_id", runId)
    .eq("company_id", context.companyId)
    .order("step_order", { ascending: true })
    .returns<
      {
        id: string
        step_order: number
        step_type: AutomationRunStepItem["stepType"]
        status: RunStepStatus
        label: string
        error_code: string | null
        error_message: string | null
      }[]
    >()
  if (error) return { data: null, error: "Não foi possível carregar as etapas da execução." }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      stepOrder: row.step_order,
      stepType: row.step_type,
      status: row.status,
      label: row.label,
      errorCode: row.error_code,
      errorMessage: row.error_message,
    })),
    error: null,
  }
}

/** O que a empresa já tem configurado: usado para validar antes de ativar. */
export async function getReadiness(): Promise<ReadinessContext> {
  const context = await getSessionContext()
  if (context.error !== undefined) return { hasWhatsAppConnection: false, hasActiveAgent: false }

  const [connections, agent] = await Promise.all([
    listConnectionsForCompany(context.companyId).catch(() => []),
    context.supabase
      .from("ai_agent_settings")
      .select("agent_type", { count: "exact", head: true })
      .eq("company_id", context.companyId)
      .eq("status", "ativo"),
  ])

  return {
    hasWhatsAppConnection: connections.some((connection) => connection.status === "active"),
    hasActiveAgent: (agent.count ?? 0) > 0,
  }
}
