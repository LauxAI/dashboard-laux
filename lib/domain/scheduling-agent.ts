import type { SchedulingAgentBehavior, SchedulingAgentConfig, SchedulingAgentStatus, SchedulingTone } from "./types"

export const schedulingToneValues: SchedulingTone[] = ["profissional", "amigavel", "direto", "personalizado"]

export const schedulingBehaviorKeys: (keyof SchedulingAgentBehavior)[] = [
  "offerAvailableSlots",
  "allowConfirmation",
  "allowCancellation",
  "allowRescheduling",
  "askName",
  "askPhone",
  "askEmail",
]

export const SCHEDULING_AGENT_LIMITS = { name: 80, description: 500, greeting: 500, customTone: 500 } as const

export const defaultSchedulingAgentConfig: SchedulingAgentConfig = {
  name: "",
  description: "",
  greeting: "",
  tone: "profissional",
  customTone: "",
  behavior: {
    offerAvailableSlots: false,
    allowConfirmation: false,
    allowCancellation: false,
    allowRescheduling: false,
    askName: false,
    askPhone: false,
    askEmail: false,
  },
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

/**
 * Converte qualquer valor (jsonb vindo do banco ou payload do cliente) numa
 * configuração válida, descartando chaves desconhecidas e tipos incorretos.
 */
export function normalizeSchedulingAgentConfig(input: unknown): SchedulingAgentConfig {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const rawBehavior = (raw.behavior && typeof raw.behavior === "object" ? raw.behavior : {}) as Record<string, unknown>

  const behavior = { ...defaultSchedulingAgentConfig.behavior }
  for (const key of schedulingBehaviorKeys) behavior[key] = rawBehavior[key] === true

  const tone = schedulingToneValues.includes(raw.tone as SchedulingTone)
    ? (raw.tone as SchedulingTone)
    : defaultSchedulingAgentConfig.tone

  return {
    name: text(raw.name, SCHEDULING_AGENT_LIMITS.name),
    description: text(raw.description, SCHEDULING_AGENT_LIMITS.description),
    greeting: text(raw.greeting, SCHEDULING_AGENT_LIMITS.greeting),
    tone,
    customTone: tone === "personalizado" ? text(raw.customTone, SCHEDULING_AGENT_LIMITS.customTone) : "",
    behavior,
  }
}

export function normalizeSchedulingAgentStatus(value: unknown): SchedulingAgentStatus {
  return value === "ativo" ? "ativo" : "inativo"
}

/** Retorna a mensagem de erro de validação, ou null quando a configuração é válida. */
export function validateSchedulingAgentConfig(config: SchedulingAgentConfig): string | null {
  if (!config.name) return "Informe o nome do agente."
  if (config.tone === "personalizado" && !config.customTone) return "Descreva o tom de voz personalizado."
  return null
}
