import { describe, expect, it } from "vitest"
import {
  AI_AGENT_LIMITS,
  defaultAIAgentConfig,
  isAIAgentType,
  normalizeAIAgentConfig,
  normalizeAIAgentStatus,
  validateAIAgentConfig,
} from "./ai-agents"

const base = { name: "Bia", objective: "Ajudar clientes" }

describe("isAIAgentType / normalizeAIAgentStatus", () => {
  it("aceita somente os três tipos", () => {
    expect(isAIAgentType("atendimento")).toBe(true)
    expect(isAIAgentType("vendas")).toBe(true)
    expect(isAIAgentType("suporte")).toBe(true)
    expect(isAIAgentType("agendamento")).toBe(false)
    expect(isAIAgentType(undefined)).toBe(false)
  })

  it("trata qualquer status desconhecido como inativo", () => {
    expect(normalizeAIAgentStatus("ativo")).toBe("ativo")
    expect(normalizeAIAgentStatus("inativo")).toBe("inativo")
    expect(normalizeAIAgentStatus("x")).toBe("inativo")
    expect(normalizeAIAgentStatus(null)).toBe("inativo")
  })
})

describe("normalizeAIAgentConfig", () => {
  it("devolve a configuração padrão para entradas inválidas", () => {
    expect(normalizeAIAgentConfig("atendimento", null)).toEqual(defaultAIAgentConfig)
    expect(normalizeAIAgentConfig("atendimento", "texto")).toEqual(defaultAIAgentConfig)
    expect(normalizeAIAgentConfig("atendimento", [])).toEqual(defaultAIAgentConfig)
  })

  it("apara textos, descarta tipos errados e limita tamanhos", () => {
    const config = normalizeAIAgentConfig("atendimento", {
      name: "  Bia  ",
      objective: 42,
      knowledge: "x".repeat(AI_AGENT_LIMITS.knowledge + 50),
      tone: "invalido",
    })
    expect(config.name).toBe("Bia")
    expect(config.objective).toBe("")
    expect(config.knowledge).toHaveLength(AI_AGENT_LIMITS.knowledge)
    expect(config.tone).toBe("profissional")
  })

  it("limpa regras vazias e respeita o máximo", () => {
    const rules = Array.from({ length: 40 }, (_, i) => `regra ${i}`)
    const config = normalizeAIAgentConfig("atendimento", { rules: ["", "  ", ...rules, 7] })
    expect(config.rules).toHaveLength(AI_AGENT_LIMITS.rules)
    expect(config.rules[0]).toBe("regra 0")
  })

  it("só mantém customTone quando o tom é personalizado", () => {
    expect(normalizeAIAgentConfig("atendimento", { tone: "direto", customTone: "x" }).customTone).toBe("")
    expect(normalizeAIAgentConfig("atendimento", { tone: "personalizado", customTone: "x" }).customTone).toBe("x")
  })

  it("só mantém os critérios de transferência quando habilitada", () => {
    expect(normalizeAIAgentConfig("atendimento", { handoff: { enabled: false, criteria: "x" } }).handoff).toEqual({
      enabled: false,
      criteria: "",
    })
    expect(normalizeAIAgentConfig("atendimento", { handoff: { enabled: true, criteria: "x" } }).handoff).toEqual({
      enabled: true,
      criteria: "x",
    })
  })

  it("isola os campos específicos de cada agente", () => {
    const input = {
      ...base,
      offerings: [{ name: "Plano", description: "d", price: "R$ 10" }],
      salesApproach: "abordagem",
      procedures: [{ title: "Reset", steps: ["a"] }],
      unresolvedBehavior: "encaminhar",
    }
    const sales = normalizeAIAgentConfig("vendas", input)
    expect(sales.offerings).toHaveLength(1)
    expect(sales.salesApproach).toBe("abordagem")
    expect(sales.procedures).toEqual([])
    expect(sales.unresolvedBehavior).toBe("")

    const support = normalizeAIAgentConfig("suporte", input)
    expect(support.procedures).toEqual([{ title: "Reset", steps: ["a"] }])
    expect(support.unresolvedBehavior).toBe("encaminhar")
    expect(support.offerings).toEqual([])
    expect(support.salesApproach).toBe("")

    const service = normalizeAIAgentConfig("atendimento", input)
    expect(service.offerings).toEqual([])
    expect(service.procedures).toEqual([])
  })

  it("descarta ofertas sem nome e procedimentos sem título", () => {
    const sales = normalizeAIAgentConfig("vendas", { offerings: [{ name: "", price: "1" }, { name: "Ok" }, null] })
    expect(sales.offerings).toEqual([{ name: "Ok", description: "", price: "" }])
    const support = normalizeAIAgentConfig("suporte", { procedures: [{ title: "", steps: ["a"] }, { title: "T", steps: ["", "b"] }] })
    expect(support.procedures).toEqual([{ title: "T", steps: ["b"] }])
  })

  it("é idempotente", () => {
    const once = normalizeAIAgentConfig("vendas", { ...base, offerings: [{ name: " A " }], rules: [" r "] })
    expect(normalizeAIAgentConfig("vendas", once)).toEqual(once)
  })
})

describe("validateAIAgentConfig", () => {
  const make = (type: Parameters<typeof normalizeAIAgentConfig>[0], extra: object = {}) =>
    normalizeAIAgentConfig(type, { ...base, ...extra })

  it("exige nome e objetivo em todos os agentes", () => {
    expect(validateAIAgentConfig("atendimento", normalizeAIAgentConfig("atendimento", { objective: "x", knowledge: "k" }))).toMatch(/nome/i)
    expect(validateAIAgentConfig("atendimento", normalizeAIAgentConfig("atendimento", { name: "x", knowledge: "k" }))).toMatch(/objetivo/i)
  })

  it("Atendimento exige base de conhecimento", () => {
    expect(validateAIAgentConfig("atendimento", make("atendimento"))).toMatch(/conhecimento/i)
    expect(validateAIAgentConfig("atendimento", make("atendimento", { knowledge: "Horário: 9h" }))).toBeNull()
  })

  it("Vendas exige pelo menos um produto ou serviço", () => {
    expect(validateAIAgentConfig("vendas", make("vendas"))).toMatch(/produto/i)
    expect(validateAIAgentConfig("vendas", make("vendas", { offerings: [{ name: "Plano" }] }))).toBeNull()
  })

  it("Suporte exige conhecimento ou procedimento", () => {
    expect(validateAIAgentConfig("suporte", make("suporte"))).toMatch(/procedimento/i)
    expect(validateAIAgentConfig("suporte", make("suporte", { knowledge: "FAQ" }))).toBeNull()
    expect(validateAIAgentConfig("suporte", make("suporte", { procedures: [{ title: "Reset", steps: ["a"] }] }))).toBeNull()
  })

  it("exige tom personalizado descrito e critérios de transferência", () => {
    expect(validateAIAgentConfig("atendimento", make("atendimento", { knowledge: "k", tone: "personalizado" }))).toMatch(/tom/i)
    expect(
      validateAIAgentConfig("atendimento", make("atendimento", { knowledge: "k", handoff: { enabled: true, criteria: "" } })),
    ).toMatch(/transferir/i)
  })
})
