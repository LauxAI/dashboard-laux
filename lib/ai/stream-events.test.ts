import { describe, expect, it } from "vitest"
import { encodeStreamEvent, parseStreamLine, splitStreamBuffer } from "@/lib/ai/stream-events"

describe("stream-events", () => {
  it("codifica e decodifica delta, done e error", () => {
    const events = [
      { type: "delta", text: "Olá\nmundo" },
      { type: "done", usage: { userExceeded: true, companyExceeded: false } },
      { type: "error", error: "Falhou" },
    ] as const
    for (const event of events) {
      const line = encodeStreamEvent(event)
      expect(line.endsWith("\n")).toBe(true)
      expect(line.slice(0, -1)).not.toContain("\n")
      expect(parseStreamLine(line.trim())).toEqual(event)
    }
  })

  it("ignora linhas vazias, inválidas ou desconhecidas", () => {
    expect(parseStreamLine("")).toBeNull()
    expect(parseStreamLine("não é json")).toBeNull()
    expect(parseStreamLine('{"type":"outro"}')).toBeNull()
    expect(parseStreamLine('{"type":"delta","text":1}')).toBeNull()
    expect(parseStreamLine("null")).toBeNull()
  })

  it("separa o buffer mantendo a linha incompleta", () => {
    expect(splitStreamBuffer('{"a":1}\n{"b"')).toEqual({ lines: ['{"a":1}'], rest: '{"b"' })
    expect(splitStreamBuffer("completa\n")).toEqual({ lines: ["completa"], rest: "" })
    expect(splitStreamBuffer("parcial")).toEqual({ lines: [], rest: "parcial" })
  })
})
