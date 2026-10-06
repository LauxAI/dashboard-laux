import { describe, expect, it } from "vitest"
import { parseTestRequest, TEST_LIMITS } from "./request"
import { evaluateUsage, USAGE_LIMITS } from "./usage"

describe("parseTestRequest", () => {
  it("aceita uma conversa válida e apara o conteúdo", () => {
    const result = parseTestRequest({
      messages: [
        { role: "user", content: " oi " },
        { role: "assistant", content: "olá" },
        { role: "user", content: "preço?" },
      ],
    })
    expect(result).toEqual({
      messages: [
        { role: "user", content: "oi" },
        { role: "assistant", content: "olá" },
        { role: "user", content: "preço?" },
      ],
    })
  })

  it.each([
    ["corpo nulo", null],
    ["sem mensagens", { messages: [] }],
    ["não é lista", { messages: "oi" }],
    ["papel inválido", { messages: [{ role: "system", content: "x" }] }],
    ["conteúdo não textual", { messages: [{ role: "user", content: 1 }] }],
    ["conteúdo vazio", { messages: [{ role: "user", content: "   " }] }],
    ["termina com assistant", { messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }],
  ])("rejeita %s", (_, body) => {
    expect(parseTestRequest(body)).toHaveProperty("error")
  })

  it("rejeita mensagem acima do limite e conversa longa demais", () => {
    expect(parseTestRequest({ messages: [{ role: "user", content: "x".repeat(TEST_LIMITS.maxUserChars + 1) }] })).toHaveProperty("error")
    const many = Array.from({ length: TEST_LIMITS.maxMessages + 1 }, () => ({ role: "user", content: "a" }))
    expect(parseTestRequest({ messages: many })).toHaveProperty("error")
  })

  it("ignora o company_id enviado pelo cliente", () => {
    const result = parseTestRequest({ companyId: "outra", messages: [{ role: "user", content: "oi" }] })
    expect(result).toEqual({ messages: [{ role: "user", content: "oi" }] })
  })
})

describe("evaluateUsage (monitoramento, sem bloqueio)", () => {
  it("não marca excesso dentro dos limites", () => {
    const snapshot = evaluateUsage(USAGE_LIMITS.perUser.calls - 1, USAGE_LIMITS.perCompany.calls - 1)
    expect(snapshot.userExceeded).toBe(false)
    expect(snapshot.companyExceeded).toBe(false)
  })

  it("marca excesso por usuário (20/10min) e por empresa (300/dia) de forma independente", () => {
    expect(evaluateUsage(20, 0)).toMatchObject({ userExceeded: true, companyExceeded: false })
    expect(evaluateUsage(0, 300)).toMatchObject({ userExceeded: false, companyExceeded: true })
  })

  it("expõe somente sinalizadores: não há campo de bloqueio", () => {
    expect(Object.keys(evaluateUsage(99, 999)).sort()).toEqual(["companyCalls", "companyExceeded", "userCalls", "userExceeded"])
  })
})
