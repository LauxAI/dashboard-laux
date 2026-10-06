import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAIAgentType, normalizeAIAgentConfig, validateAIAgentConfig } from "@/lib/domain/ai-agents"
import type { AIAgentConfig, AIAgentType } from "@/lib/domain/types"
import {
  getWhatsAppConversationMessages,
  WhatsAppConversationError,
  type WhatsAppConversationStatus,
  type WhatsAppMessage,
} from "./conversations"

/**
 * Acesso a dados do runner de respostas do agente. Somente servidor, sempre com a
 * service role. Toda consulta filtra por company_id; o companyId vem da conexão
 * resolvida pelo webhook, nunca do payload.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PHONE_PATTERN = /^\+?[0-9]{7,20}$/
const UNIQUE_VIOLATION = "23505"

/** Ordem de preferência quando a empresa tem mais de um agente ativo e válido. */
export const AGENT_PRIORITY: AIAgentType[] = ["atendimento", "vendas", "suporte"]

export type ReplyContext = {
  conversationStatus: WhatsAppConversationStatus
  contactPhone: string
  inbound: { id: string; messageType: string; textContent: string | null }
}

export type ActiveAgent = {
  type: AIAgentType
  config: AIAgentConfig
  companyName: string | null
}

export type ReplyClaim = { claimed: true; replyId: string } | { claimed: false }

export type ReplyStore = {
  loadContext(input: { companyId: string; conversationId: string; inboundMessageId: string }): Promise<ReplyContext | null>
  loadActiveAgent(companyId: string): Promise<ActiveAgent | null>
  claim(input: {
    companyId: string
    conversationId: string
    inboundMessageId: string
    recipientPhone: string
  }): Promise<ReplyClaim>
  finalize(input: {
    companyId: string
    replyId: string
    status: "sent" | "failed"
    whatsappMessageId?: string | null
    textContent?: string | null
  }): Promise<void>
  loadHistory(input: { companyId: string; conversationId: string }): Promise<WhatsAppMessage[]>
  recordUsage(input: {
    companyId: string
    agentType: AIAgentType
    status: "success" | "error"
    inputTokens?: number
    outputTokens?: number
    latencyMs?: number
  }): Promise<void>
}

const fail = (code: WhatsAppConversationError["code"] = "invalid_input") => new WhatsAppConversationError(code)

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw fail()
  return value
}

function phone(value: unknown): string {
  if (typeof value !== "string" || !PHONE_PATTERN.test(value.trim())) throw fail()
  return value.trim()
}

export function createReplyStore(db: SupabaseClient = createAdminClient()): ReplyStore {
  return {
    async loadContext(input) {
      const companyId = uuid(input.companyId)
      const conversationId = uuid(input.conversationId)
      const inboundId = uuid(input.inboundMessageId)

      const { data: conversation, error: conversationError } = await db
        .from("whatsapp_conversations")
        .select("status, contact_phone")
        .eq("id", conversationId)
        .eq("company_id", companyId)
        .maybeSingle<{ status: WhatsAppConversationStatus; contact_phone: string }>()
      if (conversationError) throw fail("database_error")
      if (!conversation) return null

      const { data: inbound, error: inboundError } = await db
        .from("whatsapp_messages")
        .select("id, message_type, text_content")
        .eq("id", inboundId)
        .eq("conversation_id", conversationId)
        .eq("company_id", companyId)
        .eq("direction", "inbound")
        .maybeSingle<{ id: string; message_type: string; text_content: string | null }>()
      if (inboundError) throw fail("database_error")
      if (!inbound) return null

      return {
        conversationStatus: conversation.status,
        contactPhone: conversation.contact_phone,
        inbound: { id: inbound.id, messageType: inbound.message_type, textContent: inbound.text_content },
      }
    },

    async loadActiveAgent(companyIdInput) {
      const companyId = uuid(companyIdInput)
      const { data, error } = await db
        .from("ai_agent_settings")
        .select("agent_type, config")
        .eq("company_id", companyId)
        .eq("status", "ativo")
        .returns<{ agent_type: string; config: unknown }[]>()
      if (error) throw fail("database_error")

      const usable = new Map<AIAgentType, AIAgentConfig>()
      for (const row of data ?? []) {
        if (!isAIAgentType(row.agent_type)) continue
        const config = normalizeAIAgentConfig(row.agent_type, row.config)
        if (validateAIAgentConfig(row.agent_type, config) === null) usable.set(row.agent_type, config)
      }
      const type = AGENT_PRIORITY.find((candidate) => usable.has(candidate))
      if (!type) return null

      const { data: company } = await db
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .maybeSingle<{ name: string | null }>()
      return { type, config: usable.get(type) as AIAgentConfig, companyName: company?.name ?? null }
    },

    async claim(input) {
      const { data, error } = await db
        .from("whatsapp_messages")
        .insert({
          conversation_id: uuid(input.conversationId),
          company_id: uuid(input.companyId),
          direction: "outbound",
          message_type: "text",
          recipient_phone: phone(input.recipientPhone),
          status: "pending",
          reply_to_message_id: uuid(input.inboundMessageId),
        })
        .select("id")
        .single<{ id: string }>()
      if (!error) return { claimed: true, replyId: data.id }
      // Índice único parcial: outra execução já reservou a resposta desta mensagem.
      if (error.code === UNIQUE_VIOLATION) return { claimed: false }
      throw fail("database_error")
    },

    async finalize(input) {
      const { data, error } = await db
        .from("whatsapp_messages")
        .update({
          status: input.status,
          whatsapp_message_id: input.whatsappMessageId ?? null,
          text_content: input.textContent ?? null,
        })
        .eq("id", uuid(input.replyId))
        .eq("company_id", uuid(input.companyId))
        .eq("direction", "outbound")
        .eq("status", "pending")
        .select("id")
      if (error || !data || data.length === 0) throw fail("database_error")
    },

    loadHistory(input) {
      return getWhatsAppConversationMessages({ ...input, limit: 20 }, db)
    },

    async recordUsage(input) {
      const { error } = await db.from("ai_agent_usage").insert({
        company_id: uuid(input.companyId),
        user_id: null,
        agent_type: input.agentType,
        source: "conversation",
        status: input.status,
        input_tokens: input.inputTokens ?? null,
        output_tokens: input.outputTokens ?? null,
        latency_ms: input.latencyMs ?? null,
      })
      if (error) throw fail("database_error")
    },
  }
}
