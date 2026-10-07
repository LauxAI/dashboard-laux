import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { processWhatsAppAgentReply } from "@/lib/whatsapp/agent-reply"
import { listConnectionsForCompany } from "@/lib/whatsapp/connections"
import { findOrCreateWhatsAppConversation, saveWhatsAppOutboundMessage } from "@/lib/whatsapp/conversations"
import { sendWhatsAppText } from "@/lib/whatsapp/send"
import type { ActionExecutor, ActionResult, ExecutionContext } from "./engine"
import { logAutomation } from "./log"
import { renderMessage } from "./conditions"
import type { ActionStep, EventValue } from "./types"

export type ExecutorDeps = {
  db?: SupabaseClient
  send?: typeof sendWhatsAppText
  runAgent?: typeof processWhatsAppAgentReply
}

const fail = (code: string, message: string): ActionResult => ({ ok: false, code, message })
const databaseFailure = () => fail("database_error", "Não foi possível salvar os dados.")
const missing = (what: string) => fail("missing_context", `${what} não está disponível neste evento.`)

function text(data: Record<string, EventValue>, key: string): string | null {
  const value = data[key]
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

export function createActionExecutor(deps: ExecutorDeps = {}): ActionExecutor {
  const db = deps.db ?? createAdminClient()
  const send = deps.send ?? sendWhatsAppText
  const runAgent = deps.runAgent ?? processWhatsAppAgentReply

  async function sendMessage(step: ActionStep, { companyId, data }: ExecutionContext): Promise<ActionResult> {
    const phone = text(data, "contactPhone")
    if (!phone) return missing("O telefone do contato")

    const message = renderMessage(step.params.message ?? "", {
      nome: text(data, "contactName") ?? "",
      telefone: phone,
    }).trim()
    if (!message) return fail("empty_message", "A mensagem está vazia.")

    let connections
    try {
      connections = await listConnectionsForCompany(companyId, db)
    } catch {
      return fail("connection_lookup_failed", "Não foi possível consultar a conexão do WhatsApp.")
    }
    const active = connections.filter((connection) => connection.status === "active")
    const preferred = text(data, "phoneNumberId")
    const connection = active.find((item) => item.phone_number_id === preferred) ?? active[0]
    if (!connection) return fail("no_whatsapp_connection", "Não há WhatsApp conectado e ativo.")

    const result = await send({ phoneNumberId: connection.phone_number_id, to: phone, text: message }, { db })
    if (!result.ok) return fail(`send_${result.error}`, "Não foi possível enviar a mensagem pelo WhatsApp.")

    try {
      const conversationId =
        text(data, "conversationId") ??
        (
          await findOrCreateWhatsAppConversation(
            {
              whatsappConnectionId: connection.id,
              companyId,
              contactPhone: phone,
              contactName: text(data, "contactName"),
            },
            db,
          )
        ).id
      await saveWhatsAppOutboundMessage(
        {
          conversationId,
          companyId,
          whatsappMessageId: result.messageId,
          recipientPhone: phone,
          textContent: message,
          messageType: "text",
        },
        db,
      )
    } catch {
      // A mensagem já saiu: falha ao registrar o histórico não pode virar falha do envio.
      logAutomation("warn", "outbound_history_not_saved", { companyId })
    }
    return { ok: true, outcome: "done" }
  }

  async function runAgentStep({ companyId, data }: ExecutionContext): Promise<ActionResult> {
    const conversationId = text(data, "conversationId")
    const inboundMessageId = text(data, "inboundMessageId")
    const phoneNumberId = text(data, "phoneNumberId")
    if (!conversationId || !inboundMessageId || !phoneNumberId) return missing("A mensagem recebida")

    const result = await runAgent({ companyId, conversationId, inboundMessageId, phoneNumberId }, { db })
    if (result.status === "sent") return { ok: true, outcome: "done" }
    if (result.status === "skipped") return { ok: true, outcome: "skipped", detail: result.reason }
    return fail(`agent_${result.reason}`, "O agente de IA não conseguiu responder.")
  }

  async function handoff({ companyId, data }: ExecutionContext): Promise<ActionResult> {
    const conversationId = text(data, "conversationId")
    if (!conversationId) return missing("A conversa")
    const { data: rows, error } = await db
      .from("whatsapp_conversations")
      .update({ status: "handoff" })
      .eq("id", conversationId)
      .eq("company_id", companyId)
      .select("id")
    if (error) return databaseFailure()
    if (!rows || rows.length === 0) return fail("conversation_not_found", "A conversa não foi encontrada.")
    return { ok: true, outcome: "done" }
  }

  async function createContact(table: "leads" | "clients", step: ActionStep, { companyId, data }: ExecutionContext): Promise<ActionResult> {
    const phone = text(data, "contactPhone")
    if (!phone) return missing("O telefone do contato")

    const existing = await db.from(table).select("id").eq("company_id", companyId).eq("phone", phone).limit(1)
    if (existing.error) return databaseFailure()
    const key = table === "leads" ? "leadId" : "clientId"
    if (existing.data && existing.data.length > 0) {
      return { ok: true, outcome: "skipped", detail: "já existia", data: { [key]: String(existing.data[0].id) } }
    }

    const row: Record<string, unknown> = {
      company_id: companyId,
      name: (text(data, "contactName") ?? phone).slice(0, 120),
      phone,
    }
    if (table === "leads") {
      row.source = step.params.source || "whatsapp"
    } else {
      row.source = "whatsapp"
    }
    const inserted = await db.from(table).insert(row).select("id").single<{ id: string }>()
    if (inserted.error || !inserted.data) return databaseFailure()
    return { ok: true, outcome: "done", data: { [key]: inserted.data.id } }
  }

  async function updateLeadStatus(step: ActionStep, { companyId, data }: ExecutionContext): Promise<ActionResult> {
    const leadId = text(data, "leadId")
    if (!leadId) return missing("O lead")
    const status = step.params.status
    if (!status) return fail("missing_param", "Escolha o novo status do lead.")
    const { data: rows, error } = await db
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("company_id", companyId)
      .select("id")
    if (error) return databaseFailure()
    if (!rows || rows.length === 0) return fail("lead_not_found", "O lead não foi encontrado.")
    return { ok: true, outcome: "done" }
  }

  async function addLeadNote(step: ActionStep, { companyId, data }: ExecutionContext): Promise<ActionResult> {
    const leadId = text(data, "leadId")
    if (!leadId) return missing("O lead")
    const note = (step.params.note ?? "").trim()
    if (!note) return fail("empty_note", "A anotação está vazia.")

    const current = await db.from("leads").select("notes").eq("id", leadId).eq("company_id", companyId).maybeSingle<{ notes: string | null }>()
    if (current.error) return databaseFailure()
    if (!current.data) return fail("lead_not_found", "O lead não foi encontrado.")

    const stamp = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    const entry = `[Automação ${stamp}] ${note}`
    const notes = current.data.notes ? `${current.data.notes}\n${entry}` : entry
    const { error } = await db.from("leads").update({ notes, updated_at: new Date().toISOString() }).eq("id", leadId).eq("company_id", companyId)
    if (error) return databaseFailure()
    return { ok: true, outcome: "done" }
  }

  async function setAppointmentStatus(status: "confirmado" | "cancelado", { companyId, data }: ExecutionContext): Promise<ActionResult> {
    const appointmentId = text(data, "appointmentId")
    if (!appointmentId) return missing("O agendamento")
    const { data: rows, error } = await db
      .from("appointments")
      .update({ status })
      .eq("id", appointmentId)
      .eq("company_id", companyId)
      .select("id")
    if (error) return databaseFailure()
    if (!rows || rows.length === 0) return fail("appointment_not_found", "O agendamento não foi encontrado.")
    return { ok: true, outcome: "done" }
  }

  async function notifyTeam(step: ActionStep, { companyId, data }: ExecutionContext): Promise<ActionResult> {
    const title = (step.params.title ?? "").trim() || "Aviso de automação"
    const message = renderMessage(step.params.message ?? "", {
      nome: text(data, "contactName") ?? "",
      telefone: text(data, "contactPhone") ?? "",
    }).trim()
    const { error } = await db
      .from("notifications")
      .insert({ company_id: companyId, title: title.slice(0, 120), message: message || null, type: "sistema" })
    if (error) return databaseFailure()
    return { ok: true, outcome: "done" }
  }

  return async (step, context) => {
    switch (step.kind) {
      case "whatsapp.send_message":
        return sendMessage(step, context)
      case "whatsapp.run_agent":
        return runAgentStep(context)
      case "whatsapp.handoff":
        return handoff(context)
      case "lead.create":
        return createContact("leads", step, context)
      case "client.create":
        return createContact("clients", step, context)
      case "lead.update_status":
        return updateLeadStatus(step, context)
      case "lead.add_note":
        return addLeadNote(step, context)
      case "appointment.confirm":
        return setAppointmentStatus("confirmado", context)
      case "appointment.cancel":
        return setAppointmentStatus("cancelado", context)
      case "team.notify":
        return notifyTeam(step, context)
      default:
        return fail("unknown_action", "Ação desconhecida.")
    }
  }
}
