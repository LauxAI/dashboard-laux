import type { AutomationStatus, RunStatus, RunStepStatus } from "./types"

export const automationStatusLabels: Record<AutomationStatus, string> = {
  active: "Ativa",
  paused: "Pausada",
  draft: "Rascunho",
}

export const runStatusLabels: Record<RunStatus, string> = {
  running: "Em andamento",
  waiting: "Aguardando",
  success: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
}

export const runStepStatusLabels: Record<RunStepStatus, string> = {
  success: "Concluída",
  failed: "Falhou",
  skipped: "Ignorada",
  waiting: "Aguardando",
}

export const runStatusTone: Record<RunStatus, "primary" | "warning" | "danger" | "muted"> = {
  running: "warning",
  waiting: "warning",
  success: "primary",
  failed: "danger",
  cancelled: "muted",
}

export const runStepStatusTone: Record<RunStepStatus, "primary" | "warning" | "danger" | "muted"> = {
  success: "primary",
  failed: "danger",
  skipped: "muted",
  waiting: "warning",
}
