import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { generateAgentReply } from "@/lib/ai/agent-runner"
import { agentErrorMessages, classifyAgentError } from "@/lib/ai/errors"
import { createAdminClient } from "@/lib/supabase/admin"
import { createReplyStore } from "@/lib/whatsapp/reply-store"
import { randomToken } from "./crypto"
import { IntegrationError } from "./http"

export type WidgetConfig = {
  publicKey: string
  enabled: boolean
  title: string
  welcomeMessage: string
  primaryColor: string
  position: "left" | "right"
  collectContact: boolean
  allowedOrigins: string[]
}

type WidgetRow = {
  company_id: string
  public_key: string
  enabled: boolean
  title: string
  welcome_message: string
  primary_color: string
  position: string
  collect_contact: boolean
  allowed_origins: string[]
}

const COLUMNS = "company_id, public_key, enabled, title, welcome_message, primary_color, position, collect_contact, allowed_origins"

const MAX_VISITOR_MESSAGES = 40
const MAX_MESSAGE_CHARS = 1000
const BURST_LIMIT = 8

function toConfig(row: WidgetRow): WidgetConfig {
  return {
    publicKey: row.public_key,
    enabled: row.enabled,
    title: row.title,
    welcomeMessage: row.welcome_message,
    primaryColor: row.primary_color,
    position: row.position === "left" ? "left" : "right",
    collectContact: row.collect_contact,
    allowedOrigins: row.allowed_origins,
  }
}

/** Devolve a configuração da empresa; cria uma desativada na primeira consulta. */
export async function getOrCreateWidget(companyId: string, db: SupabaseClient = createAdminClient()): Promise<WidgetConfig> {
  const existing = await db.from("chat_widgets").select(COLUMNS).eq("company_id", companyId).maybeSingle<WidgetRow>()
  if (existing.data) return toConfig(existing.data)
  const created = await db
    .from("chat_widgets")
    .insert({ company_id: companyId, public_key: `wk_${randomToken(18)}` })
    .select(COLUMNS)
    .single<WidgetRow>()
  if (created.error || !created.data) throw new IntegrationError("provider_error", "Não foi possível criar o widget.")
  return toConfig(created.data)
}

export type WidgetUpdate = Omit<WidgetConfig, "publicKey">

/** Aceita somente origens no formato https://dominio (ou http://localhost para testes). */
export function normalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    const local = url.hostname === "localhost"
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null
    return url.origin
  } catch {
    return null
  }
}

export async function saveWidget(companyId: string, update: WidgetUpdate, db: SupabaseClient = createAdminClient()): Promise<void> {
  const { error } = await db
    .from("chat_widgets")
    .update({
      enabled: update.enabled,
      title: update.title,
      welcome_message: update.welcomeMessage,
      primary_color: update.primaryColor,
      position: update.position,
      collect_contact: update.collectContact,
      allowed_origins: update.allowedOrigins,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
  if (error) throw new IntegrationError("provider_error", "Não foi possível salvar o widget. Revise os campos.")
}

export async function getWidgetByKey(publicKey: string, db: SupabaseClient = createAdminClient()): Promise<(WidgetConfig & { companyId: string }) | null> {
  if (!/^wk_[A-Za-z0-9_-]{10,60}$/.test(publicKey)) return null
  const { data } = await db.from("chat_widgets").select(COLUMNS).eq("public_key", publicKey).maybeSingle<WidgetRow>()
  return data ? { ...toConfig(data), companyId: data.company_id } : null
}

/** Lista vazia = qualquer site pode incorporar; caso contrário, só as origens cadastradas. */
export function isOriginAllowed(allowed: string[], origin: string | null): boolean {
  if (allowed.length === 0) return true
  return origin !== null && allowed.includes(origin)
}

export type VisitorMessageInput = {
  widget: WidgetConfig & { companyId: string }
  sessionId: string | null
  message: string
  origin: string | null
  contact?: { name?: string; email?: string; phone?: string }
}

export type VisitorMessageResult = { sessionId: string; reply: string }

const clean = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null)

export async function handleVisitorMessage(input: VisitorMessageInput, db: SupabaseClient = createAdminClient()): Promise<VisitorMessageResult> {
  const text = input.message.trim().slice(0, MAX_MESSAGE_CHARS)
  if (!text) throw new IntegrationError("bad_response", "Escreva uma mensagem.")
  const { companyId } = input.widget

  let sessionId = input.sessionId
  if (sessionId) {
    const found = await db.from("widget_sessions").select("id").eq("id", sessionId).eq("company_id", companyId).maybeSingle()
    if (!found.data) sessionId = null
  }
  if (!sessionId) {
    const created = await db
      .from("widget_sessions")
      .insert({
        company_id: companyId,
        visitor_name: clean(input.contact?.name, 120),
        visitor_email: clean(input.contact?.email, 200),
        visitor_phone: clean(input.contact?.phone, 40),
        origin: input.origin,
      })
      .select("id")
      .single<{ id: string }>()
    if (created.error || !created.data) throw new IntegrationError("provider_error", "Não foi possível iniciar a conversa.")
    sessionId = created.data.id
  }

  const minuteAgo = new Date(Date.now() - 60_000).toISOString()
  const [{ count: total }, { count: burst }] = await Promise.all([
    db.from("widget_messages").select("id", { count: "exact", head: true }).eq("session_id", sessionId).eq("role", "visitor"),
    db.from("widget_messages").select("id", { count: "exact", head: true }).eq("session_id", sessionId).eq("role", "visitor").gte("created_at", minuteAgo),
  ])
  if ((total ?? 0) >= MAX_VISITOR_MESSAGES) throw new IntegrationError("rate_limited", "Esta conversa atingiu o limite de mensagens.")
  if ((burst ?? 0) >= BURST_LIMIT) throw new IntegrationError("rate_limited", "Muitas mensagens em pouco tempo. Aguarde um instante.")

  await db.from("widget_messages").insert({ company_id: companyId, session_id: sessionId, role: "visitor", content: text })
  await db.from("widget_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sessionId)

  const store = createReplyStore(db)
  const agent = await store.loadActiveAgent(companyId)
  if (!agent) throw new IntegrationError("not_configured", "Nenhum agente está ativo para responder agora.")

  const history = await db
    .from("widget_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<{ role: "visitor" | "agent"; content: string }[]>()
  const chat: { role: "user" | "assistant"; content: string }[] = []
  for (const row of (history.data ?? []).reverse()) {
    const role = row.role === "visitor" ? "user" : "assistant"
    const last = chat[chat.length - 1]
    if (last && last.role === role) last.content += `\n${row.content}`
    else chat.push({ role, content: row.content })
  }
  while (chat.length > 0 && chat[0].role !== "user") chat.shift()

  let reply: string
  try {
    reply = (
      await generateAgentReply({
        type: agent.type,
        config: agent.config,
        companyName: agent.companyName,
        messages: chat,
        abortSignal: AbortSignal.timeout(40_000),
        logContext: { companyId, agentType: agent.type, mode: "widget" },
      })
    ).text.slice(0, 4000)
  } catch (error) {
    throw new IntegrationError("provider_error", agentErrorMessages[classifyAgentError(error).code])
  }

  await db.from("widget_messages").insert({ company_id: companyId, session_id: sessionId, role: "agent", content: reply })
  return { sessionId, reply }
}
