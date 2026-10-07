import { describe, expect, it } from "vitest"
import { createFallbackStream, type AttemptHandle } from "./fallback"

const httpError = (statusCode: number) => Object.assign(new Error("falha"), { statusCode })

async function* chunks(parts: string[], failWith?: unknown) {
  for (const part of parts) yield part
  if (failWith) throw failWith
}

const handle = (parts: string[], options: { error?: unknown; sideEffects?: boolean } = {}): AttemptHandle => ({
  textStream: chunks(parts, options.error),
  getError: () => options.error,
  usage: async () => ({ inputTokens: 1, outputTokens: 2 }),
  sideEffectsStarted: () => options.sideEffects ?? false,
})

async function collect(stream: ReturnType<typeof createFallbackStream>) {
  let text = ""
  for await (const part of stream.textStream) text += part
  return text
}

describe("createFallbackStream", () => {
  it("usa o primeiro modelo quando ele responde", async () => {
    const stream = createFallbackStream({ models: ["a", "b"], start: () => handle(["Olá"]) })
    expect(await collect(stream)).toBe("Olá")
    expect(stream.model()).toBe("a")
    expect(stream.attempts()).toHaveLength(0)
    expect(stream.getError()).toBeUndefined()
  })

  it("recorre ao próximo modelo quando o primeiro falha sem entregar texto", async () => {
    const started: string[] = []
    const stream = createFallbackStream({
      models: ["a", "b"],
      start: (model) => {
        started.push(model)
        return model === "a" ? handle([], { error: httpError(503) }) : handle(["Resposta de b"])
      },
    })
    expect(await collect(stream)).toBe("Resposta de b")
    expect(started).toEqual(["a", "b"])
    expect(stream.attempts()[0]).toMatchObject({ model: "a", code: "gemini_overloaded", willRetry: true })
    expect(stream.getError()).toBeUndefined()
  })

  it("não troca de modelo depois de entregar texto, para não duplicar a resposta", async () => {
    const stream = createFallbackStream({
      models: ["a", "b"],
      start: (model) => (model === "a" ? handle(["Parcial"], { error: httpError(503) }) : handle(["outro"])),
    })
    expect(await collect(stream)).toBe("Parcial")
    expect(stream.getError()).toBeDefined()
    expect(stream.attempts()[0].willRetry).toBe(false)
  })

  it("não troca de modelo depois de uma ação irreversível", async () => {
    const stream = createFallbackStream({
      models: ["a", "b"],
      start: (model) =>
        model === "a" ? handle([], { error: httpError(503), sideEffects: true }) : handle(["repetido"]),
    })
    expect(await collect(stream)).toBe("")
    expect(stream.attempts()[0].willRetry).toBe(false)
  })

  it("não troca de modelo quando a chave é recusada", async () => {
    const started: string[] = []
    const stream = createFallbackStream({
      models: ["a", "b"],
      start: (model) => {
        started.push(model)
        return handle([], { error: httpError(401) })
      },
    })
    await collect(stream)
    expect(started).toEqual(["a"])
  })

  it("trata resposta vazia como falha e tenta o próximo modelo", async () => {
    const stream = createFallbackStream({
      models: ["a", "b"],
      start: (model) => (model === "a" ? handle(["  "]) : handle(["ok"])),
    })
    expect(await collect(stream)).toBe("  ok")
    expect(stream.attempts()[0].code).toBe("empty_response")
  })

  it("respeita o orçamento de tempo antes de iniciar nova tentativa", async () => {
    let clock = 0
    const started: string[] = []
    const stream = createFallbackStream({
      models: ["a", "b"],
      startBudgetMs: 1000,
      now: () => clock,
      start: (model) => {
        started.push(model)
        clock += 5000
        return handle([], { error: httpError(503) })
      },
    })
    await collect(stream)
    expect(started).toEqual(["a"])
    expect(stream.getError()).toBeDefined()
  })

  it("expõe o erro final quando todos os modelos falham", async () => {
    const stream = createFallbackStream({ models: ["a", "b"], start: () => handle([], { error: httpError(503) }) })
    await collect(stream)
    expect(stream.attempts()).toHaveLength(2)
    expect(stream.getError()).toBeDefined()
  })
})
