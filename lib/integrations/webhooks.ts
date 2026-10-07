import "server-only"
import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptJson, encryptJson, hmacSha256Hex, isEncryptionConfigured, randomToken, secretHint } from "./crypto"
import { IntegrationError, assertPublicHttpsUrl, toIntegrationError } from "./http"
import { logIntegration } from "./log"

export const webhookEvents = [
  { value: "lead.created", label: "Lead criado" },
  { value: "client.created", label: "Cliente criado" },
  { value: "message.received", label: "Mensagem recebida" },
  { value: "webhook.test", label: "Teste de webhook" },
] as const

export type WebhookEventType = (typeof webhookEvents)[number]["value"]

const EVENT_VALUES = new Set<string>(webhookEvents.map((event) => event.value))
const MAX_ENDPOINTS = 10
const DISABLE_AFTER_FAILURES = 10
const DELIVERY_TIMEOUT_MS = 8_000

export function isWebhookEvent(value: string): value is WebhookEventType {
  return EVENT_VALUES.has(value)
}

export type WebhookEndpointView = {
  id: string
  name: string
  url: string
  events: string[]
  active: boolean
  secretHint: string | null
  consecutiveFailures: number
  disabledReason: string | null
  lastDeliveryAt: string | null
  lastStatus: string | null
}

export type WebhookDeliveryView = {
  id: string
  endpointId: string
  eventType: string
  status: string
  attempts: number
  httpStatus: number | null
  errorMessage: string | null
  createdAt: string
}

type EndpointRow = {
  id: string
  name: string
  url: string
  events: string[]
  active: boolean
  secret_hint: string | null
  consecutive_failures: number
  disabled_reason: string | null
  last_delivery_at: string | null
  last_status: string | null
}

const ENDPOINT_COLUMNS = "id, name, url, events, active, secret_hint, consecutive_failures, disabled_reason, last_delivery_at, last_status"

export async function listEndpoints(companyId: string, db: SupabaseClient = createAdminClient()): Promise<WebhookEndpointView[]> {
  const { data } = await db.from("webhook_endpoints").select(ENDPOINT_COLUMNS).eq("company_id", companyId).order("created_at").returns<EndpointRow[]>()
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    events: row.events,
    active: row.active,
    secretHint: row.secret_hint,
    consecutiveFailures: row.consecutive_failures,
    disabledReason: row.disabled_reason,
    lastDeliveryAt: row.last_delivery_at,
    lastStatus: row.last_status,
  }))
}

export async function listDeliveries(companyId: string, limit = 20, db: SupabaseClient = createAdminClient()): Promise<WebhookDeliveryView[]> {
  const { data } = await db
    .from("webhook_deliveries")
    .select("id, endpoint_id, event_type, status, attempts, http_status, error_message, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    endpointId: row.endpoint_id as string,
    eventType: row.event_type as string,
    status: row.status as string,
    attempts: row.attempts as number,
    httpStatus: (row.http_status as number | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    createdAt: row.created_at as string,
  }))
}

export type CreateEndpointInput = { name: string; url: string; events: string[] }

/** Cria o endpoint e devolve o segredo de assinatura uma única vez. */
export async function createEndpoint(
  companyId: string,
  input: CreateEndpointInput,
  db: SupabaseClient = createAdminClient(),
): Promise<{ id: string; signingSecret: string }> {
  if (!isEncryptionConfigured()) throw new IntegrationError("not_configured", "A chave de criptografia das integrações não está configurada no servidor.")
  const name = input.name.trim()
  if (!name || name.length > 80) throw new IntegrationError("not_configured", "Informe um nome de até 80 caracteres.")
  const events = [...new Set(input.events)].filter(isWebhookEvent)
  if (events.length === 0) throw new IntegrationError("not_configured", "Escolha ao menos um evento.")
  await assertPublicHttpsUrl(input.url.trim())

  const { count } = await db.from("webhook_endpoints").select("id", { count: "exact", head: true }).eq("company_id", companyId)
  if ((count ?? 0) >= MAX_ENDPOINTS) throw new IntegrationError("not_configured", `O limite é de ${MAX_ENDPOINTS} endpoints por empresa.`)

  const signingSecret = `whsec_${randomToken(24)}`
  const { data, error } = await db
    .from("webhook_endpoints")
    .insert({ company_id: companyId, name, url: input.url.trim(), events, secret_hint: secretHint(signingSecret) })
    .select("id")
    .single<{ id: string }>()
  if (error || !data) throw new IntegrationError("provider_error", "Não foi possível criar o endpoint.")

  const stored = await db
    .from("webhook_endpoint_secrets")
    .insert({ endpoint_id: data.id, company_id: companyId, ciphertext: encryptJson({ signingSecret }) })
  if (stored.error) {
    await db.from("webhook_endpoints").delete().eq("id", data.id)
    throw new IntegrationError("provider_error", "Não foi possível salvar o segredo do endpoint.")
  }
  return { id: data.id, signingSecret }
}

export async function setEndpointActive(companyId: string, id: string, active: boolean, db: SupabaseClient = createAdminClient()): Promise<void> {
  const { error } = await db
    .from("webhook_endpoints")
    .update({ active, consecutive_failures: 0, disabled_reason: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)
  if (error) throw new IntegrationError("provider_error", "Não foi possível atualizar o endpoint.")
}

export async function deleteEndpoint(companyId: string, id: string, db: SupabaseClient = createAdminClient()): Promise<void> {
  const { error } = await db.from("webhook_endpoints").delete().eq("id", id).eq("company_id", companyId)
  if (error) throw new IntegrationError("provider_error", "Não foi possível remover o endpoint.")
}

/** Assinatura enviada no cabeçalho: HMAC-SHA256 de "<timestamp>.<corpo>". */
export function signPayload(secret: string, timestamp: number, body: string): string {
  return `v1=${hmacSha256Hex(secret, `${timestamp}.${body}`)}`
}

type DeliveryOutcome = { ok: boolean; httpStatus?: number; durationMs: number; error?: string }

async function postSigned(url: string, secret: string, eventId: string, eventType: string, body: string): Promise<DeliveryOutcome> {
  const started = Date.now()
  try {
    await assertPublicHttpsUrl(url)
    const timestamp = Math.floor(Date.now() / 1000)
    const response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LAUXAI-Webhooks/1.0",
        "X-Lauxai-Event": eventType,
        "X-Lauxai-Delivery": eventId,
        "X-Lauxai-Timestamp": String(timestamp),
        "X-Lauxai-Signature": signPayload(secret, timestamp, body),
      },
      body,
    })
    const durationMs = Date.now() - started
    if (response.ok) return { ok: true, httpStatus: response.status, durationMs }
    return { ok: false, httpStatus: response.status, durationMs, error: `O destino respondeu HTTP ${response.status}.` }
  } catch (error) {
    const normalized = toIntegrationError(error)
    return { ok: false, durationMs: Date.now() - started, error: normalized.message }
  }
}

async function deliver(db: SupabaseClient, endpoint: EndpointRow, companyId: string, eventId: string, eventType: string, body: string): Promise<DeliveryOutcome> {
  const { data: secretRow } = await db.from("webhook_endpoint_secrets").select("ciphertext").eq("endpoint_id", endpoint.id).maybeSingle<{ ciphertext: string }>()
  let secret = ""
  try {
    secret = secretRow ? decryptJson(secretRow.ciphertext).signingSecret : ""
  } catch {
    secret = ""
  }
  if (!secret) return { ok: false, durationMs: 0, error: "Segredo de assinatura indisponível." }

  let outcome: DeliveryOutcome = { ok: false, durationMs: 0 }
  let attempts = 0
  for (const delayMs of [0, 1500]) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
    attempts += 1
    outcome = await postSigned(endpoint.url, secret, eventId, eventType, body)
    const retryable = !outcome.ok && (outcome.httpStatus === undefined || outcome.httpStatus >= 500 || outcome.httpStatus === 429)
    if (!retryable) break
  }

  const now = new Date().toISOString()
  await db
    .from("webhook_deliveries")
    .update({
      status: outcome.ok ? "success" : "failed",
      attempts,
      http_status: outcome.httpStatus ?? null,
      duration_ms: outcome.durationMs,
      error_message: outcome.ok ? null : (outcome.error ?? "Falha na entrega.").slice(0, 300),
      delivered_at: outcome.ok ? now : null,
    })
    .eq("endpoint_id", endpoint.id)
    .eq("event_id", eventId)

  const failures = outcome.ok ? 0 : endpoint.consecutive_failures + 1
  const shouldDisable = failures >= DISABLE_AFTER_FAILURES
  await db
    .from("webhook_endpoints")
    .update({
      consecutive_failures: failures,
      last_delivery_at: now,
      last_status: outcome.ok ? "success" : "failed",
      ...(shouldDisable ? { active: false, disabled_reason: "Desativado após falhas consecutivas." } : {}),
    })
    .eq("id", endpoint.id)

  await logIntegration(
    {
      companyId,
      provider: "webhook",
      operation: `deliver_${eventType}`,
      ok: outcome.ok,
      durationMs: outcome.durationMs,
      httpStatus: outcome.httpStatus,
      errorCode: outcome.ok ? undefined : "delivery_failed",
      message: outcome.error,
    },
    db,
  )
  return outcome
}

/** Registra e entrega o evento a todos os endpoints ativos inscritos. Nunca lança. */
export async function emitWebhookEvent(
  companyId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  db: SupabaseClient = createAdminClient(),
): Promise<void> {
  try {
    const { data: endpoints } = await db
      .from("webhook_endpoints")
      .select(ENDPOINT_COLUMNS)
      .eq("company_id", companyId)
      .eq("active", true)
      .contains("events", [eventType])
      .returns<EndpointRow[]>()
    if (!endpoints || endpoints.length === 0) return

    const eventId = randomUUID()
    const body = JSON.stringify({ id: eventId, type: eventType, createdAt: new Date().toISOString(), data })
    await Promise.all(
      endpoints.map(async (endpoint) => {
        await db.from("webhook_deliveries").insert({
          company_id: companyId,
          endpoint_id: endpoint.id,
          event_id: eventId,
          event_type: eventType,
          payload: JSON.parse(body),
        })
        await deliver(db, endpoint, companyId, eventId, eventType, body)
      }),
    )
  } catch {
    // A entrega de webhooks nunca deve interromper o fluxo principal.
  }
}

/** Envia um evento de teste a um endpoint específico, ignorando a assinatura de eventos. */
export async function sendTestDelivery(companyId: string, endpointId: string, db: SupabaseClient = createAdminClient()): Promise<DeliveryOutcome> {
  const { data: endpoint } = await db
    .from("webhook_endpoints")
    .select(ENDPOINT_COLUMNS)
    .eq("id", endpointId)
    .eq("company_id", companyId)
    .maybeSingle<EndpointRow>()
  if (!endpoint) throw new IntegrationError("not_found", "Endpoint não encontrado.")

  const eventId = randomUUID()
  const body = JSON.stringify({ id: eventId, type: "webhook.test", createdAt: new Date().toISOString(), data: { message: "Teste enviado pela LAUXAI." } })
  await db.from("webhook_deliveries").insert({
    company_id: companyId,
    endpoint_id: endpoint.id,
    event_id: eventId,
    event_type: "webhook.test",
    payload: JSON.parse(body),
  })
  return deliver(db, endpoint, companyId, eventId, "webhook.test", body)
}
