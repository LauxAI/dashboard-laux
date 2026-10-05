const TIME_ZONE = "America/Sao_Paulo"

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE })
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" })
const dayLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "long",
  day: "2-digit",
  month: "long",
})

/** "YYYY-MM-DD" no fuso de Brasília, para agrupar compromissos por dia de forma estável. */
export function toDayKey(date: Date | string) {
  return dayKeyFormatter.format(typeof date === "string" ? new Date(date) : date)
}

export function formatAgendaTime(iso: string) {
  return timeFormatter.format(new Date(iso))
}

export function formatDayKey(dayKey: string) {
  const label = dayLabelFormatter.format(new Date(`${dayKey}T12:00:00Z`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Chaves de segunda a domingo da semana que contém `dayKey`. */
export function weekDayKeys(dayKey: string) {
  const anchor = new Date(`${dayKey}T12:00:00Z`)
  const offsetFromMonday = (anchor.getUTCDay() + 6) % 7
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(anchor)
    day.setUTCDate(anchor.getUTCDate() - offsetFromMonday + index)
    return day.toISOString().slice(0, 10)
  })
}
