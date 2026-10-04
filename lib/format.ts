function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) || date.getTime() === 0 ? null : date
}

export function formatRelativeTime(isoDate: string | null | undefined): string {
  const date = parseDate(isoDate)
  if (!date) return "—"
  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000)

  if (diffMinutes < 1) return "agora mesmo"
  if (diffMinutes < 60) return `há ${diffMinutes} min`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `há ${diffHours} h`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `há ${diffDays} d`

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatCurrencyBRL(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function formatDateBRL(isoDate: string | null | undefined): string {
  const date = parseDate(isoDate)
  if (!date) return "—"
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatDateTimeBRL(isoDate: string | null | undefined): string {
  const date = parseDate(isoDate)
  if (!date) return "—"
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatTimeBRL(isoDate: string | null | undefined): string {
  const date = parseDate(isoDate)
  if (!date) return "—"
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value)
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
}

export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
