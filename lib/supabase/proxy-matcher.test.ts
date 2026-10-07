import { describe, expect, it } from "vitest"
import { config } from "@/proxy"

// O matcher do Next é uma regex ancorada no caminho inteiro.
const matcher = new RegExp(`^${config.matcher[0]}$`)
const passesThroughAuthProxy = (path: string) => matcher.test(path)

describe("proxy matcher", () => {
  it("deixa as rotas públicas fora da autenticação por sessão", () => {
    expect(passesThroughAuthProxy("/api/widget/wk_abc123")).toBe(false)
    expect(passesThroughAuthProxy("/api/widget/embed")).toBe(false)
    expect(passesThroughAuthProxy("/api/webhooks/inbound/token")).toBe(false)
    expect(passesThroughAuthProxy("/api/webhooks/whatsapp")).toBe(false)
  })

  it("mantém o dashboard e as demais APIs protegidos", () => {
    expect(passesThroughAuthProxy("/integracoes")).toBe(true)
    expect(passesThroughAuthProxy("/integracoes/widget")).toBe(true)
    expect(passesThroughAuthProxy("/integracoes/webhooks")).toBe(true)
    expect(passesThroughAuthProxy("/api/agentes/testar")).toBe(true)
  })
})
