import type { SchedulingAgentBehavior, SchedulingAgentConfig, SchedulingAgentStatus } from "./types"

export const schedulingBehaviorKeys: (keyof SchedulingAgentBehavior)[] = [
  "offerAvailableSlots",
  "allowBooking",
  "allowLookup",
  "allowConfirmation",
  "allowCancellation",
  "allowRescheduling",
  "askName",
  "askPhone",
  "askEmail",
  "askService",
]

export const SCHEDULING_AGENT_LIMITS = { name: 80, description: 500 } as const

export const defaultSchedulingAgentConfig: SchedulingAgentConfig = {
  name: "Especialista de Agendamento",
  description:
    "Especialista responsável por consultar disponibilidade e gerenciar agendamentos durante os atendimentos.",
  behavior: {
    offerAvailableSlots: true,
    allowBooking: true,
    allowLookup: true,
    allowConfirmation: false,
    allowCancellation: false,
    allowRescheduling: false,
    askName: true,
    askPhone: true,
    askEmail: false,
    askService: true,
  },
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

/**
 * Converte qualquer valor (jsonb vindo do banco ou payload do cliente) numa
 * configuração válida, descartando chaves desconhecidas (inclusive a saudação e o
 * tom de voz legados) e tipos incorretos. Configurações antigas sem as
 * capacidades `allowBooking`/`allowLookup` herdam de `offerAvailableSlots`.
 */
export function normalizeSchedulingAgentConfig(input: unknown): SchedulingAgentConfig {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const rawBehavior = (raw.behavior && typeof raw.behavior === "object" ? raw.behavior : {}) as Record<string, unknown>

  const behavior = {} as SchedulingAgentBehavior
  for (const key of schedulingBehaviorKeys) behavior[key] = rawBehavior[key] === true
  if (typeof rawBehavior.allowBooking !== "boolean") behavior.allowBooking = behavior.offerAvailableSlots
  if (typeof rawBehavior.allowLookup !== "boolean") behavior.allowLookup = behavior.offerAvailableSlots

  return {
    name: text(raw.name, SCHEDULING_AGENT_LIMITS.name),
    description: text(raw.description, SCHEDULING_AGENT_LIMITS.description),
    behavior,
  }
}

export function normalizeSchedulingAgentStatus(value: unknown): SchedulingAgentStatus {
  return value === "ativo" ? "ativo" : "inativo"
}

/** Retorna a mensagem de erro de validação, ou null quando a configuração é válida. */
export function validateSchedulingAgentConfig(config: SchedulingAgentConfig): string | null {
  if (!config.name) return "Informe o nome do especialista."
  return null
}
