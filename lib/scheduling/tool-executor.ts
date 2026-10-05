/**
 * Executor das ferramentas do Agente de Agendamento.
 *
 * O modelo só sugere chamadas; aqui cada uma é validada (permissão, argumentos,
 * dados do cliente, regras da Agenda) antes de tocar no banco. O `companyId`
 * vem sempre do contexto do servidor — qualquer `company_id` nos argumentos é
 * ignorado. Módulo puro: o acesso ao banco é injetado via `SchedulingRepository`.
 */
import type { SchedulingAgentBehavior } from "@/lib/domain/types"
import {
  acceptCustomerData,
  type CompletedActionType,
  type ConversationCustomer,
  type SchedulingAgentTool,
} from "../ai/agents/scheduling-conversation.ts"
import {
  SLOT_REJECTION_MESSAGES,
  addDays,
  checkSlot,
  findUpcomingSlots,
  isValidDateKey,
  listDaySlots,
  minutesToTime,
  parseLocalDateTime,
  toZoned,
  zonedToUtc,
  type AvailabilityContext,
  type BusyInterval,
} from "./availability.ts"
import type { AppointmentRecord, SchedulingRepository, SchedulingRules, ServiceRecord } from "./repository.ts"

export interface ToolExecutionContext {
  /** Empresa da sessão autenticada, resolvida no servidor. */
  companyId: string
  behavior: SchedulingAgentBehavior
  /** Dados do cliente já validados em rodadas anteriores. */
  customer: ConversationCustomer
  /** Todas as mensagens do cliente; dados só são aceitos se aparecerem aqui. */
  userText: string
  now: Date
  repo: SchedulingRepository
}

export interface CompletedAction {
  type: CompletedActionType
  appointmentId: string
  serviceName: string
  startsAt: string
  endsAt: string
  timezone: string
}

export interface ToolOutcome {
  tool: string
  ok: boolean
  /** Enviado de volta ao modelo como resultado da função. */
  response: Record<string, unknown>
  /** Preenchido apenas quando uma escrita foi confirmada pelo banco. */
  action: CompletedAction | null
  availabilityChecked: boolean
  message: string | null
}

const TOOL_PERMISSIONS: Record<SchedulingAgentTool, (behavior: SchedulingAgentBehavior) => boolean> = {
  get_services: () => true,
  get_availability: (behavior) => behavior.offerAvailableSlots,
  create_appointment: (behavior) => behavior.allowConfirmation,
  cancel_appointment: (behavior) => behavior.allowCancellation,
  reschedule_appointment: (behavior) => behavior.allowRescheduling,
}

export function allowedSchedulingTools(behavior: SchedulingAgentBehavior): SchedulingAgentTool[] {
  return (Object.keys(TOOL_PERMISSIONS) as SchedulingAgentTool[]).filter((tool) => TOOL_PERMISSIONS[tool](behavior))
}

const CUSTOMER_FIELD_LABELS = { name: "nome", phone: "telefone", email: "e-mail" } as const

function readArgs(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
}

function readString(value: unknown, maxLength = 100): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  return text && text.length <= maxLength ? text : null
}

function failure(tool: string, error: string, message: string, extra: Record<string, unknown> = {}): ToolOutcome {
  return {
    tool,
    ok: false,
    response: { ok: false, error, message, ...extra },
    action: null,
    availabilityChecked: false,
    message,
  }
}

function success(tool: string, response: Record<string, unknown>, extra: Partial<ToolOutcome> = {}): ToolOutcome {
  return { tool, ok: true, response: { ok: true, ...response }, action: null, availabilityChecked: false, message: null, ...extra }
}

export function createSchedulingToolExecutor(ctx: ToolExecutionContext) {
  let customer: ConversationCustomer = { ...ctx.customer }
  let rulesPromise: Promise<SchedulingRules> | null = null
  const rules = () => (rulesPromise ??= ctx.repo.loadRules(ctx.companyId))

  function availabilityContext(current: SchedulingRules, busy: BusyInterval[]): AvailabilityContext {
    return { hours: current.hours, blockedDates: current.blockedDates, settings: current.settings, busy, now: ctx.now }
  }

  function busyForDay(dateKey: string, timezone: string) {
    return ctx.repo.listBusy(ctx.companyId, zonedToUtc(dateKey, 0, timezone), zonedToUtc(addDays(dateKey, 1), 0, timezone))
  }

  function describeAppointment(appointment: AppointmentRecord, current: SchedulingRules) {
    const local = toZoned(appointment.start, current.settings.timezone)
    const service = current.services.find((item) => item.id === appointment.serviceId)
    return {
      appointment_id: appointment.id,
      service: service?.name ?? appointment.title ?? "Agendamento",
      date: local.dateKey,
      time: minutesToTime(local.minutes),
    }
  }

  function toAction(type: CompletedActionType, appointment: AppointmentRecord, serviceName: string, timezone: string, end: Date) {
    return {
      type,
      appointmentId: appointment.id,
      serviceName,
      startsAt: appointment.start.toISOString(),
      endsAt: (appointment.end ?? end).toISOString(),
      timezone,
    } satisfies CompletedAction
  }

  function unknownService(tool: string, current: SchedulingRules) {
    return failure(tool, "unknown_service", "Serviço não encontrado entre os serviços ativos da empresa.", {
      services: current.services.map(({ id, name }) => ({ service_id: id, name })),
    })
  }

  /** Recusa um horário e, quando possível, sugere outros horários livres no mesmo dia. */
  async function rejectSlot(tool: string, reason: keyof typeof SLOT_REJECTION_MESSAGES, ctxAvail: AvailabilityContext, dateKey: string, duration: number, ignoreId?: string) {
    const day = listDaySlots(ctxAvail, dateKey, duration, ignoreId)
    return failure(tool, reason, SLOT_REJECTION_MESSAGES[reason], {
      other_times_same_day: day.ok ? day.times.slice(0, 6) : [],
    })
  }

  async function getServices(): Promise<ToolOutcome> {
    const current = await rules()
    return success("get_services", {
      services: current.services.map((service) => ({
        service_id: service.id,
        name: service.name,
        duration_minutes: service.durationMinutes,
        description: service.description,
      })),
    })
  }

  async function getAvailability(args: Record<string, unknown>): Promise<ToolOutcome> {
    const tool = "get_availability"
    const current = await rules()
    const service = current.services.find((item) => item.id === readString(args.service_id))
    if (!service) return unknownService(tool, current)

    const { timezone } = current.settings
    const date = readString(args.date, 10)

    if (date) {
      if (!isValidDateKey(date)) return failure(tool, "invalid_datetime", "Data inválida. Use o formato AAAA-MM-DD.")
      const day = listDaySlots(availabilityContext(current, await busyForDay(date, timezone)), date, service.durationMinutes)
      return success(
        tool,
        day.ok
          ? { service: service.name, date, available_times: day.times }
          : { service: service.name, date, available_times: [], reason: SLOT_REJECTION_MESSAGES[day.reason] },
        { availabilityChecked: true },
      )
    }

    const today = toZoned(ctx.now, timezone).dateKey
    const busy = await ctx.repo.listBusy(ctx.companyId, ctx.now, zonedToUtc(addDays(today, 15), 0, timezone))
    const days = findUpcomingSlots(availabilityContext(current, busy), today, service.durationMinutes)
    return success(
      tool,
      { service: service.name, upcoming: days.map((day) => ({ date: day.dateKey, available_times: day.times })) },
      { availabilityChecked: true },
    )
  }

  async function createAppointment(args: Record<string, unknown>): Promise<ToolOutcome> {
    const tool = "create_appointment"
    customer = acceptCustomerData(
      customer,
      { name: args.customer_name, phone: args.customer_phone, email: args.customer_email },
      { name: ctx.behavior.askName, phone: ctx.behavior.askPhone, email: ctx.behavior.askEmail },
      ctx.userText,
    )
    const missing = (["name", "phone", "email"] as const).filter(
      (field) => ctx.behavior[`ask${field[0].toUpperCase()}${field.slice(1)}` as "askName" | "askPhone" | "askEmail"] && !customer[field],
    )
    if (missing.length > 0) {
      return failure(tool, "missing_customer_data", "Faltam dados obrigatórios do cliente.", {
        missing: missing.map((field) => CUSTOMER_FIELD_LABELS[field]),
      })
    }

    const current = await rules()
    const service: ServiceRecord | undefined = current.services.find((item) => item.id === readString(args.service_id))
    if (!service) return unknownService(tool, current)

    const start = parseLocalDateTime(args.start)
    if (!start) return failure(tool, "invalid_datetime", "Horário inválido. Use o formato AAAA-MM-DDTHH:mm.")

    const { timezone } = current.settings
    const avail = availabilityContext(current, await busyForDay(start.dateKey, timezone))
    const slot = checkSlot(avail, start.dateKey, start.minutes, service.durationMinutes)
    if (!slot.ok) return rejectSlot(tool, slot.reason, avail, start.dateKey, service.durationMinutes)

    const result = await ctx.repo.insertAppointment(ctx.companyId, {
      serviceId: service.id,
      title: service.name,
      start: slot.start,
      end: slot.end,
      clientName: customer.name,
      clientPhone: customer.phone,
      clientEmail: customer.email,
    })
    if (!result.ok) {
      return result.reason === "conflict"
        ? failure(tool, "conflict", SLOT_REJECTION_MESSAGES.conflict)
        : failure(tool, "error", "Não foi possível salvar o agendamento na agenda.")
    }

    return success(
      tool,
      { created: describeAppointment(result.appointment, current) },
      { action: toAction("created", result.appointment, service.name, timezone, slot.end) },
    )
  }

  /** Localiza o agendamento do cliente. Sem `appointment_id`, apenas lista as opções. */
  async function resolveCustomerAppointment(tool: string, args: Record<string, unknown>) {
    customer = acceptCustomerData(
      customer,
      { phone: args.customer_phone, email: args.customer_email },
      { name: false, phone: true, email: true },
      ctx.userText,
    )
    if (!customer.phone && !customer.email) {
      return {
        outcome: failure(tool, "missing_customer_data", "Preciso do telefone ou e-mail usado no agendamento.", {
          missing: ["telefone ou e-mail"],
        }),
      }
    }

    const current = await rules()
    const appointments = await ctx.repo.findCustomerAppointments(
      ctx.companyId,
      { phone: customer.phone, email: customer.email },
      ctx.now,
    )
    if (appointments.length === 0) {
      return { outcome: failure(tool, "not_found", "Nenhum agendamento futuro encontrado para este cliente.") }
    }

    const requestedId = readString(args.appointment_id, 64)
    if (!requestedId) {
      return {
        outcome: success(tool, {
          requires_selection: true,
          message: "Confirme com o cliente qual agendamento deve ser alterado antes de enviar appointment_id.",
          appointments: appointments.map((item) => describeAppointment(item, current)),
        }),
      }
    }

    const appointment = appointments.find((item) => item.id === requestedId)
    if (!appointment) {
      return { outcome: failure(tool, "not_found", "Esse agendamento não pertence a este cliente ou já passou.") }
    }
    return { appointment, current }
  }

  async function cancelAppointment(args: Record<string, unknown>): Promise<ToolOutcome> {
    const tool = "cancel_appointment"
    const resolved = await resolveCustomerAppointment(tool, args)
    if ("outcome" in resolved) return resolved.outcome!
    const { appointment, current } = resolved

    const result = await ctx.repo.cancelAppointment(ctx.companyId, appointment.id)
    if (!result.ok) return failure(tool, result.reason, "Não foi possível cancelar o agendamento.")

    const summary = describeAppointment(appointment, current)
    return success(
      tool,
      { cancelled: summary },
      { action: toAction("cancelled", appointment, summary.service, current.settings.timezone, appointment.end ?? appointment.start) },
    )
  }

  async function rescheduleAppointment(args: Record<string, unknown>): Promise<ToolOutcome> {
    const tool = "reschedule_appointment"
    const start = args.new_start === undefined ? null : parseLocalDateTime(args.new_start)
    if (args.new_start !== undefined && !start) {
      return failure(tool, "invalid_datetime", "Novo horário inválido. Use o formato AAAA-MM-DDTHH:mm.")
    }

    const resolved = await resolveCustomerAppointment(tool, args)
    if ("outcome" in resolved) return resolved.outcome!
    const { appointment, current } = resolved
    if (!start) return failure(tool, "missing_new_start", "Informe o novo horário escolhido pelo cliente.")

    const service = current.services.find((item) => item.id === appointment.serviceId)
    const duration =
      service?.durationMinutes ??
      (appointment.end
        ? Math.round((appointment.end.getTime() - appointment.start.getTime()) / 60000)
        : current.settings.slotIntervalMinutes)

    const { timezone } = current.settings
    const avail = availabilityContext(current, await busyForDay(start.dateKey, timezone))
    const slot = checkSlot(avail, start.dateKey, start.minutes, duration, appointment.id)
    if (!slot.ok) return rejectSlot(tool, slot.reason, avail, start.dateKey, duration, appointment.id)

    const result = await ctx.repo.rescheduleAppointment(ctx.companyId, appointment.id, slot.start, slot.end)
    if (!result.ok) {
      return result.reason === "conflict"
        ? failure(tool, "conflict", SLOT_REJECTION_MESSAGES.conflict)
        : failure(tool, result.reason, "Não foi possível reagendar.")
    }

    const updated = describeAppointment(result.appointment, current)
    return success(
      tool,
      { previous: describeAppointment(appointment, current), rescheduled: updated },
      { action: toAction("rescheduled", result.appointment, updated.service, timezone, slot.end) },
    )
  }

  const handlers: Record<SchedulingAgentTool, (args: Record<string, unknown>) => Promise<ToolOutcome>> = {
    get_services: getServices,
    get_availability: getAvailability,
    create_appointment: createAppointment,
    cancel_appointment: cancelAppointment,
    reschedule_appointment: rescheduleAppointment,
  }

  return {
    async execute(name: string, rawArgs: unknown): Promise<ToolOutcome> {
      if (!Object.hasOwn(handlers, name)) return failure(name, "unknown_tool", "Ferramenta desconhecida.")
      const tool = name as SchedulingAgentTool
      if (!TOOL_PERMISSIONS[tool](ctx.behavior)) {
        return failure(tool, "not_allowed", "Esta ação não está permitida na configuração do agente.")
      }
      try {
        return await handlers[tool](readArgs(rawArgs))
      } catch (error) {
        console.error("[scheduling/tool-executor] Tool failed", tool, error)
        return failure(tool, "error", "Não foi possível acessar a agenda agora.")
      }
    },
    customer: () => customer,
  }
}
