import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AvailabilityConfig, BusinessHoursDay } from "@/lib/domain/types"
import { DEFAULT_SCHEDULING_SETTINGS } from "./availability"
import { WEEKDAY_NUMBER, weekdayKeyFromNumber } from "./weekdays"

const hhmm = (value: string | null) => (value ? value.slice(0, 5) : "")

function fail(context: string, error: { message: string } | null): never {
  console.error(`[agenda-config] ${context}`, error?.message)
  throw new Error("Não foi possível acessar a configuração da agenda.")
}

/**
 * Lê a configuração da Agenda da empresa. As consultas passam pelo RLS da
 * sessão e também filtram por `company_id` explicitamente.
 */
export async function loadAvailabilityConfig(
  supabase: SupabaseClient,
  companyId: string,
): Promise<AvailabilityConfig> {
  const [hours, services, blocked, settings] = await Promise.all([
    supabase.from("business_hours").select("weekday, opens_at, closes_at").eq("company_id", companyId),
    supabase
      .from("scheduling_services")
      .select("id, name, description, duration_minutes, is_active")
      .eq("company_id", companyId)
      .order("created_at"),
    supabase.from("blocked_dates").select("id, date, reason").eq("company_id", companyId).order("date"),
    supabase
      .from("scheduling_settings")
      .select("timezone, slot_interval_minutes, min_notice_minutes")
      .eq("company_id", companyId)
      .maybeSingle(),
  ])
  if (hours.error) fail("business_hours", hours.error)
  if (services.error) fail("scheduling_services", services.error)
  if (blocked.error) fail("blocked_dates", blocked.error)
  if (settings.error) fail("scheduling_settings", settings.error)

  const openDays = new Map(
    (hours.data ?? []).map((row) => [weekdayKeyFromNumber(row.weekday), row] as const),
  )
  const week: BusinessHoursDay[] = (Object.keys(WEEKDAY_NUMBER) as BusinessHoursDay["day"][]).map((day) => {
    const row = openDays.get(day)
    return { day, enabled: Boolean(row), start: hhmm(row?.opens_at ?? null), end: hhmm(row?.closes_at ?? null) }
  })

  return {
    hours: week,
    services: (services.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      durationMinutes: row.duration_minutes,
      active: row.is_active,
    })),
    blockedDates: (blocked.data ?? []).map((row) => ({ id: row.id, date: row.date, reason: row.reason })),
    settings: settings.data
      ? {
          timezone: settings.data.timezone,
          slotIntervalMinutes: settings.data.slot_interval_minutes,
          minNoticeMinutes: settings.data.min_notice_minutes,
        }
      : { ...DEFAULT_SCHEDULING_SETTINGS },
  }
}

const inList = (values: (string | number)[]) => `(${values.map((value) => `"${value}"`).join(",")})`

/** Grava a configuração já validada. Cada tabela é sincronizada com a lista enviada. */
export async function saveAvailabilityConfig(
  supabase: SupabaseClient,
  companyId: string,
  config: AvailabilityConfig,
): Promise<void> {
  const settings = await supabase.from("scheduling_settings").upsert(
    {
      company_id: companyId,
      timezone: config.settings.timezone,
      slot_interval_minutes: config.settings.slotIntervalMinutes,
      min_notice_minutes: config.settings.minNoticeMinutes,
    },
    { onConflict: "company_id" },
  )
  if (settings.error) fail("save settings", settings.error)

  const openDays = config.hours.filter((day) => day.enabled)
  const openWeekdays = openDays.map((day) => WEEKDAY_NUMBER[day.day])
  let closeDays = supabase.from("business_hours").delete().eq("company_id", companyId)
  if (openWeekdays.length) closeDays = closeDays.not("weekday", "in", `(${openWeekdays.join(",")})`)
  const closed = await closeDays
  if (closed.error) fail("delete hours", closed.error)
  if (openDays.length) {
    const saved = await supabase.from("business_hours").upsert(
      openDays.map((day) => ({
        company_id: companyId,
        weekday: WEEKDAY_NUMBER[day.day],
        opens_at: day.start,
        closes_at: day.end,
        break_start: null,
        break_end: null,
      })),
      { onConflict: "company_id,weekday" },
    )
    if (saved.error) fail("save hours", saved.error)
  }

  const serviceIds = config.services.map((service) => service.id)
  let removeServices = supabase.from("scheduling_services").delete().eq("company_id", companyId)
  if (serviceIds.length) removeServices = removeServices.not("id", "in", inList(serviceIds))
  const removed = await removeServices
  if (removed.error) fail("delete services", removed.error)
  if (config.services.length) {
    const saved = await supabase.from("scheduling_services").upsert(
      config.services.map((service) => ({
        id: service.id,
        company_id: companyId,
        name: service.name,
        description: service.description,
        duration_minutes: service.durationMinutes,
        is_active: service.active,
      })),
      { onConflict: "id" },
    )
    if (saved.error) fail("save services", saved.error)
  }

  const dates = config.blockedDates.map((blocked) => blocked.date)
  let unblock = supabase.from("blocked_dates").delete().eq("company_id", companyId)
  if (dates.length) unblock = unblock.not("date", "in", inList(dates))
  const unblocked = await unblock
  if (unblocked.error) fail("delete blocked dates", unblocked.error)
  if (config.blockedDates.length) {
    const saved = await supabase.from("blocked_dates").upsert(
      config.blockedDates.map((blocked) => ({ company_id: companyId, date: blocked.date, reason: blocked.reason })),
      { onConflict: "company_id,date" },
    )
    if (saved.error) fail("save blocked dates", saved.error)
  }
}
