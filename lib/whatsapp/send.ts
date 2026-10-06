import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Envio de mensagens de texto pela WhatsApp Cloud API. Somente servidor.
 *
 * O access_token é lido do banco com a service role, usado apenas no header
 * Authorization e descartado. Ele nunca faz parte do retorno nem dos logs. Os logs
 * também não incluem o número de destino, o texto ou a resposta bruta da Meta.
 */

export const GRAPH_API_VERSION = "v23.0"
const GRAPH_API_BASE = "https://graph.facebook.com"
const REQUEST_TIMEOUT_MS = 10_000
export const MAX_TEXT_LENGTH = 4096

export type SendWhatsAppTextInput = {
  phoneNumberId: string
  to: string
  text: string
}

export type SendWhatsAppTextErrorCode =
  | "invalid_input"
  | "connection_not_found"
  | "connection_inactive"
  | "token_missing"
  | "token_expired"
  | "database_error"
  | "graph_api_error"
  | "network_error"

export type SendWhatsAppTextResult =
  | { ok: true; messageId: string | null }
  | {
      ok: false
      error: SendWhatsAppTextErrorCode
      /** Status HTTP da Graph API, quando houver. */
      httpStatus?: number
      /** Código numérico de erro da Meta, quando houver. */
      graphErrorCode?: number
    }

export type SendDeps = {
  db?: SupabaseClient
  fetch?: typeof fetch
  now?: () => Date
}

type ConnectionTokenRow = {
  status: string
  access_token: string | null
  token_expires_at: string | null
}

function logSend(level: "info" | "warn" | "error", event: string, fields: Record<string, string | number | undefined> = {}) {
  const line = JSON.stringify({ source: "whatsapp_send", level, event, ...fields })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

function normalizePhoneNumberId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{1,64}$/.test(trimmed) ? trimmed : null
}

/** Destino no formato internacional, só dígitos (o "+" inicial é aceito e removido). */
function normalizeRecipient(value: unknown): string | null {
  if (typeof value !== "string") return null
  const digits = value.trim().replace(/^\+/, "")
  return /^\d{8,15}$/.test(digits) ? digits : null
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null
  if (value.trim().length === 0 || value.length > MAX_TEXT_LENGTH) return null
  return value
}

function fail(error: SendWhatsAppTextErrorCode, extra: Omit<Extract<SendWhatsAppTextResult, { ok: false }>, "ok" | "error"> = {}): SendWhatsAppTextResult {
  return { ok: false, error, ...extra }
}

export async function sendWhatsAppText(input: SendWhatsAppTextInput, deps: SendDeps = {}): Promise<SendWhatsAppTextResult> {
  const phoneNumberId = normalizePhoneNumberId(input?.phoneNumberId)
  const to = normalizeRecipient(input?.to)
  const text = normalizeText(input?.text)
  if (!phoneNumberId || !to || !text) return fail("invalid_input")

  let row: ConnectionTokenRow | null
  try {
    const db = deps.db ?? createAdminClient()
    const { data, error } = await db
      .from("whatsapp_connections")
      .select("status, access_token, token_expires_at")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle<ConnectionTokenRow>()
    if (error) {
      logSend("error", "connection_lookup_failed", { phone_number_id: phoneNumberId })
      return fail("database_error")
    }
    row = data
  } catch {
    logSend("error", "connection_lookup_failed", { phone_number_id: phoneNumberId })
    return fail("database_error")
  }

  if (!row) return fail("connection_not_found")
  if (row.status !== "active") return fail("connection_inactive")

  const accessToken = row.access_token
  if (!accessToken) return fail("token_missing")
  if (row.token_expires_at) {
    const expiresAt = new Date(row.token_expires_at).getTime()
    const now = (deps.now ?? (() => new Date()))().getTime()
    if (!Number.isNaN(expiresAt) && expiresAt <= now) return fail("token_expired")
  }

  const doFetch = deps.fetch ?? fetch
  let response: Response
  try {
    response = await doFetch(`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    })
  } catch {
    logSend("error", "graph_request_failed", { phone_number_id: phoneNumberId })
    return fail("network_error")
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const code = (body as { error?: { code?: unknown } } | null)?.error?.code
    const graphErrorCode = typeof code === "number" ? code : undefined
    logSend("warn", "graph_api_error", {
      phone_number_id: phoneNumberId,
      http_status: response.status,
      graph_error_code: graphErrorCode,
    })
    return fail("graph_api_error", { httpStatus: response.status, graphErrorCode })
  }

  const id = (body as { messages?: { id?: unknown }[] } | null)?.messages?.[0]?.id
  const messageId = typeof id === "string" && id.length <= 256 ? id : null
  logSend("info", "message_sent", { phone_number_id: phoneNumberId })
  return { ok: true, messageId }
}
