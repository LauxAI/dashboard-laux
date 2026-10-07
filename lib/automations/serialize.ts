import { parseSteps } from "./validation"
import type { AutomationStep } from "./types"

export type StepRow = {
  step_order: number
  step_type: string
  config: unknown
}

/** Formato aceito por public.replace_automation_steps. */
export function stepsToRpcPayload(steps: AutomationStep[]): { step_type: string; config: Record<string, unknown> }[] {
  return steps.map((step) => {
    if (step.type === "condition") {
      return { step_type: "condition", config: { field: step.field, operator: step.operator, value: step.value } }
    }
    if (step.type === "action") {
      return { step_type: "action", config: { kind: step.kind, params: step.params } }
    }
    return { step_type: "delay", config: { minutes: step.minutes } }
  })
}

/** Reconstrói as etapas a partir das linhas do banco. null se qualquer etapa estiver inválida. */
export function rowsToSteps(rows: StepRow[]): AutomationStep[] | null {
  const ordered = [...rows].sort((a, b) => a.step_order - b.step_order)
  const raw = ordered.map((row) => {
    const config = typeof row.config === "object" && row.config !== null && !Array.isArray(row.config) ? row.config : {}
    return { ...config, type: row.step_type }
  })
  const parsed = parseSteps(raw)
  return parsed.ok ? parsed.steps : null
}
