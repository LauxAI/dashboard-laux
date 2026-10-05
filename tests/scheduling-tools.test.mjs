import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseAvailabilityConfig } from "../lib/scheduling/agenda-validation.ts"
import { checkSlot, listDaySlots, zonedToUtc } from "../lib/scheduling/availability.ts"
import { allowedSchedulingTools, createSchedulingToolExecutor } from "../lib/scheduling/tool-executor.ts"

const TZ = "America/Sao_Paulo"
// Segunda-feira, 11/05/2026, 09:00 em São Paulo.
const NOW = new Date("2026-05-11T12:00:00Z")
const COMPANY = "company-a"
const SERVICE = { id: "svc-1", name: "Consulta", description: null, durationMinutes: 60 }

const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  opensAt: "09:00",
  closesAt: "18:00",
  breakStart: null,
  breakEnd: null,
}))

const rules = {
  services: [SERVICE],
  hours: weekdays,
  blockedDates: ["2026-05-13"],
  settings: { timezone: TZ, slotIntervalMinutes: 30, minNoticeMinutes: 60 },
}

const behavior = {
  askName: true,
  askPhone: false,
  askEmail: false,
  allowConfirmation: true,
  offerAvailableSlots: true,
  allowCancellation: true,
  allowRescheduling: true,
}

function availability(busy = []) {
  return { hours: rules.hours, blockedDates: rules.blockedDates, settings: rules.settings, busy, now: NOW }
}

function fakeRepo({ appointments = [], conflictOnInsert = false } = {}) {
  const calls = []
  const store = [...appointments]
  return {
    calls,
    store,
    async loadRules(companyId) {
      calls.push(["loadRules", companyId])
      return rules
    },
    async listBusy(companyId) {
      calls.push(["listBusy", companyId])
      return store.filter((item) => item.status !== "cancelado").map(({ id, start, end }) => ({ id, start, end }))
    },
    async findCustomerAppointments(companyId, identity) {
      calls.push(["findCustomerAppointments", companyId, identity])
      return store.filter((item) => item.email === identity.email && item.status !== "cancelado")
    },
    async insertAppointment(companyId, appointment) {
      calls.push(["insertAppointment", companyId, appointment])
      if (conflictOnInsert) return { ok: false, reason: "conflict" }
      const record = { id: `apt-${store.length + 1}`, serviceId: appointment.serviceId, title: appointment.title, start: appointment.start, end: appointment.end, status: "agendado" }
      store.push(record)
      return { ok: true, appointment: record }
    },
    async cancelAppointment(companyId, id) {
      calls.push(["cancelAppointment", companyId, id])
      const record = store.find((item) => item.id === id)
      record.status = "cancelado"
      return { ok: true, appointment: record }
    },
    async rescheduleAppointment(companyId, id, start, end) {
      calls.push(["rescheduleAppointment", companyId, id])
      const record = store.find((item) => item.id === id)
      Object.assign(record, { start, end })
      return { ok: true, appointment: record }
    },
  }
}

function executor(repo, overrides = {}) {
  return createSchedulingToolExecutor({
    companyId: COMPANY,
    behavior: { ...behavior, ...(overrides.behavior ?? {}) },
    customer: { name: null, phone: null, email: null },
    userText: overrides.userText ?? "Meu nome é Ana Souza, e-mail ana@example.com",
    now: NOW,
    repo,
  })
}

describe("disponibilidade", () => {
  it("aceita horário livre dentro do expediente", () => {
    const slot = checkSlot(availability(), "2026-05-12", 10 * 60, 60)
    assert.equal(slot.ok, true)
    assert.equal(slot.start.toISOString(), "2026-05-12T13:00:00.000Z")
    assert.equal(slot.end.toISOString(), "2026-05-12T14:00:00.000Z")
  })

  it("recusa data bloqueada, dia fechado, fora do expediente e sem antecedência", () => {
    assert.deepEqual(checkSlot(availability(), "2026-05-13", 10 * 60, 60), { ok: false, reason: "blocked_date" })
    assert.deepEqual(checkSlot(availability(), "2026-05-17", 10 * 60, 60), { ok: false, reason: "closed_day" })
    assert.deepEqual(checkSlot(availability(), "2026-05-12", 17 * 60 + 30, 60), { ok: false, reason: "outside_hours" })
    assert.deepEqual(checkSlot(availability(), "2026-05-11", 9 * 60 + 30, 60), { ok: false, reason: "insufficient_notice" })
  })

  it("recusa horário que sobrepõe agendamento existente", () => {
    const busy = [{ id: "x", start: zonedToUtc("2026-05-12", 10 * 60 + 30, TZ), end: zonedToUtc("2026-05-12", 11 * 60 + 30, TZ) }]
    assert.deepEqual(checkSlot(availability(busy), "2026-05-12", 10 * 60, 60), { ok: false, reason: "conflict" })
    const day = listDaySlots(availability(busy), "2026-05-12", 60)
    assert.equal(day.ok, true)
    assert.ok(!day.times.includes("10:00"))
    assert.ok(day.times.includes("09:00"))
  })
})

describe("ferramentas do agente", () => {
  it("expõe apenas as ferramentas permitidas pela configuração", () => {
    const tools = allowedSchedulingTools({ ...behavior, allowCancellation: false, allowRescheduling: false })
    assert.deepEqual(tools.sort(), ["create_appointment", "get_availability", "get_services"])
  })

  it("cria agendamento usando o companyId do servidor, ignorando company_id do modelo", async () => {
    const repo = fakeRepo()
    const outcome = await executor(repo).execute("create_appointment", {
      company_id: "company-b",
      service_id: SERVICE.id,
      start: "2026-05-12T10:00",
      customer_name: "Ana Souza",
    })
    assert.equal(outcome.ok, true)
    assert.equal(outcome.action.type, "created")
    assert.ok(repo.calls.every((call) => call[1] === COMPANY))
    assert.equal(repo.store.length, 1)
  })

  it("não grava sem os dados obrigatórios do cliente", async () => {
    const repo = fakeRepo()
    const outcome = await executor(repo, { userText: "Quero marcar amanhã às 10h" }).execute("create_appointment", {
      service_id: SERVICE.id,
      start: "2026-05-12T10:00",
      customer_name: "Nome Inventado",
    })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.response.error, "missing_customer_data")
    assert.equal(repo.store.length, 0)
  })

  it("não grava em data bloqueada e sugere nada inventado", async () => {
    const repo = fakeRepo()
    const outcome = await executor(repo).execute("create_appointment", {
      service_id: SERVICE.id,
      start: "2026-05-13T10:00",
      customer_name: "Ana Souza",
    })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.response.error, "blocked_date")
    assert.equal(outcome.action, null)
    assert.equal(repo.store.length, 0)
  })

  it("trata conflito do banco (reserva simultânea) como horário indisponível", async () => {
    const outcome = await executor(fakeRepo({ conflictOnInsert: true })).execute("create_appointment", {
      service_id: SERVICE.id,
      start: "2026-05-12T10:00",
      customer_name: "Ana Souza",
    })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.response.error, "conflict")
    assert.equal(outcome.action, null)
  })

  it("recusa ação desativada na configuração", async () => {
    const repo = fakeRepo()
    const outcome = await executor(repo, { behavior: { allowConfirmation: false } }).execute("create_appointment", {
      service_id: SERVICE.id,
      start: "2026-05-12T10:00",
      customer_name: "Ana Souza",
    })
    assert.equal(outcome.response.error, "not_allowed")
    assert.equal(repo.calls.length, 0)
  })

  it("recusa serviço inexistente e ferramenta desconhecida", async () => {
    const repo = fakeRepo()
    const unknownService = await executor(repo).execute("get_availability", { service_id: "nao-existe" })
    assert.equal(unknownService.response.error, "unknown_service")
    const unknownTool = await executor(repo).execute("delete_everything", {})
    assert.equal(unknownTool.response.error, "unknown_tool")
  })

  it("cancela somente após o cliente escolher o agendamento", async () => {
    const existing = {
      id: "apt-9",
      serviceId: SERVICE.id,
      title: "Consulta",
      start: zonedToUtc("2026-05-14", 14 * 60, TZ),
      end: zonedToUtc("2026-05-14", 15 * 60, TZ),
      status: "agendado",
      email: "ana@example.com",
    }
    const repo = fakeRepo({ appointments: [existing] })
    const list = await executor(repo).execute("cancel_appointment", { customer_email: "ana@example.com" })
    assert.equal(list.ok, true)
    assert.equal(list.response.requires_selection, true)
    assert.equal(list.action, null)
    assert.equal(existing.status, "agendado")

    const done = await executor(repo).execute("cancel_appointment", { customer_email: "ana@example.com", appointment_id: "apt-9" })
    assert.equal(done.action.type, "cancelled")
    assert.equal(existing.status, "cancelado")
  })

  it("reagenda validando o novo horário", async () => {
    const existing = {
      id: "apt-9",
      serviceId: SERVICE.id,
      title: "Consulta",
      start: zonedToUtc("2026-05-14", 14 * 60, TZ),
      end: zonedToUtc("2026-05-14", 15 * 60, TZ),
      status: "agendado",
      email: "ana@example.com",
    }
    const repo = fakeRepo({ appointments: [existing] })
    const blocked = await executor(repo).execute("reschedule_appointment", {
      customer_email: "ana@example.com",
      appointment_id: "apt-9",
      new_start: "2026-05-13T10:00",
    })
    assert.equal(blocked.response.error, "blocked_date")

    const moved = await executor(repo).execute("reschedule_appointment", {
      customer_email: "ana@example.com",
      appointment_id: "apt-9",
      new_start: "2026-05-14T14:30",
    })
    assert.equal(moved.ok, true, "o próprio agendamento não conta como conflito")
    assert.equal(moved.action.type, "rescheduled")
  })
})

describe("validação da Agenda", () => {
  const valid = {
    hours: [{ day: "segunda", enabled: true, start: "09:00", end: "18:00" }],
    services: [{ name: "Consulta", description: "", durationMinutes: 60, active: true }],
    blockedDates: [{ date: "2026-12-25", reason: "Natal" }],
    settings: { timezone: TZ, slotIntervalMinutes: 30, minNoticeMinutes: 60 },
  }

  it("aceita configuração válida e completa os 7 dias", () => {
    const result = parseAvailabilityConfig(valid)
    assert.equal(result.ok, true)
    assert.equal(result.config.hours.length, 7)
    assert.match(result.config.services[0].id, /^[0-9a-f-]{36}$/)
  })

  it("recusa horário invertido, duração inválida, data inválida e fuso desconhecido", () => {
    assert.equal(parseAvailabilityConfig({ ...valid, hours: [{ day: "segunda", enabled: true, start: "18:00", end: "09:00" }] }).ok, false)
    assert.equal(parseAvailabilityConfig({ ...valid, services: [{ name: "X", durationMinutes: 0 }] }).ok, false)
    assert.equal(parseAvailabilityConfig({ ...valid, blockedDates: [{ date: "2026-02-30" }] }).ok, false)
    assert.equal(parseAvailabilityConfig({ ...valid, settings: { ...valid.settings, timezone: "Mars/Base" } }).ok, false)
  })
})
