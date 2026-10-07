import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { jsonSchema, tool, type ToolSet } from "ai"
import type { SchedulingAgentConfig, SpecialistKey, SpecialistsConfig } from "@/lib/domain/types"
import {
  bookAppointment,
  cancelAppointment,
  confirmAppointment,
  findAvailableSlots,
  listClientAppointments,
  loadSchedulingContext,
  rescheduleAppointment,
} from "@/lib/scheduling/store"
import { lookupSales, lookupSupport, salesIntents } from "./specialist-lookup"
import { loadSpecialistState, type SpecialistContext } from "./specialist-status"
import { SPECIALIST_TOOL_NAMES } from "./specialists"

/** Registro de cada consulta feita a um especialista, para o rastro exibido no teste. */
export type SpecialistCall = { specialist: SpecialistKey; tool: string; success: boolean }

export type SpecialistToolRuntime = {
  db: SupabaseClient
  /** Sempre resolvido no servidor (sessão ou conversa). Nunca vem do cliente nem do modelo. */
  companyId: string
  /** Telefone da conversa (WhatsApp). Ausente no ambiente de teste. */
  contactPhone: string | null
  /**
   * No ambiente de teste as consultas são reais, mas nenhuma ação altera a agenda.
   * É decidido pelo servidor: nenhuma entrada do cliente ou do modelo o desliga.
   */
  dryRun: boolean
  onCall?: (call: SpecialistCall) => void
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

/** Resultado estruturado de sucesso devolvido ao Atendimento. */
const ok = <T extends Record<string, unknown>>(type: string, data: T, simulated = false) => ({
  type,
  success: true as const,
  specialist: "agendamento" as const,
  ...(simulated ? { simulated: true } : {}),
  ...data,
})

const failure = (message: string, code: string) => ({
  type: "error" as const,
  success: false as const,
  specialist: "agendamento" as const,
  code,
  message,
})

type Traced = { success: boolean }

const specialistError = () => ({
  type: "error" as const,
  success: false as const,
  code: "specialist_error",
  message: "O especialista não conseguiu concluir a consulta agora.",
})

/** Cria uma ferramenta de especialista que registra a consulta e o resultado no rastro. */
function specialistTool<R extends Traced>(
  runtime: SpecialistToolRuntime,
  specialist: SpecialistKey,
  name: string,
  definition: { description: string; inputSchema: ReturnType<typeof object>; run: (args: Args) => Promise<R> | R },
) {
  const execute = async (args: Args) => {
    let result: R
    try {
      result = await definition.run(args)
    } catch {
      runtime.onCall?.({ specialist, tool: name, success: false })
      return specialistError()
    }
    runtime.onCall?.({ specialist, tool: name, success: result.success })
    return result
  }
  // O overload de `tool` não infere o par entrada/saída a partir de um schema genérico.
  return tool({ description: definition.description, inputSchema: definition.inputSchema, execute } as never) as ToolSet[string]
}

/** Ferramentas do especialista de Agendamento, limitadas ao que a configuração permite. */
export function buildSchedulingTools(config: SchedulingAgentConfig, runtime: SpecialistToolRuntime): ToolSet {
  const { behavior } = config
  const { db, companyId, contactPhone, dryRun } = runtime
  const tools: ToolSet = {}
  const define = <R extends Traced>(name: string, definition: Parameters<typeof specialistTool<R>>[3]) => {
    tools[name] = specialistTool(runtime, "scheduling", name, definition)
  }

  define("listar_servicos", {
    description: "Lista os serviços disponíveis para agendamento, com a duração de cada um.",
    inputSchema: object({}),
    run: async () => {
      const loaded = await loadSchedulingContext(db, companyId)
      if (!loaded.ok) return failure(loaded.message, loaded.code)
      return ok("services", { services: loaded.data.services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes })) })
    },
  })

  if (behavior.offerAvailableSlots || behavior.allowBooking || behavior.allowRescheduling) {
    define("consultar_horarios", {
      description:
        "Consulta horários livres reais da agenda, a partir de uma data. Retorna os próximos dias com vaga. Use antes de oferecer qualquer horário.",
      inputSchema: object({ data: prop.date, servico_id: prop.serviceId }),
      run: async (args) => {
        const result = await findAvailableSlots(db, companyId, { fromDate: str(args, "data") || undefined, serviceId: str(args, "servico_id") || null })
        if (!result.ok) return failure(result.message, result.code)
        const slots = result.data.days.flatMap((day) => day.slots.map((slot) => ({ date: day.date, startsAt: slot.startsAt, label: slot.label })))
        return ok("availability", {
          timezone: result.data.timezone,
          durationMinutes: result.data.durationMinutes,
          slots,
          ...(slots.length === 0 ? { guidance: "Não há horários livres nos próximos dias. Não ofereça horários." } : {}),
        })
      },
    })
  }

  if (behavior.allowBooking) {
    define("criar_agendamento", {
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
      run: async (args) => {
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
            ? ok(
                "booking_created",
                {
                  appointmentId: null,
                  scheduledAt: str(args, "inicio"),
                  guidance: "Simulação de teste: o horário está livre, mas nenhum agendamento real foi criado.",
                },
                true,
              )
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
        return ok("booking_created", {
          appointmentId: result.data.id,
          scheduledAt: result.data.startsAt,
          service: result.data.title,
          whenLabel: result.data.whenLabel,
          status: result.data.status,
        })
      },
    })
  }

  const needsOwn = behavior.allowLookup || behavior.allowConfirmation || behavior.allowCancellation || behavior.allowRescheduling
  if (needsOwn) {
    define("consultar_meus_agendamentos", {
      description: "Lista os próximos agendamentos do próprio cliente desta conversa.",
      inputSchema: object({}),
      run: async () => {
        const result = await listClientAppointments(db, companyId, contactPhone)
        if (!result.ok) return failure(result.message, result.code)
        return ok("appointments", {
          appointments: result.data.map((a) => ({ id: a.id, service: a.title, startsAt: a.startsAt, whenLabel: a.whenLabel, status: a.status })),
          ...(contactPhone ? {} : { guidance: "Não foi possível identificar o cliente pelo telefone neste canal." }),
        })
      },
    })
  }

  const simulatedGuidance = "Simulação de teste: nenhuma alteração real foi feita na agenda."

  if (behavior.allowConfirmation) {
    define("confirmar_agendamento", {
      description: "Confirma um agendamento do próprio cliente.",
      inputSchema: object({ agendamento_id: prop.appointmentId }, ["agendamento_id"]),
      run: async (args) => {
        if (dryRun) return ok("booking_confirmed", { appointmentId: str(args, "agendamento_id"), guidance: simulatedGuidance }, true)
        const result = await confirmAppointment(db, companyId, contactPhone, str(args, "agendamento_id"))
        return result.ok ? ok("booking_confirmed", { appointmentId: str(args, "agendamento_id") }) : failure(result.message, result.code)
      },
    })
  }

  if (behavior.allowCancellation) {
    define("cancelar_agendamento", {
      description: "Cancela um agendamento do próprio cliente, somente após o cliente pedir e confirmar o cancelamento.",
      inputSchema: object({ agendamento_id: prop.appointmentId }, ["agendamento_id"]),
      run: async (args) => {
        if (dryRun) return ok("booking_cancelled", { appointmentId: str(args, "agendamento_id"), guidance: simulatedGuidance }, true)
        const result = await cancelAppointment(db, companyId, contactPhone, str(args, "agendamento_id"))
        return result.ok ? ok("booking_cancelled", { appointmentId: str(args, "agendamento_id") }) : failure(result.message, result.code)
      },
    })
  }

  if (behavior.allowRescheduling) {
    define("remarcar_agendamento", {
      description: "Remarca um agendamento do próprio cliente para um novo horário devolvido por consultar_horarios.",
      inputSchema: object({ agendamento_id: prop.appointmentId, novo_inicio: prop.startsAt }, ["agendamento_id", "novo_inicio"]),
      run: async (args) => {
        if (dryRun) {
          return ok(
            "booking_rescheduled",
            { appointmentId: str(args, "agendamento_id"), scheduledAt: str(args, "novo_inicio"), guidance: simulatedGuidance },
            true,
          )
        }
        const result = await rescheduleAppointment(db, companyId, contactPhone, str(args, "agendamento_id"), str(args, "novo_inicio"))
        return result.ok
          ? ok("booking_rescheduled", { appointmentId: result.data.id, scheduledAt: result.data.startsAt, whenLabel: result.data.whenLabel, status: result.data.status })
          : failure(result.message, result.code)
      },
    })
  }

  return tools
}

/** Ferramentas dos especialistas de Vendas e Suporte: leem a configuração persistida, sem efeitos colaterais. */
export function buildKnowledgeTools(context: SpecialistContext, runtime: SpecialistToolRuntime): ToolSet {
  const tools: ToolSet = {}

  if (context.sales) {
    const config = context.sales
    tools[SPECIALIST_TOOL_NAMES.sales] = specialistTool(runtime, "sales", SPECIALIST_TOOL_NAMES.sales, {
      description:
        "Consulta o especialista de Vendas: catálogo real de produtos e serviços, preços, abordagem comercial e orientação para objeções. Use para qualquer pergunta sobre preço, produto, plano ou quando o cliente hesitar (\"está caro\").",
      inputSchema: object(
        {
          tipo: {
            type: "string",
            enum: salesIntents,
            description: "produto_preco: produtos, serviços e valores; objecao: cliente hesita ou reclama do preço; abordagem: como conduzir a venda; geral: demais casos.",
          },
          consulta: { type: "string", description: "O que o cliente quer saber ou a objeção levantada, em poucas palavras." },
        },
        ["tipo"],
      ),
      run: (args) => lookupSales(config, { tipo: str(args, "tipo"), consulta: str(args, "consulta") }),
    })
  }

  if (context.support) {
    const config = context.support
    tools[SPECIALIST_TOOL_NAMES.support] = specialistTool(runtime, "support", SPECIALIST_TOOL_NAMES.support, {
      description:
        "Consulta o especialista de Suporte: procedimentos passo a passo e conhecimento de suporte da empresa. Use quando o cliente relatar um problema, erro ou dificuldade de uso ou acesso.",
      inputSchema: object({ problema: { type: "string", description: "O problema do cliente, em poucas palavras." } }, ["problema"]),
      run: (args) => lookupSupport(config, { problema: str(args, "problema") }),
    })
  }

  return tools
}

/** Ferramentas que alteram a agenda de verdade. No teste (`dryRun`) nada é gravado, então nenhuma conta. */
const MUTATING_TOOLS = ["criar_agendamento", "confirmar_agendamento", "cancelar_agendamento", "remarcar_agendamento"]

export type PreparedSpecialists = {
  specialists?: SpecialistContext
  tools?: ToolSet
  /** Ferramentas cuja execução impede refazer a resposta em outro modelo. */
  sideEffectTools?: string[]
  /** Estado de cada especialista, para a interface de teste. */
  failed: boolean
}

/**
 * Prepara os especialistas do Atendimento a partir da configuração persistida.
 * É o único caminho usado pelo WhatsApp e pelo teste integrado. Se o carregamento
 * falhar, o Atendimento segue sozinho com o próprio conhecimento.
 */
export async function prepareSpecialists(
  runtime: SpecialistToolRuntime,
  enabled: SpecialistsConfig,
  onLoadError?: (error: unknown) => void,
): Promise<PreparedSpecialists> {
  if (!Object.values(enabled).some(Boolean)) return { failed: false }
  try {
    const { context } = await loadSpecialistState(runtime.db, runtime.companyId, enabled)
    const tools: ToolSet = {
      ...(context.scheduling ? buildSchedulingTools(context.scheduling, runtime) : {}),
      ...buildKnowledgeTools(context, runtime),
    }
    const hasAny = Boolean(context.scheduling || context.sales || context.support)
    return {
      specialists: hasAny ? context : undefined,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      sideEffectTools: runtime.dryRun ? [] : MUTATING_TOOLS,
      failed: false,
    }
  } catch (error) {
    onLoadError?.(error)
    return { failed: true }
  }
}
