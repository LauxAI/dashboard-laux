import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ToolSet } from "ai"
import type { SpecialistsConfig } from "@/lib/domain/types"
import { generateAgentReply, type AgentReply, type AgentRunInput } from "@/lib/ai/agent-runner"
import { buildSchedulingTools, loadSpecialistContext } from "@/lib/ai/specialist-tools"
import type { SpecialistContext } from "@/lib/ai/specialists"
import { TEST_LIMITS, type ChatMessage } from "@/lib/ai/request"
import { createAdminClient } from "@/lib/supabase/admin"
import type { WhatsAppMessage } from "./conversations"
import { logWebhook } from "./log"
import { createReplyStore, type ReplyStore } from "./reply-store"
import { MAX_TEXT_LENGTH, sendWhatsAppText } from "./send"

/**
 * Responde automaticamente uma mensagem de texto recebida usando o agente ativo da
 * empresa. Somente servidor. Nunca lança.
 *
 * Fluxo: valida conversa e mensagem -> escolhe o agente ativo -> reserva a resposta
 * (INSERT 'pending' com reply_to_message_id, único por mensagem recebida) -> gera o
 * texto -> envia pela Cloud API -> grava 'sent' ou 'failed'.
 *
 * A reserva é o que impede resposta duplicada: reenvio da Meta ou execução
 * concorrente perdem o INSERT e saem com "already_handled". Uma reserva que ficou
 * 'pending' ou 'failed' nunca é reenviada automaticamente (evita mensagem em dobro).
 *
 * Só responde a conversas 'open'; 'handoff' e 'closed' ficam para atendimento humano.
 * O telefone de destino vem da conversa gravada, nunca do evento. Nada de texto,
 * telefone, token ou resposta bruta da Meta é registrado em log.
 */

export type AgentReplyContext = {
  companyId: string
  conversationId: string
  /** id (uuid) da linha da mensagem recebida em whatsapp_messages. */
  inboundMessageId: string
  phoneNumberId: string
}

export type AgentReplyResult =
  | { status: "sent"; replyId: string }
  | {
      status: "skipped"
      reason: "context_not_found" | "conversation_not_open" | "not_text" | "no_active_agent" | "already_handled"
    }
  | {
      status: "failed"
      reason:
        | "context_lookup_failed"
        | "agent_lookup_failed"
        | "claim_failed"
        | "generation_failed"
        | "send_failed"
        | "finalize_failed"
    }

export type AgentReplyDeps = {
  /** Cliente de serviço. Omitido = createAdminClient(). */
  db?: SupabaseClient
  store?: ReplyStore
  generate?: (input: AgentRunInput) => Promise<AgentReply>
  send?: typeof sendWhatsAppText
  now?: () => number
}

const HISTORY_FETCH_LIMIT = 20

/**
 * Monta o histórico para o modelo: só texto, só mensagens efetivamente trocadas
 * (respostas pendentes/falhas ficam de fora), até a mensagem que está sendo
 * respondida. Mensagens seguidas do mesmo autor viram uma só, o histórico começa e
 * termina com o cliente, e cada conteúdo respeita os limites do playground.
 */
export function buildConversationHistory(messages: WhatsAppMessage[], inbound: { id: string; text: string }): ChatMessage[] {
  const usable = messages.filter((message) => {
    if (message.message_type !== "text" || !message.text_content?.trim()) return false
    return message.direction === "inbound" || ["sent", "delivered", "read"].includes(message.status)
  })

  const upToInbound = (() => {
    const index = usable.findIndex((message) => message.id === inbound.id)
    return index === -1 ? null : usable.slice(0, index + 1)
  })()

  const chat: ChatMessage[] = []
  const push = (role: ChatMessage["role"], content: string) => {
    const limit = role === "user" ? TEST_LIMITS.maxUserChars : TEST_LIMITS.maxAssistantChars
    const text = content.trim().slice(0, limit)
    const last = chat[chat.length - 1]
    if (last && last.role === role) last.content = `${last.content}\n${text}`.slice(0, limit)
    else chat.push({ role, content: text })
  }

  if (upToInbound) {
    for (const message of upToInbound) push(message.direction === "inbound" ? "user" : "assistant", message.text_content as string)
  } else {
    push("user", inbound.text)
  }

  while (chat.length > 0 && chat[0].role !== "user") chat.shift()
  return chat
}

export async function processWhatsAppAgentReply(
  context: AgentReplyContext,
  deps: AgentReplyDeps = {},
): Promise<AgentReplyResult> {
  const base = { phone_number_id: context.phoneNumberId, inbound_message_id: context.inboundMessageId }
  try {
    return await run(context, deps, base)
  } catch (error) {
    logWebhook("error", "agent_reply_unexpected_error", { ...base, error: error instanceof Error ? error.name : "unknown" })
    return { status: "failed", reason: "context_lookup_failed" }
  }
}

async function run(
  context: AgentReplyContext,
  deps: AgentReplyDeps,
  base: Record<string, string>,
): Promise<AgentReplyResult> {
  const store = deps.store ?? createReplyStore(deps.db)
  const generate = deps.generate ?? generateAgentReply
  const send = deps.send ?? ((input) => sendWhatsAppText(input, { db: deps.db }))
  const now = deps.now ?? Date.now
  const { companyId, conversationId, inboundMessageId } = context

  let replyContext: Awaited<ReturnType<ReplyStore["loadContext"]>>
  try {
    replyContext = await store.loadContext({ companyId, conversationId, inboundMessageId })
  } catch (error) {
    logWebhook("error", "agent_reply_context_failed", { ...base, error: errorName(error) })
    return { status: "failed", reason: "context_lookup_failed" }
  }
  if (!replyContext) return skip("context_not_found", base)
  if (replyContext.conversationStatus !== "open") return skip("conversation_not_open", base)

  const inboundText = replyContext.inbound.textContent
  if (replyContext.inbound.messageType !== "text" || !inboundText?.trim()) return skip("not_text", base)

  let agent: Awaited<ReturnType<ReplyStore["loadActiveAgent"]>>
  try {
    agent = await store.loadActiveAgent(companyId)
  } catch (error) {
    logWebhook("error", "agent_reply_agent_lookup_failed", { ...base, error: errorName(error) })
    return { status: "failed", reason: "agent_lookup_failed" }
  }
  if (!agent) return skip("no_active_agent", base)

  let claim: Awaited<ReturnType<ReplyStore["claim"]>>
  try {
    claim = await store.claim({
      companyId,
      conversationId,
      inboundMessageId,
      recipientPhone: replyContext.contactPhone,
    })
  } catch (error) {
    logWebhook("error", "agent_reply_claim_failed", { ...base, error: errorName(error) })
    return { status: "failed", reason: "claim_failed" }
  }
  if (!claim.claimed) return skip("already_handled", base)
  const replyId = claim.replyId

  const startedAt = now()
  let reply: AgentReply
  try {
    const history = await store.loadHistory({ companyId, conversationId })
    const messages = buildConversationHistory(history.slice(-HISTORY_FETCH_LIMIT), {
      id: inboundMessageId,
      text: inboundText,
    })
    const { specialists, tools } = await resolveSpecialists({
      db: deps.db,
      companyId,
      agent,
      contactPhone: replyContext.contactPhone,
      base,
    })
    reply = await generate({
      type: agent.type,
      config: agent.config,
      companyName: agent.companyName,
      messages,
      specialists,
      tools,
      abortSignal: AbortSignal.timeout(45_000),
    })
  } catch (error) {
    logWebhook("error", "agent_reply_generation_failed", { ...base, agent_type: agent.type, error: errorName(error) })
    await safely(() => store.recordUsage({ companyId, agentType: agent.type, status: "error", latencyMs: now() - startedAt }))
    await finalize(store, { companyId, replyId, status: "failed" }, base)
    return { status: "failed", reason: "generation_failed" }
  }

  const text = reply.text.slice(0, MAX_TEXT_LENGTH)
  await safely(() =>
    store.recordUsage({
      companyId,
      agentType: agent.type,
      status: "success",
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
      latencyMs: now() - startedAt,
    }),
  )

  const sent = await send({ phoneNumberId: context.phoneNumberId, to: replyContext.contactPhone, text })
  if (!sent.ok) {
    logWebhook("warn", "agent_reply_send_failed", {
      ...base,
      error: sent.error,
      http_status: sent.httpStatus,
      graph_error_code: sent.graphErrorCode,
    })
    await finalize(store, { companyId, replyId, status: "failed", textContent: text }, base)
    return { status: "failed", reason: "send_failed" }
  }

  const stored = await finalize(
    store,
    { companyId, replyId, status: "sent", whatsappMessageId: sent.messageId, textContent: text },
    base,
  )
  logWebhook("info", "agent_reply_sent", { ...base, agent_type: agent.type, reply_length: text.length })
  // A mensagem já foi entregue ao cliente; se o registro falhar, a reserva continua
  // impedindo um segundo envio.
  return stored ? { status: "sent", replyId } : { status: "failed", reason: "finalize_failed" }
}

async function resolveSpecialists(input: {
  db?: SupabaseClient
  companyId: string
  agent: { type: string; config: { specialists: Record<string, boolean> } }
  contactPhone: string
  base: Record<string, string>
}): Promise<{ specialists?: SpecialistContext; tools?: ToolSet }> {
  if (input.agent.type !== "atendimento" || !Object.values(input.agent.config.specialists).some(Boolean)) return {}
  try {
    const db = input.db ?? createAdminClient()
    const specialists = await loadSpecialistContext(db, input.companyId, input.agent.config.specialists as SpecialistsConfig)
    const tools = specialists.scheduling
      ? buildSchedulingTools(specialists.scheduling, { db, companyId: input.companyId, contactPhone: input.contactPhone, dryRun: false })
      : undefined
    return { specialists, tools }
  } catch (error) {
    // Sem especialistas o Atendimento ainda responde, só com o próprio conhecimento.
    logWebhook("warn", "agent_reply_specialists_failed", { ...input.base, error: errorName(error) })
    return {}
  }
}

function skip(reason: Extract<AgentReplyResult, { status: "skipped" }>["reason"], base: Record<string, string>): AgentReplyResult {
  logWebhook("info", "agent_reply_skipped", { ...base, reason })
  return { status: "skipped", reason }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown"
}

async function safely(action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch (error) {
    logWebhook("warn", "agent_reply_usage_record_failed", { error: errorName(error) })
  }
}

async function finalize(
  store: ReplyStore,
  input: Parameters<ReplyStore["finalize"]>[0],
  base: Record<string, string>,
): Promise<boolean> {
  try {
    await store.finalize(input)
    return true
  } catch (error) {
    logWebhook("error", "agent_reply_finalize_failed", { ...base, status: input.status, error: errorName(error) })
    return false
  }
}
