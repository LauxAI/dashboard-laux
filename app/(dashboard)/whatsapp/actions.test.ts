import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const getSessionCompanyId = vi.fn()
const disconnectConnectionForCompany = vi.fn()
vi.mock("@/lib/whatsapp/connections", async () => {
  const actual = await vi.importActual<typeof import("@/lib/whatsapp/connections")>("@/lib/whatsapp/connections")
  return {
    ...actual,
    getSessionCompanyId: () => getSessionCompanyId(),
    disconnectConnectionForCompany: (...args: unknown[]) => disconnectConnectionForCompany(...args),
  }
})

import { revalidatePath } from "next/cache"
import { WhatsAppConnectionError } from "@/lib/whatsapp/connections"
import { completeWhatsAppSignup, disconnectWhatsApp, startWhatsAppConnection } from "./actions"

const COMPANY = "11111111-1111-4111-8111-111111111111"
const CONNECTION = "22222222-2222-4222-8222-222222222222"

beforeEach(() => {
  vi.clearAllMocks()
  getSessionCompanyId.mockResolvedValue(COMPANY)
})

describe("startWhatsAppConnection", () => {
  it("exige empresa na sessão", async () => {
    getSessionCompanyId.mockRejectedValue(new Error("no session"))
    expect(await startWhatsAppConnection()).toEqual({ error: expect.any(String) })
  })

  it("informa indisponibilidade enquanto a Meta não está integrada", async () => {
    expect(await startWhatsAppConnection()).toEqual({
      unavailable: true,
      message: "A conexão com a Meta será iniciada aqui.",
    })
  })
})

describe("completeWhatsAppSignup", () => {
  it("não salva nada sem cliente da Meta", async () => {
    const result = await completeWhatsAppSignup({ code: "c", phoneNumberId: "1", wabaId: "2" })
    expect(result).toEqual({ error: "A conexão com a Meta será iniciada aqui." })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("exige empresa na sessão", async () => {
    getSessionCompanyId.mockRejectedValue(new Error("no session"))
    expect(await completeWhatsAppSignup({})).toEqual({ error: expect.any(String) })
  })
})

describe("disconnectWhatsApp", () => {
  it("usa a empresa da sessão e revalida as páginas", async () => {
    disconnectConnectionForCompany.mockResolvedValue(true)
    expect(await disconnectWhatsApp(CONNECTION)).toEqual({ success: true })
    expect(disconnectConnectionForCompany).toHaveBeenCalledWith(COMPANY, CONNECTION)
    expect(revalidatePath).toHaveBeenCalledWith("/whatsapp")
    expect(revalidatePath).toHaveBeenCalledWith("/integracoes")
  })

  it("responde não encontrada para conexão de outra empresa ou inexistente", async () => {
    disconnectConnectionForCompany.mockResolvedValue(false)
    expect(await disconnectWhatsApp(CONNECTION)).toEqual({ error: "Conexão não encontrada." })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("trata id inválido como não encontrada", async () => {
    disconnectConnectionForCompany.mockRejectedValue(new WhatsAppConnectionError("invalid_input"))
    expect(await disconnectWhatsApp("x")).toEqual({ error: "Conexão não encontrada." })
  })

  it("não vaza detalhes de erro inesperado", async () => {
    disconnectConnectionForCompany.mockRejectedValue(new Error("senha=123"))
    const result = await disconnectWhatsApp(CONNECTION)
    expect(JSON.stringify(result)).not.toContain("senha")
    expect(result).toEqual({ error: expect.any(String) })
  })

  it("exige empresa na sessão", async () => {
    getSessionCompanyId.mockRejectedValue(new Error("no session"))
    expect(await disconnectWhatsApp(CONNECTION)).toEqual({ error: expect.any(String) })
    expect(disconnectConnectionForCompany).not.toHaveBeenCalled()
  })
})
