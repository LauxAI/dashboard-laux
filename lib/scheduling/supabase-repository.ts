import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_SCHEDULING_SETTINGS, isValidTimeZone } from "./availability"
import type { AppointmentRecord, SchedulingRepository, WriteResult } from "./repository"

/** Violação da exclusão `appointments_no_overlap` (dois agendamentos no mesmo intervalo). */
const EXCLUSION_VIOLATION = "23P01"
/** Janela usada para encontrar agendamentos que começaram antes e ainda estão em andamento. */
const LOOKBACK_MS = 24 * 60 * 60 * 1000

const APPOINTMENT_COLUMNS = "id, service_id, title, scheduled_at, ends_at, status"

interface AppointmentRow {
  id: string
  service_id: string | null
  title: string | null
  scheduled_at: string
  ends_at: string | null
  status: string
}

function toRecord(row: AppointmentRow): AppointmentRecord {
  return {
    id: row.id,
    serviceId: row.service_id,
    title: row.title,
    start: new Date(row.scheduled_at),
    end: row.ends_at ? new Date(row.ends_at) : null,
    status: row.status,
  }
}

function writeResult(data: AppointmentRow | null, error: { code?: string; message?: string } | null): WriteResult {
  if (error) {
    if (error.code === EXCLUSION_VIOLATION) return { ok: false, reason: "conflict" }
    console.error("[scheduling/supabase] Write failed", error.code, error.message)
    return { ok: false, reason: "error" }
  }
  return data ? { ok: true, appointment: toRecord(data) } : { ok: false, reason: "not_found" }
}

/**
 * Repositório da Agenda usando o cliente Supabase da sessão do usuário.
 * O RLS limita tudo à empresa da conta; o filtro explícito por `company_id`
 * é uma segunda barreira.
 */
export function createSupabaseSchedulingRepository(supabase: SupabaseClient): SchedulingRepository {
  return {
    async loadRules(companyId) {
      const [services, hours, blocked, settings] = await Promise.all([
        supabase
          .from("scheduling_services")
          .select("id, name, description, duration_minutes")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("business_hours")
          .select("weekday, opens_at, closes_at, break_start, break_end")
          .eq("company_id", companyId),
        supabase.from("blocked_dates").select("date").eq("company_id", companyId),
        supabase
          .from("scheduling_settings")
          .select("timezone, slot_interval_minutes, min_notice_minutes")
          .eq("company_id", companyId)
          .maybeSingle(),
      ])

      const failed = services.error ?? hours.error ?? blocked.error ?? settings.error
      if (failed) throw new Error(`Falha ao carregar regras da agenda: ${failed.message}`)

      const timezone = settings.data?.timezone
      return {
        services: (services.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          durationMinutes: row.duration_minutes,
        })),
        hours: (hours.data ?? []).map((row) => ({
          weekday: row.weekday,
          opensAt: row.opens_at,
          closesAt: row.closes_at,
          breakStart: row.break_start,
          breakEnd: row.break_end,
        })),
        blockedDates: (blocked.data ?? []).map((row) => row.date as string),
        settings: settings.data
          ? {
              timezone: timezone && isValidTimeZone(timezone) ? timezone : DEFAULT_SCHEDULING_SETTINGS.timezone,
              slotIntervalMinutes: settings.data.slot_interval_minutes,
              minNoticeMinutes: settings.data.min_notice_minutes,
            }
          : DEFAULT_SCHEDULING_SETTINGS,
      }
    },

    async listBusy(companyId, from, to) {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, ends_at")
        .eq("company_id", companyId)
        .neq("status", "cancelado")
        .gte("scheduled_at", new Date(from.getTime() - LOOKBACK_MS).toISOString())
        .lt("scheduled_at", to.toISOString())
      if (error) throw new Error(`Falha ao consultar agendamentos: ${error.message}`)
      return (data ?? []).map((row) => ({
        id: row.id,
        start: new Date(row.scheduled_at),
        end: row.ends_at ? new Date(row.ends_at) : null,
      }))
    },

    async findCustomerAppointments(companyId, { phone, email }, from) {
      const lookups = [
        phone ? ["client_phone", phone] : null,
        email ? ["client_email", email] : null,
      ].filter((item): item is [string, string] => item !== null)

      const results = await Promise.all(
        lookups.map(([column, value]) =>
          supabase
            .from("appointments")
            .select(APPOINTMENT_COLUMNS)
            .eq("company_id", companyId)
            .eq(column, value)
            .neq("status", "cancelado")
            .gte("scheduled_at", from.toISOString())
            .order("scheduled_at")
            .limit(10),
        ),
      )

      const byId = new Map<string, AppointmentRecord>()
      for (const { data, error } of results) {
        if (error) throw new Error(`Falha ao buscar agendamentos do cliente: ${error.message}`)
        for (const row of (data ?? []) as AppointmentRow[]) byId.set(row.id, toRecord(row))
      }
      return [...byId.values()].sort((a, b) => a.start.getTime() - b.start.getTime())
    },

    async insertAppointment(companyId, appointment) {
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          company_id: companyId,
          service_id: appointment.serviceId,
          title: appointment.title,
          scheduled_at: appointment.start.toISOString(),
          ends_at: appointment.end.toISOString(),
          client_name: appointment.clientName,
          client_phone: appointment.clientPhone,
          client_email: appointment.clientEmail,
          status: "confirmado",
          source: "agent",
        })
        .select(APPOINTMENT_COLUMNS)
        .single()
      return writeResult(data as AppointmentRow | null, error)
    },

    async cancelAppointment(companyId, appointmentId) {
      const { data, error } = await supabase
        .from("appointments")
        .update({ status: "cancelado", cancelled_at: new Date().toISOString() })
        .eq("company_id", companyId)
        .eq("id", appointmentId)
        .neq("status", "cancelado")
        .select(APPOINTMENT_COLUMNS)
        .maybeSingle()
      return writeResult(data as AppointmentRow | null, error)
    },

    async rescheduleAppointment(companyId, appointmentId, start, end) {
      const { data, error } = await supabase
        .from("appointments")
        .update({ scheduled_at: start.toISOString(), ends_at: end.toISOString(), status: "confirmado" })
        .eq("company_id", companyId)
        .eq("id", appointmentId)
        .neq("status", "cancelado")
        .select(APPOINTMENT_COLUMNS)
        .maybeSingle()
      return writeResult(data as AppointmentRow | null, error)
    },
  }
}
