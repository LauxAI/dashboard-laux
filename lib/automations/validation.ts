import {
  actionDefinitions,
  categoryKeys,
  conditionFields,
  getAction,
  getConditionField,
  getTrigger,
  operatorsWithoutValue,
  type Capability,
} from "./catalog"
import {
  MAX_DELAY_MINUTES,
  MAX_STEPS,
  type AutomationCategory,
  type AutomationDefinition,
  type AutomationStep,
  type ConditionOperator,
} from "./types"

export type Issue = {
  /** Índice da etapa (0 = primeira após o gatilho) ou null para problemas gerais. */
  stepIndex: number | null
  message: string
  severity: "error" | "warning"
}

export type ParsedSteps = { ok: true; steps: AutomationStep[] } | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Normaliza e valida a FORMA das etapas vindas do cliente ou do banco.
 * Não exige completude: um rascunho pode ter campos vazios.
 */
export function parseSteps(input: unknown): ParsedSteps {
  if (!Array.isArray(input)) return { ok: false, error: "Etapas inválidas." }
  if (input.length > MAX_STEPS) return { ok: false, error: `Use no máximo ${MAX_STEPS} etapas.` }

  const steps: AutomationStep[] = []
  for (const raw of input) {
    if (!isRecord(raw)) return { ok: false, error: "Etapa inválida." }

    if (raw.type === "condition") {
      const field = typeof raw.field === "string" ? getConditionField(raw.field) : undefined
      if (!field) return { ok: false, error: "Campo de condição inválido." }
      const operator = raw.operator as ConditionOperator
      if (!field.operators.includes(operator)) return { ok: false, error: "Operador de condição inválido." }
      const value = operatorsWithoutValue.includes(operator) ? "" : String(raw.value ?? "").trim().slice(0, 200)
      if (field.options && value !== "" && !field.options.some((option) => option.value === value)) {
        return { ok: false, error: "Valor de condição inválido." }
      }
      steps.push({ type: "condition", field: field.key, operator, value })
      continue
    }

    if (raw.type === "action") {
      const action = typeof raw.kind === "string" ? getAction(raw.kind) : undefined
      if (!action) return { ok: false, error: "Ação inválida." }
      const rawParams = isRecord(raw.params) ? raw.params : {}
      const params: Record<string, string> = {}
      for (const definition of action.params) {
        const value = String(rawParams[definition.key] ?? "").trim().slice(0, definition.maxLength)
        if (definition.options && value !== "" && !definition.options.some((option) => option.value === value)) {
          return { ok: false, error: "Valor de ação inválido." }
        }
        params[definition.key] = value
      }
      steps.push({ type: "action", kind: action.kind, params })
      continue
    }

    if (raw.type === "delay") {
      const minutes = Number(raw.minutes)
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_DELAY_MINUTES) {
        return { ok: false, error: "Espera inválida. Use de 1 minuto a 30 dias." }
      }
      steps.push({ type: "delay", minutes })
      continue
    }

    return { ok: false, error: "Tipo de etapa inválido." }
  }

  return { ok: true, steps }
}

export function parseCategory(value: unknown): AutomationCategory | null {
  return typeof value === "string" && (categoryKeys as string[]).includes(value) ? (value as AutomationCategory) : null
}

export type ReadinessContext = {
  hasWhatsAppConnection: boolean
  hasActiveAgent: boolean
}

/**
 * Completude da automação. `strict` é usado antes de ativar: tudo que o motor
 * precisa para executar sem falhar por configuração deve estar presente.
 */
export function validateDefinition(
  definition: AutomationDefinition,
  options: { strict: boolean; readiness?: ReadinessContext },
): Issue[] {
  const issues: Issue[] = []
  const add = (stepIndex: number | null, message: string, severity: Issue["severity"] = "error") =>
    issues.push({ stepIndex, message, severity })

  if (definition.name.trim().length === 0) add(null, "Dê um nome à automação.")
  if (definition.name.trim().length > 120) add(null, "O nome pode ter no máximo 120 caracteres.")

  const trigger = getTrigger(definition.triggerType)
  if (!trigger) {
    add(null, "Escolha o gatilho da automação.")
    return issues
  }

  const provided = new Set<Capability>(trigger.provides)
  let actionsCount = 0

  definition.steps.forEach((step, index) => {
    if (step.type === "condition") {
      const field = getConditionField(step.field)
      if (field && !provided.has(field.needs)) {
        add(index, `A condição "${field.label}" não está disponível para este gatilho.`)
      }
      if (options.strict && !operatorsWithoutValue.includes(step.operator) && step.value === "") {
        add(index, "Preencha o valor da condição.")
      }
      return
    }

    if (step.type === "delay") {
      if (options.strict && index === definition.steps.length - 1) {
        add(index, "A espera precisa ser seguida de uma ação.")
      }
      return
    }

    actionsCount += 1
    const action = getAction(step.kind)
    if (!action) return

    for (const need of action.needs) {
      if (!provided.has(need)) {
        add(index, `A ação "${action.label}" não funciona com este gatilho.`)
        break
      }
    }
    action.provides?.forEach((capability) => provided.add(capability))

    if (options.strict) {
      for (const param of action.params) {
        if (param.required && (step.params[param.key] ?? "") === "") {
          add(index, `Preencha "${param.label}" em "${action.label}".`)
        }
      }
      const readiness = options.readiness
      if (readiness) {
        if (action.group === "WhatsApp" && !readiness.hasWhatsAppConnection) {
          add(index, "Conecte um número de WhatsApp antes de ativar.")
        }
        if (action.kind === "whatsapp.run_agent" && !readiness.hasActiveAgent) {
          add(index, "Ative um agente de IA antes de usar esta ação.")
        }
      }
    }
  })

  if (options.strict) {
    if (actionsCount === 0) add(null, "Adicione ao menos uma ação.")
    if (!trigger.wired) {
      add(
        null,
        "Este gatilho ainda não recebe eventos do sistema. A automação ficará ativa, mas só executa quando houver uma origem conectada.",
        "warning",
      )
    }
  }

  return issues
}

export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((issue) => issue.severity === "error")
}

export const knownActionKinds = actionDefinitions.map((action) => action.kind)
export const knownConditionFields = conditionFields.map((field) => field.key)
