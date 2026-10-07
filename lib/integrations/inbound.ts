import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { randomToken, sha256Hex } from "./crypto"
import { IntegrationError } from "./http"

export const INBOUND_MAX_BYTES = 32_000

export type InboundView = { enabled: boolean; tokenHint: string; createdAt: string; rotatedAt: string | null } | null

export async function getInboundView(companyId: string, db: SupabaseClient = createAdminClient()): Promise<InboundView> {
  const { data } = await db
    .from("inbound_webhook_endpoints")
    .select("enabled, token_hint, created_at, rotated_at")
    .eq("company_id", companyId)
    .maybeSingle<{ enabled: boolean; token_hint: string; created_at: string; rotated_at: string | null }>()
  return data ? { enabled: data.enabled, tokenHint: data.token_hint, createdAt: data.created_at, rotatedAt: data.rotated_at } : null
}

/** Gera (ou rotaciona) o token. O valor completo só é devolvido aqui; no banco fica apenas o hash. */
export async function rotateInboundToken(companyId: string, db: SupabaseClient = createAdminClient()): Promise<string> {
  const token = randomToken(32)
  const now = new Date().toISOString()
  const { error } = await db.from("inbound_webhook_endpoints").upsert(
    { company_id: companyId, token_hash: sha256Hex(token), token_hint: `••••${token.slice(-4)}`, enabled: true, rotated_at: now },
    { onConflict: "company_id" },
  )
  if (error) throw new IntegrationError("provider_error", "Não foi possível gerar a URL.")
  return token
}

export async function setInboundEnabled(companyId: string, enabled: boolean, db: SupabaseClient = createAdminClient()): Promise<void> {
  const { error } = await db.from("inbound_webhook_endpoints").update({ enabled }).eq("company_id", companyId)
  if (error) throw new IntegrationError("provider_error", "Não foi possível atualizar a URL.")
}

export async function listInboundEvents(companyId: string, limit = 15, db: SupabaseClient = createAdminClient()) {
  const { data } = await db
    .from("inbound_webhook_events")
    .select("id, event_type, status, result_message, received_at")
    .eq("company_id", companyId)
    .order("received_at", { ascending: false })
    .limit(limit)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    eventType: (row.event_type as string | null) ?? null,
    status: row.status as string,
    resultMessage: (row.result_message as string | null) ?? null,
    receivedAt: row.received_at as string,
  }))
}

export async function resolveInboundCompany(token: string, db: SupabaseClient = createAdminClient()): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null
  const { data } = await db
    .from("inbound_webhook_endpoints")
    .select("company_id, enabled")
    .eq("token_hash", sha256Hex(token))
    .maybeSingle<{ company_id: string; enabled: boolean }>()
  return data && data.enabled ? data.company_id : null
}

const str = (value: unknown, max: number): string | null => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null)

export type InboundResult = { status: "accepted" | "ignored"; message: string }

/**
 * Processa um evento recebido. Formato aceito:
 * { "id": "...", "event": "lead.create", "contact": { "name", "phone", "email" }, "source": "..." }
 * É idempotente: o mesmo `id` (ou o mesmo corpo) só é processado uma vez.
 */
export async function processInboundEvent(companyId: string, raw: string, db: SupabaseClient = createAdminClient()): Promise<InboundResult> {
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw new IntegrationError("bad_response", "O corpo precisa ser um JSON válido.")
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new IntegrationError("bad_response", "O corpo precisa ser um objeto JSON.")
  const payload = body as Record<string, unknown>

  const eventType = str(payload.event, 60) ?? "lead.create"
  const eventKey = str(payload.id, 120) ?? sha256Hex(raw)

  const recorded = await db
    .from("inbound_webhook_events")
    .insert({ company_id: companyId, event_key: eventKey, event_type: eventType, status: "accepted" })
    .select("id")
    .single<{ id: string }>()
  if (recorded.error) {
    if (recorded.error.code === "23505") return { status: "ignored", message: "Evento duplicado." }
    throw new IntegrationError("provider_error", "Não foi possível registrar o evento.")
  }

  const finish = async (status: "accepted" | "ignored", message: string): Promise<InboundResult> => {
    await db.from("inbound_webhook_events").update({ status, result_message: message }).eq("id", recorded.data.id)
    return { status, message }
  }

  if (eventType !== "lead.create") return finish("ignored", "Tipo de evento não suportado.")

  const contact = typeof payload.contact === "object" && payload.contact !== null ? (payload.contact as Record<string, unknown>) : {}
  const name = str(contact.name, 120)
  const phone = str(contact.phone, 40)
  const email = str(contact.email, 200)
  if (!name || (!phone && !email)) return finish("ignored", "Informe contact.name e telefone ou e-mail.")

  const filters = [phone ? `phone.eq.${phone.replace(/[^\d+]/g, "")}` : null].filter(Boolean)
  const existing = await db
    .from("leads")
    .select("id")
    .eq("company_id", companyId)
    .or([...filters, email ? `email.eq.${email.replace(/[(),]/g, "")}` : null].filter(Boolean).join(","))
    .limit(1)
  if (existing.data && existing.data.length > 0) return finish("ignored", "O lead já existe.")

  const inserted = await db
    .from("leads")
    .insert({ company_id: companyId, name, phone, email, source: str(payload.source, 60) ?? "webhook", status: "novo" })
  if (inserted.error) return finish("ignored", "Não foi possível criar o lead.")
  return finish("accepted", "Lead criado.")
}
