import type { BusinessHoursRule, BusyInterval, SchedulingSettings } from "./availability.ts"

export interface ServiceRecord {
  id: string
  name: string
  description: string | null
  durationMinutes: number
}

export interface SchedulingRules {
  /** Apenas serviços ativos da empresa. */
  services: ServiceRecord[]
  hours: BusinessHoursRule[]
  blockedDates: string[]
  settings: SchedulingSettings
}

export interface AppointmentRecord {
  id: string
  serviceId: string | null
  title: string | null
  start: Date
  end: Date | null
  status: string
}

export interface NewAppointment {
  serviceId: string
  title: string
  start: Date
  end: Date
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
}

export type WriteResult = { ok: true; appointment: AppointmentRecord } | { ok: false; reason: "conflict" | "not_found" | "error" }

/**
 * Acesso à Agenda. Toda operação recebe o `companyId` resolvido pelo servidor
 * a partir da sessão — nunca um valor vindo do navegador ou do modelo.
 */
export interface SchedulingRepository {
  loadRules(companyId: string): Promise<SchedulingRules>
  /** Agendamentos não cancelados que podem sobrepor o intervalo [from, to). */
  listBusy(companyId: string, from: Date, to: Date): Promise<BusyInterval[]>
  /** Agendamentos futuros e não cancelados do cliente, por telefone ou e-mail. */
  findCustomerAppointments(
    companyId: string,
    identity: { phone: string | null; email: string | null },
    from: Date,
  ): Promise<AppointmentRecord[]>
  insertAppointment(companyId: string, appointment: NewAppointment): Promise<WriteResult>
  cancelAppointment(companyId: string, appointmentId: string): Promise<WriteResult>
  rescheduleAppointment(companyId: string, appointmentId: string, start: Date, end: Date): Promise<WriteResult>
}
