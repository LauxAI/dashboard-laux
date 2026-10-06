import { logWebhook } from "./log"
import type { WhatsAppEvent } from "./payload"
import { hashPayload } from "./security"

export type WebhookEventRow = {
  company_id: string | null
  whatsapp_business_account_id: string | null
  phone_number_id: string
  whatsapp_message_id: string
  event_type: "message" | "status"
  dedupe_key: string
  payload_hash: string
  status: "received" | "ignored"
  processed_at: string | null
  error_message: string | null
}

export type ProcessorDeps = {
  /** phone_number_id -> company_id. Retorna null quando não há empresa configurada. */
  resolveCompany: (phoneNumberId: string) => Promise<string | null>
  /** Insere ignorando duplicados e devolve apenas as chaves realmente inseridas. */
  insertEvents: (rows: WebhookEventRow[]) => Promise<Set<string>>
}

/**
 * Chave de idempotência. Mensagens são únicas pelo message_id; um mesmo message_id
 * recebe vários status (sent, delivered, read), então o status entra na chave.
 */
export function dedupeKeyFor(event: WhatsAppEvent): string {
  return event.kind === "message" ? `message:${event.messageId}` : `status:${event.messageId}:${event.status}`
}

function toRow(event: WhatsAppEvent, companyId: string | null): WebhookEventRow {
  const resolved = companyId !== null
  return {
    company_id: companyId,
    whatsapp_business_account_id: event.businessAccountId,
    phone_number_id: event.phoneNumberId,
    whatsapp_message_id: event.messageId,
    event_type: event.kind,
    dedupe_key: dedupeKeyFor(event),
    // O hash identifica o evento sem guardar seu conteúdo (texto, telefone).
    payload_hash: hashPayload(event),
    status: resolved ? "received" : "ignored",
    processed_at: resolved ? null : new Date().toISOString(),
    error_message: resolved ? null : "company_not_configured",
  }
}

async function resolveCompanies(
  phoneNumberIds: string[],
  resolveCompany: ProcessorDeps["resolveCompany"],
): Promise<Map<string, string | null>> {
  const resolved = new Map<string, string | null>()
  await Promise.all(
    phoneNumberIds.map(async (phoneNumberId) => {
      try {
        resolved.set(phoneNumberId, await resolveCompany(phoneNumberId))
      } catch (error) {
        logWebhook("error", "company_resolution_failed", {
          phone_number_id: phoneNumberId,
          error: error instanceof Error ? error.name : "unknown",
        })
        resolved.set(phoneNumberId, null)
      }
    }),
  )
  return resolved
}

/**
 * Registra os eventos de forma idempotente e emite logs seguros.
 * Nesta etapa não há resposta ao cliente nem chamada de IA: eventos de empresas
 * ainda não configuradas ficam marcados como "ignored".
 */
export async function processWhatsAppEvents(events: WhatsAppEvent[], deps: ProcessorDeps): Promise<void> {
  if (events.length === 0) return

  const unique = new Map<string, WhatsAppEvent>()
  for (const event of events) {
    const key = dedupeKeyFor(event)
    if (!unique.has(key)) unique.set(key, event)
  }

  const companies = await resolveCompanies([...new Set([...unique.values()].map((e) => e.phoneNumberId))], deps.resolveCompany)
  const rows = [...unique.values()].map((event) => toRow(event, companies.get(event.phoneNumberId) ?? null))

  let insertedKeys: Set<string>
  try {
    insertedKeys = await deps.insertEvents(rows)
  } catch (error) {
    logWebhook("error", "event_persistence_failed", {
      events: rows.length,
      error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    })
    return
  }

  for (const event of unique.values()) {
    const key = dedupeKeyFor(event)
    const common = {
      event_type: event.kind,
      message_id: event.messageId,
      phone_number_id: event.phoneNumberId,
      waba_id: event.businessAccountId,
      company_resolved: (companies.get(event.phoneNumberId) ?? null) !== null,
    }
    if (!insertedKeys.has(key)) {
      logWebhook("info", "duplicate_event_skipped", common)
    } else if (event.kind === "message") {
      logWebhook("info", "message_received", {
        ...common,
        message_type: event.messageType,
        has_text: event.text !== null,
        text_length: event.text?.length ?? 0,
        event_timestamp: event.timestamp,
      })
    } else {
      logWebhook("info", "status_received", {
        ...common,
        delivery_status: event.status,
        event_timestamp: event.timestamp,
        error_code: event.errorCode,
        error_title: event.errorTitle,
      })
    }
  }
}
