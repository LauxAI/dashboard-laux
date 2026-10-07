export type AutomationStatus = "active" | "paused" | "draft"

export type AutomationCategory = "atendimento" | "vendas" | "agendamento" | "relacionamento" | "geral"

export type RunStatus = "running" | "waiting" | "success" | "failed" | "cancelled"

export type RunStepStatus = "success" | "failed" | "skipped" | "waiting"

export type ConditionField =
  | "message_text"
  | "message_type"
  | "contact_name"
  | "contact_phone"
  | "is_new_contact"
  | "lead_status"
  | "lead_source"
  | "appointment_status"

export type ConditionOperator =
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "starts_with"
  | "is_empty"
  | "is_not_empty"
  | "is_true"
  | "is_false"

export type ActionKind =
  | "whatsapp.send_message"
  | "whatsapp.run_agent"
  | "whatsapp.handoff"
  | "lead.create"
  | "lead.update_status"
  | "lead.add_note"
  | "client.create"
  | "appointment.confirm"
  | "appointment.cancel"
  | "team.notify"

export type ConditionStep = {
  type: "condition"
  field: ConditionField
  operator: ConditionOperator
  value: string
}

export type ActionStep = {
  type: "action"
  kind: ActionKind
  params: Record<string, string>
}

export type DelayStep = {
  type: "delay"
  minutes: number
}

export type AutomationStep = ConditionStep | ActionStep | DelayStep

export type AutomationDefinition = {
  name: string
  description: string
  category: AutomationCategory
  triggerType: string
  steps: AutomationStep[]
}

/** Valores simples do evento usados por condições e variáveis de mensagem. */
export type EventValue = string | number | boolean | null

/** Evento de negócio entregue ao motor. `id` é a chave de idempotência do evento. */
export type AutomationEvent = {
  id: string
  companyId: string
  type: string
  /** Somente ids e campos curtos: nunca payload bruto de provedores. */
  data: Record<string, EventValue>
}

export type StoredAutomation = {
  id: string
  companyId: string
  name: string
  description: string | null
  status: AutomationStatus
  category: AutomationCategory | null
  triggerType: string | null
  steps: AutomationStep[]
}

export type AutomationListItem = {
  id: string
  name: string
  description: string | null
  status: AutomationStatus
  category: AutomationCategory | null
  triggerType: string | null
  stepsCount: number
  executionsCount: number
  errorsCount: number
  lastRunAt: string | null
  updatedAt: string
}

export type AutomationRunItem = {
  id: string
  automationId: string
  automationName: string
  triggerType: string
  status: RunStatus
  startedAt: string
  completedAt: string | null
  errorCode: string | null
  errorMessage: string | null
}

export type AutomationRunStepItem = {
  id: string
  stepOrder: number
  stepType: "trigger" | "condition" | "action" | "delay"
  status: RunStepStatus
  label: string
  errorCode: string | null
  errorMessage: string | null
}

export const MAX_STEPS = 20
export const MAX_DELAY_MINUTES = 60 * 24 * 30
