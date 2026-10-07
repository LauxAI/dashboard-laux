import type { SupabaseClient } from "@supabase/supabase-js"
import {
  addDays,
  computeSlots,
  formatLocalDateTime,
  isSlotAvailable,
  localDateOf,
  localToUtcMs,
  parseLocalDate,
  type BusinessHoursRow,
  type BusyRange,
  type Slot,
} from "./availability"

export const DEFAULT_DURATION_MINUTES = 30
const DEFAULTS = { timezone: "America/Sao_Paulo", slotIntervalMinutes: 30, minNoticeMinutes: 60 }
const MAX_SEARCH_DAYS = 14
const MAX_SLOTS_PER_DAY = 8

export type SchedulingService = { id: string; name: string; durationMinutes: number }

export type SchedulingContext = {
  timezone: string
  slotIntervalMinutes: number
  minNoticeMinutes: number
  hours: BusinessHoursRow[]
  services: SchedulingService[]
}

export type AppointmentSummary = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  status: string
  whenLabel: string
}

export type SchedulingResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string }

const fail = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message })
const databaseError = () => fail("database_error", "Não foi possível acessar a agenda agora.")

type HoursRow = {
  weekday: number
  opens_at: string
  closes_at: string
  break_start: string | null
  break_end: string | null
}

type AppointmentRow = {
  id: string
  title: string
  scheduled_at: string
  ends_at: string | null
  status: string
  client_phone: string | null
}

const APPOINTMENT_COLUMNS = "id, title, scheduled_at, ends_at, status, client_phone"

export const normalizePhone = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "")

export async function loadSchedulingContext(db: SupabaseClient, companyId: string): Promise<SchedulingResult<SchedulingContext>> {
  const [settings, hours, services] = await Promise.all([
    db
      .from("scheduling_settings")
      .select("timezone, slot_interval_minutes, min_notice_minutes")
      .eq("company_id", companyId)
      .maybeSingle<{ timezone: string; slot_interval_minutes: number; min_notice_minutes: number }>(),
    db.from("business_hours").select("weekday, opens_at, closes_at, break_start, break_end").eq("company_id", companyId).returns<HoursRow[]>(),
    db
      .from("scheduling_services")
      .select("id, name, duration_minutes")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name")
      .returns<{ id: string; name: string; duration_minutes: number }[]>(),
  ])
  if (settings.error || hours.error || services.error) return databaseError()

  return {
    ok: true,
    data: {
      timezone: settings.data?.timezone ?? DEFAULTS.timezone,
      slotIntervalMinutes: settings.data?.slot_interval_minutes ?? DEFAULTS.slotIntervalMinutes,
      minNoticeMinutes: settings.data?.min_notice_minutes ?? DEFAULTS.minNoticeMinutes,
      hours: (hours.data ?? []).map((row) => ({
        weekday: row.weekday,
        opensAt: row.opens_at,
        closesAt: row.closes_at,
        breakStart: row.break_start,
        breakEnd: row.break_end,
      })),
      services: (services.data ?? []).map((row) => ({ id: row.id, name: row.name, durationMinutes: row.duration_minutes })),
    },
  }
}

function resolveService(context: SchedulingContext, serviceId?: string | null): SchedulingResult<SchedulingService | null> {
  if (!serviceId) {
    return context.services.length === 0
      ? { ok: true, data: null }
      : { ok: true, data: context.services.length === 1 ? context.services[0] : null }
  }
  const service = context.services.find((item) => item.id === serviceId)
  return service ? { ok: true, data: service } : fail("service_not_found", "Esse serviço não está disponível para agendamento.")
}

async function loadBusy(db: SupabaseClient, companyId: string, fromMs: number, toMs: number, ignoreId?: string): Promise<SchedulingResult<BusyRange[]>> {
  const { data, error } = await db
    .from("appointments")
    .select("id, scheduled_at, ends_at")
    .eq("company_id", companyId)
    .neq("status", "cancelado")
    .gte("scheduled_at", new Date(fromMs - 24 * 3600000).toISOString())
    .lt("scheduled_at", new Date(toMs).toISOString())
    .returns<{ id: string; scheduled_at: string; ends_at: string | null }[]>()
  if (error) return databaseError()

  const busy: BusyRange[] = []
  for (const row of data ?? []) {
    if (row.id === ignoreId) continue
    const startMs = Date.parse(row.scheduled_at)
    busy.push({ startMs, endMs: row.ends_at ? Date.parse(row.ends_at) : startMs + DEFAULT_DURATION_MINUTES * 60000 })
  }
  return { ok: true, data: busy }
}

async function loadBlockedDates(db: SupabaseClient, companyId: string, from: string, to: string): Promise<SchedulingResult<Set<string>>> {
  const { data, error } = await db
    .from("blocked_dates")
    .select("date")
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", to)
    .returns<{ date: string }[]>()
  if (error) return databaseError()
  return { ok: true, data: new Set((data ?? []).map((row) => row.date)) }
}

export type DaySlots = { date: string; slots: Slot[] }

/** Procura horários livres a partir de `fromDate`, até 14 dias, devolvendo os primeiros dias com vaga. */
export async function findAvailableSlots(
  db: SupabaseClient,
  companyId: string,
  options: { fromDate?: string; serviceId?: string | null; days?: number; nowMs?: number },
): Promise<SchedulingResult<{ timezone: string; durationMinutes: number; service: SchedulingService | null; days: DaySlots[] }>> {
  const loaded = await loadSchedulingContext(db, companyId)
  if (!loaded.ok) return loaded
  const context = loaded.data

  const service = resolveService(context, options.serviceId)
  if (!service.ok) return service
  if (!options.serviceId && context.services.length > 1) {
    return fail("service_required", "Pergunte ao cliente qual serviço ele deseja antes de consultar horários.")
  }
  if (context.hours.length === 0) return fail("no_business_hours", "A empresa ainda não configurou o horário de funcionamento.")

  const nowMs = options.nowMs ?? Date.now()
  const today = localDateOf(nowMs, context.timezone)
  const requested = options.fromDate && parseLocalDate(options.fromDate) ? options.fromDate : today
  const start = requested < today ? today : requested
  const span = Math.min(Math.max(options.days ?? 3, 1), MAX_SEARCH_DAYS)
  const end = addDays(start, MAX_SEARCH_DAYS)
  if (!end) return fail("invalid_date", "Data inválida.")

  const rangeStart = localToUtcMs(start, 0, context.timezone)
  const rangeEnd = localToUtcMs(end, 24 * 60, context.timezone)
  if (rangeStart === null || rangeEnd === null) return fail("invalid_date", "Data inválida.")

  const [busy, blocked] = await Promise.all([
    loadBusy(db, companyId, rangeStart, rangeEnd),
    loadBlockedDates(db, companyId, start, end),
  ])
  if (!busy.ok) return busy
  if (!blocked.ok) return blocked

  const durationMinutes = service.data?.durationMinutes ?? DEFAULT_DURATION_MINUTES
  const days: DaySlots[] = []
  for (let offset = 0; offset <= MAX_SEARCH_DAYS && days.length < span; offset++) {
    const date = addDays(start, offset)
    if (!date) break
    const slots = computeSlots({
      date,
      timezone: context.timezone,
      hours: context.hours,
      isBlocked: blocked.data.has(date),
      slotIntervalMinutes: context.slotIntervalMinutes,
      minNoticeMinutes: context.minNoticeMinutes,
      durationMinutes,
      busy: busy.data,
      nowMs,
    })
    if (slots.length > 0) days.push({ date, slots: slots.slice(0, MAX_SLOTS_PER_DAY) })
  }
  return { ok: true, data: { timezone: context.timezone, durationMinutes, service: service.data, days } }
}

async function validateSlot(
  db: SupabaseClient,
  companyId: string,
  context: SchedulingContext,
  startsAt: string,
  durationMinutes: number,
  ignoreId?: string,
): Promise<SchedulingResult<{ startMs: number; endMs: number }>> {
  const startMs = Date.parse(startsAt)
  if (Number.isNaN(startMs)) return fail("invalid_time", "Horário inválido.")
  const endMs = startMs + durationMinutes * 60000
  const date = localDateOf(startMs, context.timezone)

  const [busy, blocked] = await Promise.all([
    loadBusy(db, companyId, startMs, endMs + 24 * 3600000, ignoreId),
    loadBlockedDates(db, companyId, date, date),
  ])
  if (!busy.ok) return busy
  if (!blocked.ok) return blocked

  const available = isSlotAvailable({
    startsAt,
    timezone: context.timezone,
    hours: context.hours,
    isBlocked: blocked.data.has(date),
    slotIntervalMinutes: context.slotIntervalMinutes,
    minNoticeMinutes: context.minNoticeMinutes,
    durationMinutes,
    busy: busy.data,
    nowMs: Date.now(),
  })
  return available
    ? { ok: true, data: { startMs, endMs } }
    : fail("slot_unavailable", "Esse horário não está mais disponível. Consulte outros horários.")
}

const toSummary = (row: AppointmentRow, timezone: string): AppointmentSummary => ({
  id: row.id,
  title: row.title,
  startsAt: row.scheduled_at,
  endsAt: row.ends_at,
  status: row.status,
  whenLabel: formatLocalDateTime(Date.parse(row.scheduled_at), timezone),
})

export type BookingInput = {
  startsAt: string
  serviceId?: string | null
  clientName: string
  clientPhone: string | null
  clientEmail?: string | null
}

export async function bookAppointment(db: SupabaseClient, companyId: string, input: BookingInput): Promise<SchedulingResult<AppointmentSummary>> {
  const loaded = await loadSchedulingContext(db, companyId)
  if (!loaded.ok) return loaded
  const context = loaded.data

  const service = resolveService(context, input.serviceId)
  if (!service.ok) return service
  if (!input.serviceId && context.services.length > 1) {
    return fail("service_required", "Pergunte ao cliente qual serviço ele deseja.")
  }
  const clientName = input.clientName.trim()
  if (!clientName) return fail("name_required", "Informe o nome do cliente.")

  const durationMinutes = service.data?.durationMinutes ?? DEFAULT_DURATION_MINUTES
  const slot = await validateSlot(db, companyId, context, input.startsAt, durationMinutes)
  if (!slot.ok) return slot

  const { data, error } = await db
    .from("appointments")
    .insert({
      company_id: companyId,
      title: service.data?.name ?? "Atendimento",
      client_name: clientName.slice(0, 120),
      client_phone: normalizePhone(input.clientPhone) || null,
      client_email: input.clientEmail?.trim().slice(0, 160) || null,
      service_id: service.data?.id ?? null,
      scheduled_at: new Date(slot.data.startMs).toISOString(),
      ends_at: new Date(slot.data.endMs).toISOString(),
      status: "agendado",
      source: "agent",
    })
    .select(APPOINTMENT_COLUMNS + ", created_at")
    .single<AppointmentRow & { created_at: string }>()
  if (error || !data) return databaseError()

  // Sem restrição de exclusão no banco: a reserva mais antiga vence uma corrida pelo mesmo horário.
  const rivals = await db
    .from("appointments")
    .select("id, created_at")
    .eq("company_id", companyId)
    .neq("status", "cancelado")
    .neq("id", data.id)
    .lt("scheduled_at", new Date(slot.data.endMs).toISOString())
    .gt("ends_at", new Date(slot.data.startMs).toISOString())
    .returns<{ id: string; created_at: string }[]>()
  if (!rivals.error && (rivals.data ?? []).some((rival) => rival.created_at < data.created_at || (rival.created_at === data.created_at && rival.id < data.id))) {
    await db.from("appointments").delete().eq("id", data.id).eq("company_id", companyId)
    return fail("slot_unavailable", "Esse horário acabou de ser ocupado. Consulte outros horários.")
  }

  return { ok: true, data: toSummary(data, context.timezone) }
}

/** Agendamentos futuros do próprio cliente (identificado pelo telefone da conversa). */
export async function listClientAppointments(
  db: SupabaseClient,
  companyId: string,
  clientPhone: string | null,
): Promise<SchedulingResult<AppointmentSummary[]>> {
  const phone = normalizePhone(clientPhone)
  if (!phone) return { ok: true, data: [] }
  const loaded = await loadSchedulingContext(db, companyId)
  if (!loaded.ok) return loaded

  const { data, error } = await db
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("company_id", companyId)
    .eq("client_phone", phone)
    .in("status", ["agendado", "pendente", "confirmado"])
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(5)
    .returns<AppointmentRow[]>()
  if (error) return databaseError()
  return { ok: true, data: (data ?? []).map((row) => toSummary(row, loaded.data.timezone)) }
}

async function ownAppointment(
  db: SupabaseClient,
  companyId: string,
  clientPhone: string | null,
  appointmentId: string,
): Promise<SchedulingResult<AppointmentRow>> {
  const phone = normalizePhone(clientPhone)
  if (!phone) return fail("not_found", "Não encontrei esse agendamento para este cliente.")
  const { data, error } = await db
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("id", appointmentId)
    .eq("company_id", companyId)
    .eq("client_phone", phone)
    .in("status", ["agendado", "pendente", "confirmado"])
    .maybeSingle<AppointmentRow>()
  if (error) return databaseError()
  return data ? { ok: true, data } : fail("not_found", "Não encontrei esse agendamento para este cliente.")
}

export async function confirmAppointment(db: SupabaseClient, companyId: string, clientPhone: string | null, appointmentId: string) {
  const own = await ownAppointment(db, companyId, clientPhone, appointmentId)
  if (!own.ok) return own
  const { error } = await db.from("appointments").update({ status: "confirmado", updated_at: new Date().toISOString() }).eq("id", appointmentId).eq("company_id", companyId)
  return error ? databaseError() : ({ ok: true, data: { id: appointmentId } } as const)
}

export async function cancelAppointment(db: SupabaseClient, companyId: string, clientPhone: string | null, appointmentId: string) {
  const own = await ownAppointment(db, companyId, clientPhone, appointmentId)
  if (!own.ok) return own
  const now = new Date().toISOString()
  const { error } = await db
    .from("appointments")
    .update({ status: "cancelado", cancelled_at: now, updated_at: now })
    .eq("id", appointmentId)
    .eq("company_id", companyId)
  return error ? databaseError() : ({ ok: true, data: { id: appointmentId } } as const)
}

export async function rescheduleAppointment(
  db: SupabaseClient,
  companyId: string,
  clientPhone: string | null,
  appointmentId: string,
  startsAt: string,
): Promise<SchedulingResult<AppointmentSummary>> {
  const own = await ownAppointment(db, companyId, clientPhone, appointmentId)
  if (!own.ok) return own
  const loaded = await loadSchedulingContext(db, companyId)
  if (!loaded.ok) return loaded

  const current = own.data
  const durationMinutes = current.ends_at
    ? Math.round((Date.parse(current.ends_at) - Date.parse(current.scheduled_at)) / 60000)
    : DEFAULT_DURATION_MINUTES
  const slot = await validateSlot(db, companyId, loaded.data, startsAt, durationMinutes, appointmentId)
  if (!slot.ok) return slot

  const { data, error } = await db
    .from("appointments")
    .update({
      scheduled_at: new Date(slot.data.startMs).toISOString(),
      ends_at: new Date(slot.data.endMs).toISOString(),
      status: "agendado",
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("company_id", companyId)
    .select(APPOINTMENT_COLUMNS)
    .single<AppointmentRow>()
  if (error || !data) return databaseError()
  return { ok: true, data: toSummary(data, loaded.data.timezone) }
}
