import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { jsonSchema, tool, type ToolSet } from "ai"
import { isAIAgentType, normalizeAIAgentConfig, specialistAgentType, validateAIAgentConfig } from "@/lib/domain/ai-agents"
import { normalizeSchedulingAgentConfig, validateSchedulingAgentConfig } from "@/lib/domain/scheduling-agent"
import type { AIAgentConfig, AIAgentType, SchedulingAgentConfig, SpecialistsConfig } from "@/lib/domain/types"
import {
  bookAppointment,
  cancelAppointment,
  confirmAppointment,
  findAvailableSlots,
  listClientAppointments,
  loadSchedulingContext,
  rescheduleAppointment,
} from "@/lib/scheduling/store"
import type { SpecialistContext } from "./specialists"

/**
 * Carrega os especialistas habilitados no Atendimento. Só entram os que estão
 * ativos e com configuração válida; os demais são ignorados em silêncio.
 */
export async function loadSpecialistContext(
  db: SupabaseClient,
  companyId: string,
  enabled: SpecialistsConfig,
): Promise<SpecialistContext> {
  const context: SpecialistContext = {}
  const wanted: AIAgentType[] = []
  if (enabled.sales) wanted.push(specialistAgentType.sales)
  if (enabled.support) wanted.push(specialistAgentType.support)

  const [agents, scheduling] = await Promise.all([
    wanted.length
      ? db
          .from("ai_agent_settings")
          .select("agent_type, config")
          .eq("company_id", companyId)
          .eq("status", "ativo")
          .in("agent_type", wanted)
          .returns<{ agent_type: string; config: unknown }[]>()
      : Promise.resolve({ data: [] as { agent_type: string; config: unknown }[], error: null }),
    enabled.scheduling
      ? db
          .from("scheduling_agent_settings")
          .select("config")
          .eq("company_id", companyId)
          .eq("status", "ativo")
          .maybeSingle<{ config: unknown }>()
      : Promise.resolve({ data: null, error: null }),
  ])

  for (const row of agents.data ?? []) {
    if (!isAIAgentType(row.agent_type)) continue
    const config: AIAgentConfig = normalizeAIAgentConfig(row.agent_type, row.config)
    if (validateAIAgentConfig(row.agent_type, config) !== null) continue
    if (row.agent_type === "vendas") context.sales = config
    if (row.agent_type === "suporte") context.support = config
  }

  if (scheduling.data) {
    const config = normalizeSchedulingAgentConfig(scheduling.data.config)
    if (validateSchedulingAgentConfig(config) === null) context.scheduling = config
  }
  return context
}

export type SchedulingToolRuntime = {
  db: SupabaseClient
  companyId: string
  /** Telefone da conversa (WhatsApp). Ausente no playground. */
  contactPhone: string | null
  /** No playground nada é gravado: consultas são reais, ações são simuladas. */
  dryRun: boolean
}

type Args = Record<string, unknown>
const str = (args: Args, key: string) => (typeof args[key] === "string" ? (args[key] as string).trim() : "")

const object = (properties: Record<string, unknown>, required: string[] = []) =>
  jsonSchema<Args>({ type: "object", properties, required, additionalProperties: false } as Parameters<typeof jsonSchema>[0])

const prop = {
  date: { type: "string", description: "Data local no formato AAAA-MM-DD. Omita para buscar a partir de hoje." },
  serviceId: { type: "string", description: "ID do serviço, obtido em listar_servicos." },
  startsAt: { type: "string", description: "Início do horário em ISO 8601, exatamente como devolvido por consultar_horarios." },
  appointmentId: { type: "string", description: "ID do agendamento, obtido em consultar_meus_agendamentos." },
}

const failure = (message: string, code: string) => ({ ok: false as const, code, message })

/** Ferramentas do especialista de Agendamento, limitadas ao que a configuração permite. */
export function buildSchedulingTools(config: SchedulingAgentConfig, runtime: SchedulingToolRuntime): ToolSet {
  const { behavior } = config
  const { db, companyId, contactPhone, dryRun } = runtime
  const tools: ToolSet = {}

  tools.listar_servicos = tool({
    description: "Lista os serviços disponíveis para agendamento, com a duração de cada um.",
    inputSchema: object({}),
    execute: async () => {
      const loaded = await loadSchedulingContext(db, companyId)
      if (!loaded.ok) return failure(loaded.message, loaded.code)
      return { ok: true, services: loaded.data.services.map((s) => ({ id: s.id, nome: s.name, duracao_minutos: s.durationMinutes })) }
    },
  })

  if (behavior.offerAvailableSlots || behavior.allowBooking || behavior.allowRescheduling) {
    tools.consultar_horarios = tool({
      description:
        "Consulta horários livres reais da agenda, a partir de uma data. Retorna os próximos dias com vaga. Use antes de oferecer qualquer horário.",
      inputSchema: object({ data: prop.date, servico_id: prop.serviceId }),
      execute: async (args) => {
        const result = await findAvailableSlots(db, companyId, { fromDate: str(args, "data") || undefined, serviceId: str(args, "servico_id") || null })
        if (!result.ok) return failure(result.message, result.code)
        return {
          ok: true,
          fuso_horario: result.data.timezone,
          duracao_minutos: result.data.durationMinutes,
          dias: result.data.days.map((day) => ({
            data: day.date,
            horarios: day.slots.map((slot) => ({ inicio: slot.startsAt, hora: slot.label })),
          })),
          observacao: result.data.days.length === 0 ? "Não há horários livres nos próximos dias." : undefined,
        }
      },
    })
  }

  if (behavior.allowBooking) {
    tools.criar_agendamento = tool({
      description: "Cria um agendamento em um horário devolvido por consultar_horarios, depois que o cliente confirmar data e hora.",
      inputSchema: object(
        {
          inicio: prop.startsAt,
          servico_id: prop.serviceId,
          nome_cliente: { type: "string", description: "Nome do cliente." },
          telefone_cliente: { type: "string", description: "Telefone do cliente, se informado." },
          email_cliente: { type: "string", description: "E-mail do cliente, se informado." },
        },
        ["inicio"],
      ),
      execute: async (args) => {
        const name = str(args, "nome_cliente")
        const phone = contactPhone ?? str(args, "telefone_cliente")
        const email = str(args, "email_cliente")
        if (behavior.askName && !name) return failure("Pergunte o nome do cliente antes de agendar.", "name_required")
        if (behavior.askPhone && !phone) return failure("Pergunte o telefone do cliente antes de agendar.", "phone_required")
        if (behavior.askEmail && !email) return failure("Pergunte o e-mail do cliente antes de agendar.", "email_required")
        const serviceId = str(args, "servico_id")
        if (behavior.askService && !serviceId) return failure("Pergunte qual serviço o cliente deseja antes de agendar.", "service_required")

        if (dryRun) {
          const check = await findAvailableSlots(db, companyId, { serviceId: serviceId || null, days: 14 })
          const listed = check.ok && check.data.days.some((day) => day.slots.some((slot) => slot.startsAt === str(args, "inicio")))
          return listed
            ? { ok: true, simulado: true, mensagem: "Simulação de teste: o horário está livre, mas nenhum agendamento real foi criado." }
            : failure("Esse horário não está disponível. Consulte outros horários.", "slot_unavailable")
        }

        const result = await bookAppointment(db, companyId, {
          startsAt: str(args, "inicio"),
          serviceId: serviceId || null,
          clientName: name || "Cliente",
          clientPhone: phone || null,
          clientEmail: email || null,
        })
        if (!result.ok) return failure(result.message, result.code)
        return { ok: true, agendamento: { id: result.data.id, servico: result.data.title, quando: result.data.whenLabel, status: result.data.status } }
      },
    })
  }

  const needsOwn = behavior.allowLookup || behavior.allowConfirmation || behavior.allowCancellation || behavior.allowRescheduling
  if (needsOwn) {
    tools.consultar_meus_agendamentos = tool({
      description: "Lista os próximos agendamentos do próprio cliente desta conversa.",
      inputSchema: object({}),
      execute: async () => {
        const result = await listClientAppointments(db, companyId, contactPhone)
        if (!result.ok) return failure(result.message, result.code)
        return {
          ok: true,
          agendamentos: result.data.map((a) => ({ id: a.id, servico: a.title, quando: a.whenLabel, status: a.status })),
          observacao: contactPhone ? undefined : "Não foi possível identificar o cliente pelo telefone neste canal.",
        }
      },
    })
  }

  const simulated = { ok: true, simulado: true, mensagem: "Simulação de teste: nenhuma alteração real foi feita." }

  if (behavior.allowConfirmation) {
    tools.confirmar_agendamento = tool({
      description: "Confirma um agendamento do próprio cliente.",
      inputSchema: object({ agendamento_id: prop.appointmentId }, ["agendamento_id"]),
      execute: async (args) => {
        if (dryRun) return simulated
        const result = await confirmAppointment(db, companyId, contactPhone, str(args, "agendamento_id"))
        return result.ok ? { ok: true } : failure(result.message, result.code)
      },
    })
  }

  if (behavior.allowCancellation) {
    tools.cancelar_agendamento = tool({
      description: "Cancela um agendamento do próprio cliente, somente após o cliente pedir e confirmar o cancelamento.",
      inputSchema: object({ agendamento_id: prop.appointmentId }, ["agendamento_id"]),
      execute: async (args) => {
        if (dryRun) return simulated
        const result = await cancelAppointment(db, companyId, contactPhone, str(args, "agendamento_id"))
        return result.ok ? { ok: true } : failure(result.message, result.code)
      },
    })
  }

  if (behavior.allowRescheduling) {
    tools.remarcar_agendamento = tool({
      description: "Remarca um agendamento do próprio cliente para um novo horário devolvido por consultar_horarios.",
      inputSchema: object({ agendamento_id: prop.appointmentId, novo_inicio: prop.startsAt }, ["agendamento_id", "novo_inicio"]),
      execute: async (args) => {
        if (dryRun) return simulated
        const result = await rescheduleAppointment(db, companyId, contactPhone, str(args, "agendamento_id"), str(args, "novo_inicio"))
        return result.ok
          ? { ok: true, agendamento: { id: result.data.id, quando: result.data.whenLabel, status: result.data.status } }
          : failure(result.message, result.code)
      },
    })
  }

  return tools
}
