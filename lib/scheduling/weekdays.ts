import type { WeekdayKey } from "@/lib/domain/types"

/** Convenção do banco (`business_hours.weekday`): 0 = domingo … 6 = sábado. */
export const WEEKDAY_NUMBER: Record<WeekdayKey, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
}

export function weekdayKeyFromNumber(value: number): WeekdayKey | null {
  const entry = Object.entries(WEEKDAY_NUMBER).find(([, number]) => number === value)
  return entry ? (entry[0] as WeekdayKey) : null
}
