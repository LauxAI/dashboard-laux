// Extração segura de eventos do webhook da WhatsApp Cloud API.
// Módulo puro: não lê env, não acessa banco e não registra logs.

export type WhatsAppMessageEvent = {
  kind: "message"
  businessAccountId: string | null
  phoneNumberId: string
  senderWaId: string
  messageId: string
  timestamp: string | null
  messageType: string
  /** Somente para mensagens do tipo "text". Nunca é registrado em log. */
  text: string | null
  /** Nome do perfil do contato (contacts[].profile.name). Informativo; nunca é registrado em log. */
  contactName: string | null
}

export type WhatsAppStatusEvent = {
  kind: "status"
  businessAccountId: string | null
  phoneNumberId: string
  messageId: string
  recipientId: string | null
  status: string
  timestamp: string | null
  errorCode: number | null
  errorTitle: string | null
}

export type WhatsAppEvent = WhatsAppMessageEvent | WhatsAppStatusEvent

export type ParsedPayload =
  | { ok: true; events: WhatsAppEvent[] }
  | { ok: false; reason: "not_whatsapp_payload" }

const MAX_TEXT_LENGTH = 4096
const MAX_ID_LENGTH = 256
const MAX_TITLE_LENGTH = 200
const MAX_NAME_LENGTH = 256

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_ID_LENGTH) return null
  return trimmed
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** A Meta envia o timestamp como string de segundos Unix. */
function toIsoTimestamp(value: unknown): string | null {
  const seconds = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Nome do perfil do remetente. A Meta envia `contacts` ao lado de `messages`, ligando
 * cada contato ao remetente por `wa_id`. Sem `wa_id`, só aceita um único contato.
 */
function contactNameFor(contacts: unknown[], senderWaId: string): string | null {
  const records = contacts.filter(isRecord)
  const contact =
    records.find((candidate) => asId(candidate.wa_id) === senderWaId) ??
    (records.length === 1 && asId(records[0].wa_id) === null ? records[0] : undefined)
  if (!contact || !isRecord(contact.profile) || typeof contact.profile.name !== "string") return null
  const name = contact.profile.name.trim()
  return name ? name.slice(0, MAX_NAME_LENGTH) : null
}

function parseMessage(
  raw: unknown,
  businessAccountId: string | null,
  phoneNumberId: string,
  contacts: unknown[],
): WhatsAppMessageEvent | null {
  if (!isRecord(raw)) return null
  const messageId = asId(raw.id)
  const senderWaId = asId(raw.from)
  const messageType = asId(raw.type)
  if (!messageId || !senderWaId || !messageType) return null

  let text: string | null = null
  if (messageType === "text" && isRecord(raw.text) && typeof raw.text.body === "string") {
    text = raw.text.body.slice(0, MAX_TEXT_LENGTH)
  }

  return {
    kind: "message",
    businessAccountId,
    phoneNumberId,
    senderWaId,
    messageId,
    timestamp: toIsoTimestamp(raw.timestamp),
    messageType,
    text,
    contactName: contactNameFor(contacts, senderWaId),
  }
}

function parseStatus(
  raw: unknown,
  businessAccountId: string | null,
  phoneNumberId: string,
): WhatsAppStatusEvent | null {
  if (!isRecord(raw)) return null
  const messageId = asId(raw.id)
  const status = asId(raw.status)
  if (!messageId || !status) return null

  const firstError = asArray(raw.errors).find(isRecord)
  const errorCode =
    firstError && typeof firstError.code === "number" && Number.isFinite(firstError.code) ? firstError.code : null
  const errorTitle =
    firstError && typeof firstError.title === "string" ? firstError.title.slice(0, MAX_TITLE_LENGTH) : null

  return {
    kind: "status",
    businessAccountId,
    phoneNumberId,
    messageId,
    recipientId: asId(raw.recipient_id),
    status,
    timestamp: toIsoTimestamp(raw.timestamp),
    errorCode,
    errorTitle,
  }
}

/**
 * Valida o envelope da WhatsApp Cloud API e extrai os eventos suportados
 * (`messages` e `statuses`). Campos e tipos desconhecidos são ignorados sem erro,
 * porque a Meta pode adicionar novos eventos ao mesmo webhook.
 */
export function parseWhatsAppPayload(payload: unknown): ParsedPayload {
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return { ok: false, reason: "not_whatsapp_payload" }
  }

  const events: WhatsAppEvent[] = []

  for (const entry of payload.entry) {
    if (!isRecord(entry)) continue
    const businessAccountId = asId(entry.id)

    for (const change of asArray(entry.changes)) {
      if (!isRecord(change) || change.field !== "messages" || !isRecord(change.value)) continue
      const value = change.value
      const phoneNumberId = isRecord(value.metadata) ? asId(value.metadata.phone_number_id) : null
      if (!phoneNumberId) continue

      const contacts = asArray(value.contacts)
      for (const rawMessage of asArray(value.messages)) {
        const event = parseMessage(rawMessage, businessAccountId, phoneNumberId, contacts)
        if (event) events.push(event)
      }
      for (const rawStatus of asArray(value.statuses)) {
        const event = parseStatus(rawStatus, businessAccountId, phoneNumberId)
        if (event) events.push(event)
      }
    }
  }

  return { ok: true, events }
}
