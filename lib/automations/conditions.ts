import type { ConditionField, ConditionStep, EventValue } from "./types"

const FIELD_TO_DATA_KEY: Record<ConditionField, string> = {
  message_text: "messageText",
  message_type: "messageType",
  contact_name: "contactName",
  contact_phone: "contactPhone",
  is_new_contact: "isNewContact",
  lead_status: "leadStatus",
  lead_source: "leadSource",
  appointment_status: "appointmentStatus",
}

function normalize(value: EventValue | undefined): string {
  if (value === null || value === undefined) return ""
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

/** Avalia uma condição contra os dados do evento. Texto ignora caixa e acentos. */
export function evaluateCondition(step: ConditionStep, data: Record<string, EventValue>): boolean {
  const actual = data[FIELD_TO_DATA_KEY[step.field]]
  const actualText = normalize(actual)
  const expected = normalize(step.value)

  switch (step.operator) {
    case "contains":
      return expected !== "" && actualText.includes(expected)
    case "not_contains":
      return expected === "" || !actualText.includes(expected)
    case "equals":
      return actualText === expected
    case "not_equals":
      return actualText !== expected
    case "starts_with":
      return expected !== "" && actualText.startsWith(expected)
    case "is_empty":
      return actualText === ""
    case "is_not_empty":
      return actualText !== ""
    case "is_true":
      return actual === true
    case "is_false":
      return actual !== true
  }
}

export type MessageVariables = { nome?: string | null; telefone?: string | null }

/** Substitui {{nome}} e {{telefone}}. Variáveis desconhecidas ficam como estão. */
export function renderMessage(template: string, variables: MessageVariables): string {
  return template.replace(/\{\{\s*(nome|telefone)\s*\}\}/gi, (_, key: string) => {
    if (key.toLowerCase() === "nome") return variables.nome?.trim() || "cliente"
    return variables.telefone?.trim() || ""
  })
}
