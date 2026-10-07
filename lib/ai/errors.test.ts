import { describe, expect, it } from "vitest"
import { classifyAgentError, isFallbackEligible, sanitizeDetail } from "./errors"

const httpError = (statusCode: number, message = "falha") => Object.assign(new Error(message), { statusCode })

describe("classifyAgentError", () => {
  it.each([
    [503, "gemini_overloaded", true],
    [429, "gemini_rate_limited", true],
    [504, "gemini_timeout", true],
    [500, "gemini_server_error", true],
    [404, "gemini_model_unavailable", true],
    [401, "gemini_auth", false],
    [403, "gemini_auth", false],
    [400, "gemini_bad_request", true],
  ])("status %i vira %s", (status, code, retryable) => {
    expect(classifyAgentError(httpError(status))).toMatchObject({ code, retryable, status })
  })

  it("identifica timeout e cancelamento pelo nome do erro", () => {
    expect(classifyAgentError(Object.assign(new Error("x"), { name: "TimeoutError" })).code).toBe("gemini_timeout")
    expect(classifyAgentError(Object.assign(new Error("x"), { name: "AbortError" })).code).toBe("request_aborted")
  })

  it("identifica chave ausente e resposta vazia", () => {
    expect(classifyAgentError(Object.assign(new Error("x"), { name: "GeminiNotConfiguredError" })).code).toBe(
      "gemini_not_configured",
    )
    expect(classifyAgentError(new Error("empty_model_response")).code).toBe("empty_response")
  })

  it("desce por lastError para achar o status real", () => {
    const wrapper = Object.assign(new Error("Failed after 3 attempts"), { lastError: httpError(503, "overloaded") })
    expect(classifyAgentError(wrapper)).toMatchObject({ code: "gemini_overloaded", status: 503 })
  })

  it("erros desconhecidos não são repetíveis", () => {
    expect(classifyAgentError(new Error("???"))).toMatchObject({ code: "unknown", retryable: false })
  })

  it("não vaza a chave no detalhe", () => {
    const key = "AIza" + "a".repeat(35)
    const info = classifyAgentError(httpError(400, `https://x/y?key=${key} falhou com ${key}`))
    expect(info.detail).not.toContain(key)
  })
})

describe("sanitizeDetail", () => {
  it("remove tokens bearer e limita o tamanho", () => {
    expect(sanitizeDetail("Authorization: Bearer abcdefghijklmnop1234")).toContain("[token]")
    expect(sanitizeDetail("a".repeat(1000)).length).toBeLessThanOrEqual(300)
  })
})

describe("isFallbackEligible", () => {
  it("não troca de modelo para falhas de chave ou cancelamento", () => {
    expect(isFallbackEligible(classifyAgentError(httpError(401)))).toBe(false)
    expect(isFallbackEligible(classifyAgentError(Object.assign(new Error("x"), { name: "AbortError" })))).toBe(false)
    expect(isFallbackEligible(classifyAgentError(httpError(503)))).toBe(true)
  })
})
