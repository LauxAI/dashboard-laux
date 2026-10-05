/**
 * Estado e ações estruturadas do Agente de Agendamento.
 *
 * Módulo puro (sem dependências de runtime) para ser usado tanto pela rota
 * server-side quanto pela interface, e testado com `node --test`.
 * Toda decisão de ação é tomada aqui de forma determinística — o modelo apenas
 * sugere; nada que ele retorne é aplicado sem validação.
 */
import type { SchedulingAgentBehavior } from "@/lib/domain/types"

export const CONVERSATION_INTENTS = ["schedule", "cancel", "reschedule"] as const
export type ConversationIntent = (typeof CONVERSATION_INTENTS)[number]

export const SCHEDULING_NEXT_ACTIONS = [
  "identify_intent",
  "collect_name",
  "collect_phone",
  "collect_email",
  "check_availability",
  "lookup_appointment",
  "handoff_to_team",
] as const
export type SchedulingNextAction = (typeof SCHEDULING_NEXT_ACTIONS)[number]

/** Ferramentas que dependerão da Agenda real. Nenhuma está conectada nesta fase. */
export const SCHEDULING_TOOLS = [
  "get_availability",
  "get_services",
  "create_appointment",
  "cancel_appointment",
  "reschedule_appointment",
] as const
export type SchedulingAgentTool = (typeof SCHEDULING_TOOLS)[number]

export interface ConversationCustomer {
  name: string | null
  phone: string | null
  email: string | null
}

export interface SchedulingConversationState {
  intent: ConversationIntent | null
  customer: ConversationCustomer
}

export interface SchedulingAgentTurn {
  reply: string
  state: SchedulingConversationState
  nextAction: SchedulingNextAction
  /** Ferramenta necessária para avançar que ainda não está conectada. */
  blockedTool: SchedulingAgentTool | null
  /** `false` quando a resposta do modelo foi inválida e nenhuma ação foi aplicada. */
  structured: boolean
}

type CollectBehavior = Pick<
  SchedulingAgentBehavior,
  "askName" | "askPhone" | "askEmail" | "allowCancellation" | "allowRescheduling"
>

const MAX_REPLY_LENGTH = 2000

export const FALLBACK_REPLY =
  "Desculpe, não consegui processar sua mensagem agora. Pode repetir, por favor?"

export const SAFE_REPLIES: Record<ConversationIntent | "none", string> = {
  schedule:
    "Posso continuar com seus dados, mas ainda preciso consultar a disponibilidade da agenda para confirmar os horários.",
  cancel:
    "Antes de confirmar o cancelamento, preciso consultar seus agendamentos na agenda. Assim que essa consulta for feita, retorno com a confirmação.",
  reschedule:
    "Antes de alterar seu horário, preciso consultar seus agendamentos e a disponibilidade da agenda. Assim que essa consulta for feita, retorno com as opções.",
  none: "Ainda preciso consultar a agenda para confirmar essa informação. Como posso ajudar?",
}

export function createEmptyConversationState(): SchedulingConversationState {
  return { intent: null, customer: { name: null, phone: null, email: null } }
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function normalizeForSearch(value: string): string {
  return stripAccents(value).toLowerCase().replace(/\s+/g, " ")
}

export function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null
  const name = value.replace(/\s+/g, " ").trim()
  if (name.length < 2 || name.length > 80) return null
  if (!/^\p{L}[\p{L}'’.\- ]*$/u.test(name)) return null
  return name
}

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null
  if (/[^\d\s()+\-.]/.test(value)) return null
  let digits = value.replace(/\D/g, "")
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2)
  if (digits.length !== 10 && digits.length !== 11) return null
  const area = digits.slice(0, 2)
  const local = digits.slice(2)
  const split = local.length - 4
  return `(${area}) ${local.slice(0, split)}-${local.slice(split)}`
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null
  const email = value.trim().toLowerCase()
  if (email.length > 254) return null
  return /^[a-z0-9._%+\-]+@[a-z0-9\-]+(\.[a-z0-9\-]+)*\.[a-z]{2,}$/.test(email) ? email : null
}

/** Só aceita dados que o próprio cliente escreveu — evita que o modelo invente valores. */
function isNameInText(name: string, text: string): boolean {
  const haystack = normalizeForSearch(text)
  return normalizeForSearch(name)
    .split(" ")
    .every((part) => haystack.includes(part))
}

function isPhoneInText(phone: string, text: string): boolean {
  return text.replace(/\D/g, "").includes(phone.replace(/\D/g, ""))
}

function isEmailInText(email: string, text: string): boolean {
  return text.toLowerCase().includes(email)
}

function parseIntent(value: unknown): ConversationIntent | null {
  return CONVERSATION_INTENTS.includes(value as ConversationIntent) ? (value as ConversationIntent) : null
}

/** Normaliza o estado enviado pelo navegador; campos inválidos viram `null`. */
export function parseConversationState(input: unknown): SchedulingConversationState {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const customer = (raw.customer && typeof raw.customer === "object" ? raw.customer : {}) as Record<
    string,
    unknown
  >
  return {
    intent: parseIntent(raw.intent),
    customer: {
      name: normalizeName(customer.name),
      phone: normalizePhone(customer.phone),
      email: normalizeEmail(customer.email),
    },
  }
}

export interface ParsedModelOutput {
  reply: string
  intent: ConversationIntent | null
  customer: { name: unknown; phone: unknown; email: unknown }
}

/** Valida o JSON retornado pelo modelo. Retorna `null` se qualquer parte for inválida. */
export function parseModelOutput(raw: string): ParsedModelOutput | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const output = data as Record<string, unknown>

  if (typeof output.reply !== "string") return null
  const reply = output.reply.trim()
  if (!reply || reply.length > MAX_REPLY_LENGTH) return null

  const intentValue = output.intent
  if (intentValue !== null && intentValue !== "none" && !parseIntent(intentValue)) return null

  const customer = output.customer
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) return null
  const fields = customer as Record<string, unknown>
  for (const key of ["name", "phone", "email"]) {
    const value = fields[key]
    if (value !== undefined && value !== null && typeof value !== "string") return null
  }

  return {
    reply,
    intent: parseIntent(intentValue),
    customer: { name: fields.name, phone: fields.phone, email: fields.email },
  }
}

const TOOL_FOR_INTENT: Record<ConversationIntent, SchedulingAgentTool> = {
  schedule: "get_availability",
  cancel: "cancel_appointment",
  reschedule: "reschedule_appointment",
}

export function computeNextAction(
  state: SchedulingConversationState,
  behavior: CollectBehavior,
  connectedTools: readonly SchedulingAgentTool[],
): { nextAction: SchedulingNextAction; blockedTool: SchedulingAgentTool | null } {
  const { intent, customer } = state
  if (!intent) return { nextAction: "identify_intent", blockedTool: null }

  if ((intent === "cancel" && !behavior.allowCancellation) || (intent === "reschedule" && !behavior.allowRescheduling)) {
    return { nextAction: "handoff_to_team", blockedTool: null }
  }

  if (behavior.askName && !customer.name) return { nextAction: "collect_name", blockedTool: null }
  if (behavior.askPhone && !customer.phone) return { nextAction: "collect_phone", blockedTool: null }
  if (behavior.askEmail && !customer.email) return { nextAction: "collect_email", blockedTool: null }

  const tool = TOOL_FOR_INTENT[intent]
  return {
    nextAction: intent === "schedule" ? "check_availability" : "lookup_appointment",
    blockedTool: connectedTools.includes(tool) ? null : tool,
  }
}

const NEGATION = /\b(nao|ainda nao|sem)\s*$/

const UNSUPPORTED_CLAIMS: RegExp[] = [
  /\b(foi|esta|ficou|ja esta|estao|foram)\s+(confirmad|criad|marcad|agendad|cancelad|reagendad|remarcad)[oa]s?\b/g,
  /\b(agendei|marquei|confirmei|cancelei|reagendei|remarquei)\b/g,
  /\b(temos|tenho|ha|existem?)\s+(horarios?|vagas?|disponibilidade)\b/g,
  /\b(esta|estao)\s+(disponive(l|is)|livres?)\b/g,
  /\bhorarios?\s+(disponiveis|livres)\s*(:|sao|para)/g,
]

/** Detecta afirmações de disponibilidade ou de ações executadas sem fonte real. */
export function hasUnsupportedClaim(reply: string): boolean {
  const text = normalizeForSearch(reply)
  return UNSUPPORTED_CLAIMS.some((pattern) =>
    Array.from(text.matchAll(pattern)).some((match) => {
      const before = text.slice(Math.max(0, (match.index ?? 0) - 12), match.index)
      return !NEGATION.test(before)
    }),
  )
}

function guardReply(
  reply: string,
  intent: ConversationIntent | null,
  connectedTools: readonly SchedulingAgentTool[],
): string {
  if (connectedTools.length === 0 && hasUnsupportedClaim(reply)) return SAFE_REPLIES[intent ?? "none"]
  return reply
}

function looksLikeJson(raw: string): boolean {
  const text = raw.trim()
  return text.startsWith("{") || text.startsWith("[") || text.startsWith("```")
}

export interface ResolveAgentTurnInput {
  raw: string
  previous: SchedulingConversationState
  behavior: CollectBehavior
  /** Todas as mensagens do cliente na conversa, usadas para conferir os dados extraídos. */
  userText: string
  connectedTools: readonly SchedulingAgentTool[]
}

export function resolveAgentTurn({
  raw,
  previous,
  behavior,
  userText,
  connectedTools,
}: ResolveAgentTurnInput): SchedulingAgentTurn {
  const parsed = parseModelOutput(raw)

  if (!parsed) {
    const plain = raw.trim()
    const reply =
      !plain || looksLikeJson(plain) || plain.length > MAX_REPLY_LENGTH
        ? FALLBACK_REPLY
        : guardReply(plain, previous.intent, connectedTools)
    return { reply, state: previous, ...computeNextAction(previous, behavior, connectedTools), structured: false }
  }

  const name = behavior.askName ? normalizeName(parsed.customer.name) : null
  const phone = behavior.askPhone ? normalizePhone(parsed.customer.phone) : null
  const email = behavior.askEmail ? normalizeEmail(parsed.customer.email) : null

  const state: SchedulingConversationState = {
    intent: parsed.intent ?? previous.intent,
    customer: {
      name: name && (name === previous.customer.name || isNameInText(name, userText)) ? name : previous.customer.name,
      phone:
        phone && (phone === previous.customer.phone || isPhoneInText(phone, userText)) ? phone : previous.customer.phone,
      email:
        email && (email === previous.customer.email || isEmailInText(email, userText)) ? email : previous.customer.email,
    },
  }

  return {
    reply: guardReply(parsed.reply, state.intent, connectedTools),
    state,
    ...computeNextAction(state, behavior, connectedTools),
    structured: true,
  }
}
