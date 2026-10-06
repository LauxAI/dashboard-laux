import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveWhatsAppCompany, type ResolvedWhatsAppCompany } from "./company"
import {
  findOrCreateWhatsAppConversation,
  saveWhatsAppInboundMessage,
  WhatsAppConversationError,
  type WhatsAppMessageType,
} from "./conversations"
import { logWebhook } from "./log"

/**
 * Liga as mensagens recebidas pelo webhook às conversas. Somente servidor.
 *
 * Recebe só o que o parser já extraiu do payload. O company_id nunca vem do evento:
 * ele é derivado exclusivamente da conexão (whatsapp_connections) resolvida pelo
 * phone_number_id. Qualquer campo extra no evento (inclusive um company_id forjado)
 * é ignorado, porque só os campos de InboundWhatsAppMessage são lidos.
 *
 * Esta etapa apenas grava: não responde ao WhatsApp e não chama IA.
 * Nenhum texto, telefone, nome de contato, token ou payload é registrado em log.
 */

export type InboundWhatsAppMessage = {
  phoneNumberId: string
  /** `from` da Meta (wa_id do remetente). */
  senderWaId: string
  /** wamid da Meta. */
  messageId: string
  messageType: string
  text: string | null
  contactName: string | null
  /** ISO 8601 do evento na Meta. Só para diagnóstico: a tabela não guarda esse horário. */
  timestamp: string | null
}

export type InboundResult =
  | { status: "saved" | "duplicate"; conversationId: string; messageType: WhatsAppMessageType }
  | { status: "ignored"; reason: "connection_not_configured" }
  | { status: "failed"; reason: WhatsAppConversationError["code"] | "connection_lookup_failed" | "unexpected" }

export type InboundOptions = {
  /** Cliente de serviço. Omitido = createAdminClient() (usado em produção). */
  db?: SupabaseClient
  /** Resolve a conexão ativa. Omitido = resolveWhatsAppCompany. Permite reutilizar a consulta do webhook. */
  resolveConnection?: (phoneNumberId: string) => Promise<ResolvedWhatsAppCompany | null>
  /**
   * Chamado depois que uma mensagem de TEXTO foi gravada (ou já existia). Serve para
   * disparar a resposta do agente. Pode ser chamado de novo em reenvios da Meta: quem
   * implementa precisa ser idempotente. Falhas aqui nunca afetam o resultado.
   */
  onMessageStored?: (context: {
    companyId: string
    conversationId: string
    inboundMessageId: string
    phoneNumberId: string
  }) => Promise<unknown>
}

function hasText(text: string | null): text is string {
  return typeof text === "string" && text.trim().length > 0
}

/**
 * Nesta etapa só texto é aceito. Qualquer outro tipo (imagem, áudio, sticker,
 * localização, reação...) ou texto vazio é registrado como "unknown", sem conteúdo,
 * para que a conversa mostre que algo chegou sem tentar interpretar a mídia.
 */
function classify(event: InboundWhatsAppMessage): { messageType: WhatsAppMessageType; textContent: string | null } {
  if (event.messageType === "text" && hasText(event.text)) return { messageType: "text", textContent: event.text }
  return { messageType: "unknown", textContent: null }
}

/**
 * Grava a mensagem recebida na conversa correta (criando-a se preciso). Idempotente
 * pelo wamid: reenvios da Meta e chamadas concorrentes resultam em 1 conversa e 1
 * mensagem, e o segundo processamento retorna "duplicate". Nunca lança: falhas viram
 * `{ status: "failed" }` para não derrubar o processamento do webhook.
 */
export async function processWhatsAppInboundMessage(
  event: InboundWhatsAppMessage,
  options: InboundOptions = {},
): Promise<InboundResult> {
  const { db } = options
  const resolveConnection = options.resolveConnection ?? ((id: string) => resolveWhatsAppCompany(id, db))
  const phoneNumberId = event.phoneNumberId
  const messageId = event.messageId

  let connection: ResolvedWhatsAppCompany | null
  try {
    connection = await resolveConnection(phoneNumberId)
  } catch (error) {
    logWebhook("error", "inbound_connection_lookup_failed", {
      phone_number_id: phoneNumberId,
      message_id: messageId,
      error: error instanceof Error ? error.name : "unknown",
    })
    return { status: "failed", reason: "connection_lookup_failed" }
  }

  if (!connection) {
    // Sem conexão cadastrada ou conexão inativa: nada é criado.
    logWebhook("info", "inbound_skipped_connection_not_configured", {
      phone_number_id: phoneNumberId,
      message_id: messageId,
    })
    return { status: "ignored", reason: "connection_not_configured" }
  }

  const { messageType, textContent } = classify(event)

  try {
    const conversation = await findOrCreateWhatsAppConversation(
      {
        whatsappConnectionId: connection.connection_id,
        companyId: connection.company_id,
        contactPhone: event.senderWaId,
        contactName: event.contactName,
      },
      db,
    )
    const { duplicate, message } = await saveWhatsAppInboundMessage(
      {
        conversationId: conversation.id,
        companyId: connection.company_id,
        whatsappMessageId: messageId,
        senderPhone: event.senderWaId,
        textContent,
        messageType,
      },
      db,
    )

    logWebhook("info", duplicate ? "inbound_message_duplicate" : "inbound_message_saved", {
      phone_number_id: phoneNumberId,
      message_id: messageId,
      message_type: messageType,
      original_type: event.messageType,
      text_length: textContent?.length ?? 0,
      event_timestamp: event.timestamp,
    })

    if (options.onMessageStored && messageType === "text") {
      try {
        await options.onMessageStored({
          companyId: connection.company_id,
          conversationId: conversation.id,
          inboundMessageId: message.id,
          phoneNumberId,
        })
      } catch (error) {
        logWebhook("error", "inbound_after_store_failed", {
          phone_number_id: phoneNumberId,
          message_id: messageId,
          error: error instanceof Error ? error.name : "unknown",
        })
      }
    }
    return { status: duplicate ? "duplicate" : "saved", conversationId: conversation.id, messageType }
  } catch (error) {
    const reason = error instanceof WhatsAppConversationError ? error.code : "unexpected"
    logWebhook("error", "inbound_message_failed", {
      phone_number_id: phoneNumberId,
      message_id: messageId,
      reason,
      error: error instanceof Error ? error.name : "unknown",
    })
    return { status: "failed", reason }
  }
}
