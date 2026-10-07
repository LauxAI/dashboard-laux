export type BusinessHoursRow = {
  weekday: number
  opensAt: string
  closesAt: string
  breakStart: string | null
  breakEnd: string | null
}

export type BusyRange = { startMs: number; endMs: number }

export type Slot = { startsAt: string; endsAt: string; label: string }

export type SlotInput = {
  /** Data local da empresa, no formato YYYY-MM-DD. */
  date: string
  timezone: string
  hours: BusinessHoursRow[]
  isBlocked: boolean
  slotIntervalMinutes: number
  minNoticeMinutes: number
  durationMinutes: number
  busy: BusyRange[]
  nowMs: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseLocalDate(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_PATTERN.exec(value)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return { year, month, day }
}

function offsetMinutes(utcMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return (asUtc - Math.floor(utcMs / 1000) * 1000) / 60000
}

/** Converte data/hora locais de um fuso em milissegundos UTC. */
export function localToUtcMs(date: string, minutesOfDay: number, timezone: string): number | null {
  const parsed = parseLocalDate(date)
  if (!parsed) return null
  const guess = Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, minutesOfDay)
  const first = offsetMinutes(guess, timezone)
  const candidate = guess - first * 60000
  const second = offsetMinutes(candidate, timezone)
  return second === first ? candidate : guess - second * 60000
}

export function weekdayOf(date: string): number | null {
  const parsed = parseLocalDate(date)
  return parsed ? new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay() : null
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":")
  return Number(hours) * 60 + Number(minutes)
}

export function formatLocalTime(utcMs: number, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(utcMs),
  )
}

export function formatLocalDateTime(utcMs: number, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(utcMs))
}

export function localDateOf(utcMs: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(utcMs),
  )
  return parts
}

export function addDays(date: string, days: number): string | null {
  const parsed = parseLocalDate(date)
  if (!parsed) return null
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days)).toISOString().slice(0, 10)
}

const overlaps = (aStart: number, aEnd: number, b: BusyRange) => aStart < b.endMs && b.startMs < aEnd

/**
 * Horários livres de um dia: dentro do expediente, fora da pausa e de datas
 * bloqueadas, respeitando antecedência mínima e agendamentos existentes.
 */
export function computeSlots(input: SlotInput): Slot[] {
  if (input.isBlocked) return []
  const weekday = weekdayOf(input.date)
  if (weekday === null) return []

  const earliest = input.nowMs + input.minNoticeMinutes * 60000
  const slots: Slot[] = []

  for (const row of input.hours.filter((hours) => hours.weekday === weekday)) {
    const opens = timeToMinutes(row.opensAt)
    const closes = timeToMinutes(row.closesAt)
    const breakStart = row.breakStart ? timeToMinutes(row.breakStart) : null
    const breakEnd = row.breakEnd ? timeToMinutes(row.breakEnd) : null

    for (let start = opens; start + input.durationMinutes <= closes; start += input.slotIntervalMinutes) {
      const end = start + input.durationMinutes
      if (breakStart !== null && breakEnd !== null && start < breakEnd && breakStart < end) continue

      const startMs = localToUtcMs(input.date, start, input.timezone)
      const endMs = localToUtcMs(input.date, end, input.timezone)
      if (startMs === null || endMs === null || startMs < earliest) continue
      if (input.busy.some((range) => overlaps(startMs, endMs, range))) continue

      slots.push({
        startsAt: new Date(startMs).toISOString(),
        endsAt: new Date(endMs).toISOString(),
        label: formatLocalTime(startMs, input.timezone),
      })
    }
  }
  return slots
}

/** Verifica se um intervalo específico cabe no expediente e está livre. */
export function isSlotAvailable(input: Omit<SlotInput, "date"> & { startsAt: string }): boolean {
  const startMs = Date.parse(input.startsAt)
  if (Number.isNaN(startMs)) return false
  const date = localDateOf(startMs, input.timezone)
  return computeSlots({ ...input, date }).some((slot) => Date.parse(slot.startsAt) === startMs)
}
