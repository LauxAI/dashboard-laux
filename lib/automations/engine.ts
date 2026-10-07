import { getAction, getTrigger } from "./catalog"
import { evaluateCondition } from "./conditions"
import { logAutomation } from "./log"
import type { ActionStep, AutomationEvent, AutomationStep, EventValue, RunStepStatus, StoredAutomation } from "./types"

export type ActionResult =
  | { ok: true; outcome: "done" | "skipped"; detail?: string; data?: Record<string, EventValue> }
  | { ok: false; code: string; message: string }

export type ExecutionContext = {
  companyId: string
  data: Record<string, EventValue>
}

export type ActionExecutor = (step: ActionStep, context: ExecutionContext) => Promise<ActionResult>

export type RunStepRecord = {
  order: number
  type: "trigger" | "condition" | "action" | "delay"
  status: RunStepStatus
  label: string
  errorCode?: string
  errorMessage?: string
}

export type DueRun = {
  id: string
  automationId: string
  companyId: string
  nextStepOrder: number
  context: Record<string, EventValue>
}

/** Persistência do motor. A implementação real usa o cliente de serviço do Supabase. */
export type EngineStore = {
  listActiveAutomations(companyId: string, triggerType: string): Promise<StoredAutomation[]>
  loadAutomation(companyId: string, automationId: string): Promise<StoredAutomation | null>
  /** Devolve null quando o evento já gerou uma execução desta automação (idempotência). */
  claimRun(input: {
    automationId: string
    companyId: string
    eventId: string
    triggerType: string
    context: Record<string, EventValue>
  }): Promise<{ id: string } | null>
  recordStep(runId: string, companyId: string, step: RunStepRecord): Promise<void>
  waitRun(runId: string, nextStepOrder: number, resumeAt: Date): Promise<void>
  finishRun(runId: string, status: "success" | "failed" | "cancelled", errorCode?: string, errorMessage?: string): Promise<void>
  listDueRuns(now: Date, limit: number): Promise<DueRun[]>
  /** waiting -> running de forma atômica. false quando outro processo já pegou. */
  claimDueRun(runId: string, now: Date): Promise<boolean>
  listStaleRunningRuns(olderThan: Date, limit: number): Promise<string[]>
}

export type EngineDeps = {
  store: EngineStore
  execute: ActionExecutor
  now?: () => Date
}

type RunSummary = { matched: number; started: number; duplicates: number }

const MAX_AUTOMATIONS_PER_EVENT = 50
const RESUME_BATCH = 25
const STALE_RUN_MS = 10 * 60 * 1000

function leadingConditionsPass(automation: StoredAutomation, data: Record<string, EventValue>): boolean {
  for (const step of automation.steps) {
    if (step.type !== "condition") break
    if (!evaluateCondition(step, data)) return false
  }
  return true
}

function stepLabel(step: AutomationStep): string {
  if (step.type === "action") return getAction(step.kind)?.label ?? "Ação"
  if (step.type === "condition") return "Condição"
  return "Espera"
}

/**
 * Executa as etapas a partir de `startOrder`. Para em: condição falsa (fim
 * normal), delay (pausa e retoma depois), falha de ação ou fim das etapas.
 */
async function runSteps(
  deps: EngineDeps,
  automation: StoredAutomation,
  runId: string,
  startOrder: number,
  initialData: Record<string, EventValue>,
): Promise<void> {
  const { store } = deps
  const companyId = automation.companyId
  const data = { ...initialData }

  try {
    for (let order = startOrder; order < automation.steps.length; order += 1) {
      const step = automation.steps[order]

      if (step.type === "condition") {
        if (!evaluateCondition(step, data)) {
          await store.recordStep(runId, companyId, { order, type: "condition", status: "skipped", label: "Condição não atendida: fluxo encerrado" })
          await store.finishRun(runId, "success")
          return
        }
        await store.recordStep(runId, companyId, { order, type: "condition", status: "success", label: "Condição atendida" })
        continue
      }

      if (step.type === "delay") {
        const resumeAt = new Date((deps.now?.() ?? new Date()).getTime() + step.minutes * 60_000)
        await store.recordStep(runId, companyId, { order, type: "delay", status: "waiting", label: "Aguardando o prazo da espera" })
        await store.waitRun(runId, order + 1, resumeAt)
        return
      }

      const label = stepLabel(step)
      let result: Awaited<ReturnType<ActionExecutor>>
      try {
        result = await deps.execute(step, { companyId, data })
      } catch {
        result = { ok: false, code: "action_exception", message: "Erro inesperado ao executar a ação." }
      }

      if (!result.ok) {
        await store.recordStep(runId, companyId, { order, type: "action", status: "failed", label, errorCode: result.code, errorMessage: result.message })
        await store.finishRun(runId, "failed", result.code, result.message)
        return
      }

      Object.assign(data, result.data ?? {})
      await store.recordStep(runId, companyId, {
        order,
        type: "action",
        status: result.outcome === "skipped" ? "skipped" : "success",
        label: result.detail ? `${label}: ${result.detail}` : label,
      })
    }

    await store.finishRun(runId, "success")
  } catch (error) {
    logAutomation("error", "run_crashed", { runId, error: error instanceof Error ? error.name : "unknown" })
    await store.finishRun(runId, "failed", "engine_error", "Erro interno ao executar a automação.").catch(() => undefined)
  }
}

/**
 * Entrega um evento de negócio ao motor. Nunca lança: falhas ficam registradas
 * e não podem derrubar quem emitiu o evento (ex.: o webhook do WhatsApp).
 */
export async function dispatchAutomationEvent(event: AutomationEvent, deps: EngineDeps): Promise<RunSummary> {
  const summary: RunSummary = { matched: 0, started: 0, duplicates: 0 }
  try {
    if (!getTrigger(event.type)) return summary

    const automations = (await deps.store.listActiveAutomations(event.companyId, event.type)).slice(0, MAX_AUTOMATIONS_PER_EVENT)

    await Promise.all(
      automations.map(async (automation) => {
        if (automation.companyId !== event.companyId) return
        if (!leadingConditionsPass(automation, event.data)) return
        summary.matched += 1

        const run = await deps.store.claimRun({
          automationId: automation.id,
          companyId: event.companyId,
          eventId: event.id,
          triggerType: event.type,
          context: event.data,
        })
        if (!run) {
          summary.duplicates += 1
          return
        }
        summary.started += 1

        await deps.store.recordStep(run.id, event.companyId, {
          order: -1,
          type: "trigger",
          status: "success",
          label: `Gatilho: ${getTrigger(event.type)?.label ?? event.type}`,
        })
        await runSteps(deps, automation, run.id, 0, event.data)
      }),
    )
  } catch (error) {
    logAutomation("error", "dispatch_failed", { eventType: event.type, error: error instanceof Error ? error.name : "unknown" })
  }
  return summary
}

/** Retoma execuções cujo delay venceu e encerra execuções presas em "running". */
export async function resumeDueRuns(deps: EngineDeps): Promise<{ resumed: number; recovered: number }> {
  const now = deps.now?.() ?? new Date()
  let resumed = 0
  let recovered = 0

  try {
    const stale = await deps.store.listStaleRunningRuns(new Date(now.getTime() - STALE_RUN_MS), RESUME_BATCH)
    for (const runId of stale) {
      await deps.store.finishRun(runId, "failed", "interrupted", "A execução foi interrompida antes de terminar.")
      recovered += 1
    }

    const due = await deps.store.listDueRuns(now, RESUME_BATCH)
    for (const run of due) {
      if (!(await deps.store.claimDueRun(run.id, now))) continue

      const automation = await deps.store.loadAutomation(run.companyId, run.automationId)
      if (!automation || automation.status !== "active") {
        await deps.store.finishRun(run.id, "cancelled", "automation_inactive", "A automação foi pausada ou removida durante a espera.")
        continue
      }

      await deps.store.recordStep(run.id, run.companyId, {
        order: run.nextStepOrder - 1,
        type: "delay",
        status: "success",
        label: "Espera concluída",
      })
      resumed += 1
      await runSteps(deps, automation, run.id, run.nextStepOrder, run.context)
    }
  } catch (error) {
    logAutomation("error", "resume_failed", { error: error instanceof Error ? error.name : "unknown" })
  }

  return { resumed, recovered }
}
