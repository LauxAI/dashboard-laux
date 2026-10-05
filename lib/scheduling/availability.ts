/**
 * Cálculo de disponibilidade da Agenda. Módulo puro (sem Supabase, sem rede):
 * recebe as regras da empresa e os agendamentos existentes e decide quais
 * horários podem ser oferecidos ou reservados. É usado pelo servidor antes de
 * qualquer escrita; a regra de exclusão no banco é a garantia final contra
 * reservas simultâneas.
 */

export interface BusinessHoursRule {
  /** 0 = domingo … 6 = sábado (mesma convenção de `Date#getUTCDay`). */
  weekday: number
  /** "HH:mm" ou "HH:mm:ss" */
  opensAt: string
  closesAt: string
  breakStart: string | null
  breakEnd: string | null
}

export interface SchedulingSettings {
  timezone: string
  slotIntervalMinutes: number
  minNoticeMinutes: number
}

export interface BusyInterval {
  id: string
  start: Date
  /** `null` quando o agendamento antigo não tem término; usa o intervalo padrão. */
  end: Date | null
}

export interface AvailabilityContext {
  hours: BusinessHoursRule[]
  /** Datas "YYYY-MM-DD" sem atendimento. */
  blockedDates: string[]
  settings: SchedulingSettings
  busy: BusyInterval[]
  now: Date
}

export const DEFAULT_SCHEDULING_SETTINGS: SchedulingSettings = {
  timezone: "America/Sao_Paulo",
  slotIntervalMinutes: 30,
  minNoticeMinutes: 60,
}

export const MAX_BOOKING_HORIZON_DAYS = 90

export type SlotRejection =
  | "invalid_datetime"
  | "blocked_date"
  | "closed_day"
  | "outside_hours"
  | "during_break"
  | "misaligned"
  | "insufficient_notice"
  | "too_far"
  | "conflict"

export const SLOT_REJECTION_MESSAGES: Record<SlotRejection, string> = {
  invalid_datetime: "Data ou horário inválido.",
  blocked_date: "A empresa não atende nesta data.",
  closed_day: "A empresa não atende neste dia da semana.",
  outside_hours: "O horário fica fora do horário de funcionamento.",
  during_break: "O horário coincide com o intervalo da empresa.",
  misaligned: "O horário não corresponde aos horários oferecidos pela agenda.",
  insufficient_notice: "O horário não respeita a antecedência mínima exigida.",
  too_far: "A data está além do período aberto para agendamentos.",
  conflict: "Esse horário já está ocupado.",
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?$/
const TIME = /^(\d{2}):(\d{2})(?::(\d{2}))?$/

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0)
    return true
  } catch {
    return false
  }
}

export function isValidDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value)
  if (!match) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** "HH:mm[:ss]" → minutos desde a meia-noite, ou `null` se inválido. */
export function timeToMinutes(value: string): number | null {
  const match = TIME.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay()
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string) {
  let formatter = partsFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    partsFormatters.set(timeZone, formatter)
  }
  return formatter
}

function zonedFields(date: Date, timeZone: string) {
  const fields: Record<string, number> = {}
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") fields[part.type] = Number(part.value)
  }
  return fields as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

function offsetMinutes(date: Date, timeZone: string): number {
  const f = zonedFields(date, timeZone)
  const asUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second)
  return Math.round((asUtc - date.getTime()) / 60000)
}

/** Data local ("YYYY-MM-DD") + minutos locais no fuso → instante UTC. */
export function zonedToUtc(dateKey: string, minutes: number, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number)
  const guess = Date.UTC(year, month - 1, day, 0, minutes)
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60000
  const second = guess - offsetMinutes(new Date(first), timeZone) * 60000
  return new Date(second)
}

/** Instante UTC → data e minutos locais no fuso da empresa. */
export function toZoned(date: Date, timeZone: string): { dateKey: string; minutes: number } {
  const f = zonedFields(date, timeZone)
  const dateKey = `${f.year}-${String(f.month).padStart(2, "0")}-${String(f.day).padStart(2, "0")}`
  return { dateKey, minutes: f.hour * 60 + f.minute }
}

/** "YYYY-MM-DDTHH:mm" (horário local da empresa) → partes validadas. */
export function parseLocalDateTime(value: unknown): { dateKey: string; minutes: number } | null {
  if (typeof value !== "string") return null
  const match = LOCAL_DATE_TIME.exec(value.trim())
  if (!match || !isValidDateKey(match[1])) return null
  const minutes = timeToMinutes(`${match[2]}:${match[3]}`)
  return minutes === null ? null : { dateKey: match[1], minutes }
}

function busyEnd(interval: BusyInterval, settings: SchedulingSettings): number {
  return interval.end ? interval.end.getTime() : interval.start.getTime() + settings.slotIntervalMinutes * 60000
}

export type SlotCheck = { ok: true; start: Date; end: Date } | { ok: false; reason: SlotRejection }

export function checkSlot(
  ctx: AvailabilityContext,
  dateKey: string,
  startMinutes: number,
  durationMinutes: number,
  ignoreAppointmentId?: string,
): SlotCheck {
  if (!isValidDateKey(dateKey) || !Number.isInteger(startMinutes) || durationMinutes <= 0) {
    return { ok: false, reason: "invalid_datetime" }
  }
  if (ctx.blockedDates.includes(dateKey)) return { ok: false, reason: "blocked_date" }

  const rule = ctx.hours.find((item) => item.weekday === weekdayOf(dateKey))
  const opens = rule ? timeToMinutes(rule.opensAt) : null
  const closes = rule ? timeToMinutes(rule.closesAt) : null
  if (!rule || opens === null || closes === null) return { ok: false, reason: "closed_day" }

  const endMinutes = startMinutes + durationMinutes
  if (startMinutes < opens || endMinutes > closes) return { ok: false, reason: "outside_hours" }

  const breakStart = rule.breakStart ? timeToMinutes(rule.breakStart) : null
  const breakEnd = rule.breakEnd ? timeToMinutes(rule.breakEnd) : null
  if (breakStart !== null && breakEnd !== null && startMinutes < breakEnd && endMinutes > breakStart) {
    return { ok: false, reason: "during_break" }
  }

  if ((startMinutes - opens) % ctx.settings.slotIntervalMinutes !== 0) return { ok: false, reason: "misaligned" }

  const start = zonedToUtc(dateKey, startMinutes, ctx.settings.timezone)
  const end = new Date(start.getTime() + durationMinutes * 60000)
  const now = ctx.now.getTime()

  if (start.getTime() < now + ctx.settings.minNoticeMinutes * 60000) {
    return { ok: false, reason: "insufficient_notice" }
  }
  if (start.getTime() > now + MAX_BOOKING_HORIZON_DAYS * 86400000) return { ok: false, reason: "too_far" }

  const overlaps = ctx.busy.some(
    (interval) =>
      interval.id !== ignoreAppointmentId &&
      interval.start.getTime() < end.getTime() &&
      busyEnd(interval, ctx.settings) > start.getTime(),
  )
  if (overlaps) return { ok: false, reason: "conflict" }

  return { ok: true, start, end }
}

export type DaySlots =
  | { ok: true; dateKey: string; times: string[] }
  | { ok: false; dateKey: string; reason: SlotRejection }

/** Horários livres ("HH:mm") de um dia para um serviço com a duração indicada. */
export function listDaySlots(
  ctx: AvailabilityContext,
  dateKey: string,
  durationMinutes: number,
  ignoreAppointmentId?: string,
): DaySlots {
  if (!isValidDateKey(dateKey)) return { ok: false, dateKey, reason: "invalid_datetime" }
  if (ctx.blockedDates.includes(dateKey)) return { ok: false, dateKey, reason: "blocked_date" }

  const rule = ctx.hours.find((item) => item.weekday === weekdayOf(dateKey))
  const opens = rule ? timeToMinutes(rule.opensAt) : null
  const closes = rule ? timeToMinutes(rule.closesAt) : null
  if (!rule || opens === null || closes === null) return { ok: false, dateKey, reason: "closed_day" }

  const times: string[] = []
  for (let minutes = opens; minutes + durationMinutes <= closes; minutes += ctx.settings.slotIntervalMinutes) {
    if (checkSlot(ctx, dateKey, minutes, durationMinutes, ignoreAppointmentId).ok) times.push(minutesToTime(minutes))
  }
  return { ok: true, dateKey, times }
}

/** Próximos dias com horários livres, a partir de `fromDateKey`. */
export function findUpcomingSlots(
  ctx: AvailabilityContext,
  fromDateKey: string,
  durationMinutes: number,
  { maxDays = 14, maxDaysWithSlots = 3, maxTimesPerDay = 6 } = {},
): { dateKey: string; times: string[] }[] {
  const result: { dateKey: string; times: string[] }[] = []
  for (let offset = 0; offset < maxDays && result.length < maxDaysWithSlots; offset += 1) {
    const day = listDaySlots(ctx, addDays(fromDateKey, offset), durationMinutes)
    if (day.ok && day.times.length > 0) result.push({ dateKey: day.dateKey, times: day.times.slice(0, maxTimesPerDay) })
  }
  return result
}
