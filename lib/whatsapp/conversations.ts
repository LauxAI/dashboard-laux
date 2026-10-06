import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Conversas e mensagens do WhatsApp. Somente servidor, sempre com a service role
 * (o cliente autenticado só tem SELECT por RLS e nunca escreve).
 *
 * O companyId recebido aqui é uma autorização: ele deve vir de fonte confiável do
 * servidor (a conexão resolvida pelo webhook ou a sessão), nunca do frontend.
 * Toda leitura/escrita filtra por company_id e valida que a conversa pertence à
 * empresa antes de agir.
 *
 * Nada é registrado em log, e o módulo nunca lê tokens, headers, assinaturas ou o
 * payload bruto do webhook: só as colunas listadas abaixo.
 */

export const WHATSAPP_CONVERSATION_STATUSES = ["open", "closed", "handoff"] as const
export type WhatsAppConversationStatus = (typeof WHATSAPP_CONVERSATION_STATUSES)[number]

export const WHATSAPP_MESSAGE_TYPES = [
  "text",
  "image",
  "audio",
  "video",
  "document",
  "interactive",
  "unknown",
] as const
export type WhatsAppMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number]

export type WhatsAppMessageStatus = "received" | "sent" | "delivered" | "read" | "failed"
export type WhatsAppOutboundStatus = Exclude<WhatsAppMessageStatus, "received">

export type WhatsAppConversation = {
  id: string
  company_id: string
  whatsapp_connection_id: string
  contact_phone: string
  contact_name: string | null
  status: WhatsAppConversationStatus
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export type WhatsAppMessage = {
  id: string
  conversation_id: string
  company_id: string
  direction: "inbound" | "outbound"
  message_type: WhatsAppMessageType
  whatsapp_message_id: string | null
  sender_phone: string | null
  recipient_phone: string | null
  text_content: string | null
  status: WhatsAppMessageStatus
  created_at: string
}

export type SaveWhatsAppMessageResult = {
  message: WhatsAppMessage
  /** true quando o whatsapp_message_id já existia e nada foi gravado. */
  duplicate: boolean
}

export class WhatsAppConversationError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "connection_not_found"
      | "conversation_not_found"
      | "message_id_conflict"
      | "database_error",
  ) {
    super(code)
    this.name = "WhatsAppConversationError"
  }
}

export const MAX_TEXT_LENGTH = 4096
export const DEFAULT_MESSAGES_LIMIT = 50
export const MAX_MESSAGES_LIMIT = 200

const CONVERSATION_COLUMNS =
  "id, company_id, whatsapp_connection_id, contact_phone, contact_name, status, last_message_at, created_at, updated_at"
const MESSAGE_COLUMNS =
  "id, conversation_id, company_id, direction, message_type, whatsapp_message_id, sender_phone, recipient_phone, text_content, status, created_at"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PHONE_PATTERN = /^\+?[0-9]{7,20}$/
const UNIQUE_VIOLATION = "23505"

function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new WhatsAppConversationError("invalid_input")
  return value
}

function requirePhone(value: unknown): string {
  if (typeof value !== "string") throw new WhatsAppConversationError("invalid_input")
  const phone = value.trim()
  if (!PHONE_PATTERN.test(phone)) throw new WhatsAppConversationError("invalid_input")
  return phone
}

function requireMessageId(value: unknown): string {
  if (typeof value !== "string") throw new WhatsAppConversationError("invalid_input")
  const id = value.trim()
  if (id.length === 0 || id.length > 256) throw new WhatsAppConversationError("invalid_input")
  return id
}

function optionalName(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") throw new WhatsAppConversationError("invalid_input")
  const name = value.trim()
  if (name.length === 0) return null
  // Nome de perfil é só informativo: trunca em vez de rejeitar o evento inteiro.
  return name.slice(0, 256)
}

function requireMessageType(value: unknown): WhatsAppMessageType {
  if (typeof value !== "string" || !WHATSAPP_MESSAGE_TYPES.includes(value as WhatsAppMessageType)) {
    throw new WhatsAppConversationError("invalid_input")
  }
  return value as WhatsAppMessageType
}

function optionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string" || value.length > MAX_TEXT_LENGTH) throw new WhatsAppConversationError("invalid_input")
  return value
}

/** Garante que a conversa existe E pertence à empresa. Nunca confia só no id. */
async function assertConversationBelongsToCompany(
  db: SupabaseClient,
  conversationId: string,
  companyId: string,
): Promise<void> {
  const { data, error } = await db
    .from("whatsapp_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("company_id", companyId)
    .maybeSingle<{ id: string }>()
  if (error) throw new WhatsAppConversationError("database_error")
  if (!data) throw new WhatsAppConversationError("conversation_not_found")
}

async function selectConversationByContact(
  db: SupabaseClient,
  companyId: string,
  connectionId: string,
  contactPhone: string,
): Promise<WhatsAppConversation | null> {
  const { data, error } = await db
    .from("whatsapp_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("whatsapp_connection_id", connectionId)
    .eq("company_id", companyId)
    .eq("contact_phone", contactPhone)
    .maybeSingle<WhatsAppConversation>()
  if (error) throw new WhatsAppConversationError("database_error")
  return data
}

/**
 * Busca a conversa da conexão com o contato; cria se não existir (única por
 * conexão + telefone). A conexão precisa pertencer à empresa informada. Nunca altera
 * o status de uma conversa existente.
 */
export async function findOrCreateWhatsAppConversation(
  input: {
    whatsappConnectionId: string
    companyId: string
    contactPhone: string
    contactName?: string | null
  },
  db: SupabaseClient = createAdminClient(),
): Promise<WhatsAppConversation> {
  const connectionId = requireUuid(input.whatsappConnectionId)
  const companyId = requireUuid(input.companyId)
  const contactPhone = requirePhone(input.contactPhone)
  const contactName = optionalName(input.contactName)

  const { data: connection, error: connectionError } = await db
    .from("whatsapp_connections")
    .select("id")
    .eq("id", connectionId)
    .eq("company_id", companyId)
    .maybeSingle<{ id: string }>()
  if (connectionError) throw new WhatsAppConversationError("database_error")
  if (!connection) throw new WhatsAppConversationError("connection_not_found")

  const existing = await selectConversationByContact(db, companyId, connectionId, contactPhone)
  if (existing) return refreshContactName(db, existing, contactName)

  const { data: created, error: insertError } = await db
    .from("whatsapp_conversations")
    .insert({
      company_id: companyId,
      whatsapp_connection_id: connectionId,
      contact_phone: contactPhone,
      contact_name: contactName,
    })
    .select(CONVERSATION_COLUMNS)
    .single<WhatsAppConversation>()

  if (!insertError) return created

  if (insertError.code === UNIQUE_VIOLATION) {
    // Outro evento criou a conversa entre o SELECT e o INSERT.
    const raced = await selectConversationByContact(db, companyId, connectionId, contactPhone)
    if (raced) return refreshContactName(db, raced, contactName)
  }
  throw new WhatsAppConversationError("database_error")
}

async function refreshContactName(
  db: SupabaseClient,
  conversation: WhatsAppConversation,
  contactName: string | null,
): Promise<WhatsAppConversation> {
  if (!contactName || contactName === conversation.contact_name) return conversation

  const { data, error } = await db
    .from("whatsapp_conversations")
    .update({ contact_name: contactName })
    .eq("id", conversation.id)
    .eq("company_id", conversation.company_id)
    .select(CONVERSATION_COLUMNS)
    .single<WhatsAppConversation>()
  if (error) throw new WhatsAppConversationError("database_error")
  return data
}

async function findMessageByWhatsAppId(db: SupabaseClient, whatsappMessageId: string): Promise<WhatsAppMessage | null> {
  const { data, error } = await db
    .from("whatsapp_messages")
    .select(MESSAGE_COLUMNS)
    .eq("whatsapp_message_id", whatsappMessageId)
    .maybeSingle<WhatsAppMessage>()
  if (error) throw new WhatsAppConversationError("database_error")
  return data
}

/**
 * Devolve a mensagem já gravada somente se ela é desta conversa e desta empresa.
 * Um wamid existente em outro lugar nunca é devolvido (nem vaza dados).
 */
function duplicateOrConflict(
  existing: WhatsAppMessage,
  conversationId: string,
  companyId: string,
): SaveWhatsAppMessageResult {
  if (existing.conversation_id !== conversationId || existing.company_id !== companyId) {
    throw new WhatsAppConversationError("message_id_conflict")
  }
  return { message: existing, duplicate: true }
}

type MessageRow = {
  conversation_id: string
  company_id: string
  direction: "inbound" | "outbound"
  message_type: WhatsAppMessageType
  whatsapp_message_id: string | null
  sender_phone: string | null
  recipient_phone: string | null
  text_content: string | null
  status: WhatsAppMessageStatus
}

async function insertMessageIdempotently(db: SupabaseClient, row: MessageRow): Promise<SaveWhatsAppMessageResult> {
  await assertConversationBelongsToCompany(db, row.conversation_id, row.company_id)

  if (row.whatsapp_message_id) {
    const existing = await findMessageByWhatsAppId(db, row.whatsapp_message_id)
    if (existing) return duplicateOrConflict(existing, row.conversation_id, row.company_id)
  }

  // O trigger do banco atualiza last_message_at e updated_at da conversa no mesmo
  // INSERT. O status da conversa não é alterado.
  const { data, error } = await db.from("whatsapp_messages").insert(row).select(MESSAGE_COLUMNS).single<WhatsAppMessage>()
  if (!error) return { message: data, duplicate: false }

  if (error.code === UNIQUE_VIOLATION && row.whatsapp_message_id) {
    // Reenvio concorrente da Meta: o outro evento ganhou a corrida.
    const raced = await findMessageByWhatsAppId(db, row.whatsapp_message_id)
    if (raced) return duplicateOrConflict(raced, row.conversation_id, row.company_id)
  }
  throw new WhatsAppConversationError("database_error")
}

/** Grava uma mensagem recebida. Idempotente por whatsappMessageId. */
export async function saveWhatsAppInboundMessage(
  input: {
    conversationId: string
    companyId: string
    whatsappMessageId: string
    senderPhone: string
    textContent?: string | null
    messageType: WhatsAppMessageType
  },
  db: SupabaseClient = createAdminClient(),
): Promise<SaveWhatsAppMessageResult> {
  return insertMessageIdempotently(db, {
    conversation_id: requireUuid(input.conversationId),
    company_id: requireUuid(input.companyId),
    direction: "inbound",
    message_type: requireMessageType(input.messageType),
    whatsapp_message_id: requireMessageId(input.whatsappMessageId),
    sender_phone: requirePhone(input.senderPhone),
    recipient_phone: null,
    text_content: optionalText(input.textContent),
    status: "received",
  })
}

/**
 * Grava uma mensagem enviada. O whatsappMessageId (wamid devolvido pela Meta) é
 * opcional; quando existe, a gravação é idempotente por ele.
 */
export async function saveWhatsAppOutboundMessage(
  input: {
    conversationId: string
    companyId: string
    whatsappMessageId?: string | null
    recipientPhone: string
    textContent?: string | null
    messageType: WhatsAppMessageType
    /** Padrão "sent". Use "failed" para registrar um envio que falhou. */
    status?: WhatsAppOutboundStatus
  },
  db: SupabaseClient = createAdminClient(),
): Promise<SaveWhatsAppMessageResult> {
  const status = input.status ?? "sent"
  if (!["sent", "delivered", "read", "failed"].includes(status)) throw new WhatsAppConversationError("invalid_input")

  return insertMessageIdempotently(db, {
    conversation_id: requireUuid(input.conversationId),
    company_id: requireUuid(input.companyId),
    direction: "outbound",
    message_type: requireMessageType(input.messageType),
    whatsapp_message_id:
      input.whatsappMessageId === undefined || input.whatsappMessageId === null
        ? null
        : requireMessageId(input.whatsappMessageId),
    sender_phone: null,
    recipient_phone: requirePhone(input.recipientPhone),
    text_content: optionalText(input.textContent),
    status,
  })
}

/**
 * Últimas mensagens da conversa, em ordem cronológica. Falha com
 * conversation_not_found se a conversa não for da empresa.
 */
export async function getWhatsAppConversationMessages(
  input: { conversationId: string; companyId: string; limit?: number },
  db: SupabaseClient = createAdminClient(),
): Promise<WhatsAppMessage[]> {
  const conversationId = requireUuid(input.conversationId)
  const companyId = requireUuid(input.companyId)

  let limit = DEFAULT_MESSAGES_LIMIT
  if (input.limit !== undefined) {
    if (typeof input.limit !== "number" || !Number.isFinite(input.limit)) {
      throw new WhatsAppConversationError("invalid_input")
    }
    limit = Math.min(Math.max(Math.floor(input.limit), 1), MAX_MESSAGES_LIMIT)
  }

  await assertConversationBelongsToCompany(db, conversationId, companyId)

  const { data, error } = await db
    .from("whatsapp_messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit)
    .returns<WhatsAppMessage[]>()
  if (error) throw new WhatsAppConversationError("database_error")
  return (data ?? []).slice().reverse()
}
