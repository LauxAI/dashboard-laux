import type {
  AIAgentConfig,
  AIAgentOffering,
  AIAgentProcedure,
  AIAgentStatus,
  AIAgentTone,
  AIAgentType,
} from "./types"

export const aiAgentTypes: AIAgentType[] = ["atendimento", "vendas", "suporte"]
export const aiAgentToneValues: AIAgentTone[] = ["profissional", "amigavel", "direto", "personalizado"]

export const AI_AGENT_LIMITS = {
  name: 80,
  description: 300,
  objective: 500,
  instructions: 4000,
  personality: 500,
  customTone: 300,
  rules: 20,
  rule: 300,
  knowledge: 12000,
  greeting: 300,
  fallbackBehavior: 500,
  handoffCriteria: 500,
  offerings: 50,
  offeringName: 120,
  offeringDescription: 500,
  offeringPrice: 60,
  salesApproach: 1000,
  objectionHandling: 1000,
  procedures: 30,
  procedureTitle: 120,
  procedureSteps: 20,
  procedureStep: 300,
  unresolvedBehavior: 500,
} as const

export const defaultAIAgentConfig: AIAgentConfig = {
  name: "",
  description: "",
  objective: "",
  instructions: "",
  personality: "",
  tone: "profissional",
  customTone: "",
  rules: [],
  knowledge: "",
  greeting: "",
  fallbackBehavior: "",
  handoff: { enabled: false, criteria: "" },
  offerings: [],
  salesApproach: "",
  objectionHandling: "",
  procedures: [],
  unresolvedBehavior: "",
}

export function isAIAgentType(value: unknown): value is AIAgentType {
  return typeof value === "string" && (aiAgentTypes as string[]).includes(value)
}

export function normalizeAIAgentStatus(value: unknown): AIAgentStatus {
  return value === "ativo" ? "ativo" : "inativo"
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

function textList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => text(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function normalizeOfferings(value: unknown): AIAgentOffering[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const raw = asObject(item)
      return {
        name: text(raw.name, AI_AGENT_LIMITS.offeringName),
        description: text(raw.description, AI_AGENT_LIMITS.offeringDescription),
        price: text(raw.price, AI_AGENT_LIMITS.offeringPrice),
      }
    })
    .filter((offering) => offering.name)
    .slice(0, AI_AGENT_LIMITS.offerings)
}

function normalizeProcedures(value: unknown): AIAgentProcedure[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const raw = asObject(item)
      return {
        title: text(raw.title, AI_AGENT_LIMITS.procedureTitle),
        steps: textList(raw.steps, AI_AGENT_LIMITS.procedureSteps, AI_AGENT_LIMITS.procedureStep),
      }
    })
    .filter((procedure) => procedure.title)
    .slice(0, AI_AGENT_LIMITS.procedures)
}

/**
 * Converte qualquer valor (jsonb do banco ou payload do cliente) numa
 * configuração válida para o tipo, descartando chaves, tipos e campos de
 * outros agentes.
 */
export function normalizeAIAgentConfig(type: AIAgentType, input: unknown): AIAgentConfig {
  const raw = asObject(input)
  const rawHandoff = asObject(raw.handoff)
  const tone = aiAgentToneValues.includes(raw.tone as AIAgentTone) ? (raw.tone as AIAgentTone) : "profissional"
  const handoffEnabled = rawHandoff.enabled === true

  return {
    name: text(raw.name, AI_AGENT_LIMITS.name),
    description: text(raw.description, AI_AGENT_LIMITS.description),
    objective: text(raw.objective, AI_AGENT_LIMITS.objective),
    instructions: text(raw.instructions, AI_AGENT_LIMITS.instructions),
    personality: text(raw.personality, AI_AGENT_LIMITS.personality),
    tone,
    customTone: tone === "personalizado" ? text(raw.customTone, AI_AGENT_LIMITS.customTone) : "",
    rules: textList(raw.rules, AI_AGENT_LIMITS.rules, AI_AGENT_LIMITS.rule),
    knowledge: text(raw.knowledge, AI_AGENT_LIMITS.knowledge),
    greeting: text(raw.greeting, AI_AGENT_LIMITS.greeting),
    fallbackBehavior: text(raw.fallbackBehavior, AI_AGENT_LIMITS.fallbackBehavior),
    handoff: {
      enabled: handoffEnabled,
      criteria: handoffEnabled ? text(rawHandoff.criteria, AI_AGENT_LIMITS.handoffCriteria) : "",
    },
    offerings: type === "vendas" ? normalizeOfferings(raw.offerings) : [],
    salesApproach: type === "vendas" ? text(raw.salesApproach, AI_AGENT_LIMITS.salesApproach) : "",
    objectionHandling: type === "vendas" ? text(raw.objectionHandling, AI_AGENT_LIMITS.objectionHandling) : "",
    procedures: type === "suporte" ? normalizeProcedures(raw.procedures) : [],
    unresolvedBehavior: type === "suporte" ? text(raw.unresolvedBehavior, AI_AGENT_LIMITS.unresolvedBehavior) : "",
  }
}

/**
 * Requisitos mínimos de configuração. Retorna a mensagem de erro, ou null
 * quando a configuração é válida (e portanto pode ser testada e ativada).
 */
export function validateAIAgentConfig(type: AIAgentType, config: AIAgentConfig): string | null {
  if (!config.name) return "Informe o nome do agente."
  if (!config.objective) return "Informe o objetivo do agente."
  if (config.tone === "personalizado" && !config.customTone) return "Descreva o tom de voz personalizado."
  if (config.handoff.enabled && !config.handoff.criteria) return "Informe quando transferir para um atendente humano."

  if (type === "atendimento" && !config.knowledge) return "Preencha a base de conhecimento do agente."
  if (type === "vendas" && config.offerings.length === 0) return "Cadastre pelo menos um produto ou serviço."
  if (type === "suporte" && !config.knowledge && config.procedures.length === 0) {
    return "Preencha a base de conhecimento ou cadastre pelo menos um procedimento."
  }
  return null
}
