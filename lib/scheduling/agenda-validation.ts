import type { AvailabilityConfig, BlockedDate, BookableService, BusinessHoursDay, WeekdayKey } from "@/lib/domain/types"
import { DEFAULT_SCHEDULING_SETTINGS, isValidDateKey, isValidTimeZone, timeToMinutes } from "./availability.ts"
import { WEEKDAY_NUMBER } from "./weekdays.ts"

export const AGENDA_LIMITS = {
  services: 50,
  blockedDates: 366,
  serviceName: 120,
  serviceDescription: 500,
  blockedReason: 200,
  minDuration: 5,
  maxDuration: 480,
  minSlotInterval: 5,
  maxSlotInterval: 240,
  maxMinNotice: 43200,
} as const

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WEEKDAY_KEYS = Object.keys(WEEKDAY_NUMBER) as WeekdayKey[]

export type AgendaValidation = { ok: true; config: AvailabilityConfig } | { ok: false; error: string }

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {}

const text = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "")

function integer(value: unknown, min: number, max: number): number | null {
  const number = typeof value === "string" ? Number(value) : value
  return typeof number === "number" && Number.isInteger(number) && number >= min && number <= max ? number : null
}

function parseHours(input: unknown): BusinessHoursDay[] | string {
  const byDay = new Map<WeekdayKey, Record<string, unknown>>()
  for (const item of Array.isArray(input) ? input : []) {
    const record = asRecord(item)
    if (WEEKDAY_KEYS.includes(record.day as WeekdayKey)) byDay.set(record.day as WeekdayKey, record)
  }

  const hours: BusinessHoursDay[] = []
  for (const day of WEEKDAY_KEYS) {
    const record = byDay.get(day)
    const enabled = record?.enabled === true
    const start = text(record?.start)
    const end = text(record?.end)
    if (enabled) {
      const opens = timeToMinutes(start)
      const closes = timeToMinutes(end)
      if (opens === null || closes === null) return "Informe início e fim válidos para todos os dias de atendimento."
      if (closes <= opens) return "O horário de fim deve ser depois do horário de início."
    }
    hours.push({ day, enabled, start: enabled ? start : "", end: enabled ? end : "" })
  }
  return hours
}

function parseServices(input: unknown): BookableService[] | string {
  const list = Array.isArray(input) ? input : []
  if (list.length > AGENDA_LIMITS.services) return `Cadastre no máximo ${AGENDA_LIMITS.services} serviços.`

  const services: BookableService[] = []
  const ids = new Set<string>()
  for (const item of list) {
    const record = asRecord(item)
    const name = text(record.name)
    if (!name || name.length > AGENDA_LIMITS.serviceName) {
      return `Cada serviço precisa de um nome com até ${AGENDA_LIMITS.serviceName} caracteres.`
    }
    const description = text(record.description)
    if (description.length > AGENDA_LIMITS.serviceDescription) {
      return `A descrição do serviço deve ter até ${AGENDA_LIMITS.serviceDescription} caracteres.`
    }
    const durationMinutes = integer(record.durationMinutes, AGENDA_LIMITS.minDuration, AGENDA_LIMITS.maxDuration)
    if (durationMinutes === null) return `A duração de "${name}" é inválida.`

    const id = typeof record.id === "string" && UUID_PATTERN.test(record.id) ? record.id : crypto.randomUUID()
    if (ids.has(id)) return "Há serviços duplicados."
    ids.add(id)
    services.push({ id, name, description: description || null, durationMinutes, active: record.active !== false })
  }
  return services
}

function parseBlockedDates(input: unknown): BlockedDate[] | string {
  const list = Array.isArray(input) ? input : []
  if (list.length > AGENDA_LIMITS.blockedDates) return `Bloqueie no máximo ${AGENDA_LIMITS.blockedDates} datas.`

  const byDate = new Map<string, BlockedDate>()
  for (const item of list) {
    const record = asRecord(item)
    const date = text(record.date)
    if (!isValidDateKey(date)) return "Há uma data bloqueada inválida."
    const reason = text(record.reason).slice(0, AGENDA_LIMITS.blockedReason)
    const id = typeof record.id === "string" && UUID_PATTERN.test(record.id) ? record.id : crypto.randomUUID()
    byDate.set(date, { id, date, reason: reason || null })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Valida a configuração da Agenda enviada pelo navegador antes de qualquer escrita. */
export function parseAvailabilityConfig(input: unknown): AgendaValidation {
  const raw = asRecord(input)

  const hours = parseHours(raw.hours)
  if (typeof hours === "string") return { ok: false, error: hours }
  const services = parseServices(raw.services)
  if (typeof services === "string") return { ok: false, error: services }
  const blockedDates = parseBlockedDates(raw.blockedDates)
  if (typeof blockedDates === "string") return { ok: false, error: blockedDates }

  const settings = asRecord(raw.settings)
  const timezone = text(settings.timezone) || DEFAULT_SCHEDULING_SETTINGS.timezone
  if (!isValidTimeZone(timezone)) return { ok: false, error: "Fuso horário inválido." }
  const slotIntervalMinutes = integer(
    settings.slotIntervalMinutes,
    AGENDA_LIMITS.minSlotInterval,
    AGENDA_LIMITS.maxSlotInterval,
  )
  if (slotIntervalMinutes === null) return { ok: false, error: "Intervalo entre horários inválido." }
  const minNoticeMinutes = integer(settings.minNoticeMinutes, 0, AGENDA_LIMITS.maxMinNotice)
  if (minNoticeMinutes === null) return { ok: false, error: "Antecedência mínima inválida." }

  return {
    ok: true,
    config: { hours, services, blockedDates, settings: { timezone, slotIntervalMinutes, minNoticeMinutes } },
  }
}
