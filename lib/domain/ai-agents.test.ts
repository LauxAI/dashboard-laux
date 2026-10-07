import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  AI_AGENT_LIMITS,
  defaultAIAgentConfig,
  hasGreetingField,
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

describe("mensagem inicial", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

  it("somente o Atendimento possui o campo de mensagem inicial", () => {
    expect(hasGreetingField("atendimento")).toBe(true)
    expect(hasGreetingField("vendas")).toBe(false)
    expect(hasGreetingField("suporte")).toBe(false)
  })

  it("o Atendimento mantém a mensagem inicial normalizada", () => {
    expect(normalizeAIAgentConfig("atendimento", { greeting: "  Olá!  " }).greeting).toBe("Olá!")
    const long = normalizeAIAgentConfig("atendimento", { greeting: "x".repeat(AI_AGENT_LIMITS.greeting + 20) })
    expect(long.greeting).toHaveLength(AI_AGENT_LIMITS.greeting)
  })

  it("Vendas e Suporte descartam qualquer mensagem inicial vinda de configurações antigas", () => {
    expect(normalizeAIAgentConfig("vendas", { ...base, greeting: "Olá, vim vender!" }).greeting).toBe("")
    expect(normalizeAIAgentConfig("suporte", { ...base, greeting: "Olá, vim ajudar!" }).greeting).toBe("")
  })

  it("preserva as demais configurações de Vendas e Suporte", () => {
    const sales = normalizeAIAgentConfig("vendas", {
      ...base,
      greeting: "x",
      knowledge: "Garantia de 1 ano",
      offerings: [{ name: "Plano" }],
      salesApproach: "consultiva",
    })
    expect(sales).toMatchObject({ knowledge: "Garantia de 1 ano", salesApproach: "consultiva" })
    expect(sales.offerings).toHaveLength(1)

    const support = normalizeAIAgentConfig("suporte", {
      ...base,
      greeting: "x",
      procedures: [{ title: "Reset", steps: ["a"] }],
      unresolvedBehavior: "encaminhar",
    })
    expect(support).toMatchObject({ unresolvedBehavior: "encaminhar" })
    expect(support.procedures).toHaveLength(1)
  })

  it("a UI só renderiza o campo quando o tipo possui mensagem inicial", () => {
    const form = read("components/agents/ai-agent-form.tsx")
    expect(form).toContain("hasGreetingField(type) && (")
    expect(form.match(/Mensagem inicial/g)).toHaveLength(1)
    const [beforeLabel] = form.split("Mensagem inicial")
    expect(beforeLabel.trimEnd().endsWith("<FieldLabel htmlFor=\"agent-greeting\">")).toBe(true)
    expect(beforeLabel.lastIndexOf("hasGreetingField(type) && (")).toBeGreaterThan(beforeLabel.lastIndexOf("</Field>"))
  })

  it("Agendamento não tem mensagem inicial na UI", () => {
    expect(read("components/agents/scheduling-agent-form.tsx")).not.toMatch(/Mensagem inicial|greeting/)
  })

  it("nenhuma camada de execução usa a mensagem inicial como fala do agente", () => {
    for (const file of ["lib/ai/agent-prompt.ts", "lib/ai/agent-runner.ts", "lib/ai/specialists.ts", "lib/ai/specialist-tools.ts"]) {
      expect(read(file)).not.toMatch(/greeting/)
    }
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
