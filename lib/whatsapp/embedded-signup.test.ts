import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const upsertCalls: unknown[][] = []
let upsertImpl: () => Promise<unknown> = async () => ({ id: "conn" })
vi.mock("./connections", async () => {
  const actual = await vi.importActual<typeof import("./connections")>("./connections")
  return {
    ...actual,
    upsertConnectionForCompany: (...args: unknown[]) => {
      upsertCalls.push(args)
      return upsertImpl()
    },
  }
})

import { WhatsAppConnectionError } from "./connections"
import {
  completeEmbeddedSignup,
  EmbeddedSignupError,
  getMetaSignupClient,
  parseEmbeddedSignupResult,
  type MetaSignupClient,
} from "./embedded-signup"

const COMPANY = "11111111-1111-4111-8111-111111111111"
const valid = { code: "abc", phoneNumberId: "123456", wabaId: "654321" }

function client(overrides: Partial<MetaSignupClient> = {}): MetaSignupClient {
  return {
    exchangeCode: vi.fn(async () => ({ accessToken: "tok", expiresAt: null })),
    getPhoneNumber: vi.fn(async () => ({
      phoneNumberId: "123456",
      wabaId: "654321",
      displayPhoneNumber: "+55 11 99999-0000",
      verifiedName: "Empresa",
    })),
    ...overrides,
  }
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof EmbeddedSignupError ? error.code : "other"
  }
  return "no_error"
}

beforeEach(() => {
  upsertCalls.length = 0
  upsertImpl = async () => ({ id: "conn" })
})

describe("getMetaSignupClient", () => {
  it("é null enquanto a Meta não está integrada", () => {
    expect(getMetaSignupClient()).toBeNull()
  })
})

describe("parseEmbeddedSignupResult", () => {
  it.each([
    null,
    "texto",
    {},
    { ...valid, code: "" },
    { ...valid, phoneNumberId: "12a" },
    { ...valid, wabaId: "" },
    { ...valid, code: "x".repeat(2049) },
  ])("rejeita resultado inválido %#", (raw) => {
    expect(() => parseEmbeddedSignupResult(raw)).toThrow(EmbeddedSignupError)
  })

  it("aceita resultado válido", () => {
    expect(parseEmbeddedSignupResult(valid)).toEqual(valid)
  })
})

describe("completeEmbeddedSignup", () => {
  it("não grava nada sem cliente da Meta", async () => {
    expect(await codeOf(completeEmbeddedSignup(COMPANY, valid, null))).toBe("meta_unavailable")
    expect(upsertCalls).toHaveLength(0)
  })

  it("não grava quando a troca do code falha", async () => {
    const c = client({ exchangeCode: vi.fn(async () => Promise.reject(new Error("boom"))) })
    expect(await codeOf(completeEmbeddedSignup(COMPANY, valid, c))).toBe("verification_failed")
    expect(upsertCalls).toHaveLength(0)
  })

  it("não grava quando o número não pertence ao WABA informado", async () => {
    const c = client({
      getPhoneNumber: vi.fn(async () => ({
        phoneNumberId: "123456",
        wabaId: "999",
        displayPhoneNumber: null,
        verifiedName: null,
      })),
    })
    expect(await codeOf(completeEmbeddedSignup(COMPANY, valid, c))).toBe("verification_failed")
    expect(upsertCalls).toHaveLength(0)
  })

  it("não grava quando a Meta não encontra o número", async () => {
    const c = client({ getPhoneNumber: vi.fn(async () => null) })
    expect(await codeOf(completeEmbeddedSignup(COMPANY, valid, c))).toBe("verification_failed")
    expect(upsertCalls).toHaveLength(0)
  })

  it("grava como ativa usando só dados confirmados pela Meta", async () => {
        await completeEmbeddedSignup(COMPANY, valid, client())
    expect(upsertCalls).toHaveLength(1)
    const [companyId, input] = upsertCalls[0]
    expect(companyId).toBe(COMPANY)
    expect(input).toMatchObject({
      phoneNumberId: "123456",
      wabaId: "654321",
      status: "active",
      accessToken: "tok",
      businessName: "Empresa",
    })
  })

  it("traduz número já usado por outra empresa", async () => {
    upsertImpl = async () => {
      throw new WhatsAppConnectionError("phone_number_owned_by_other_company")
    }
    expect(await codeOf(completeEmbeddedSignup(COMPANY, valid, client()))).toBe("phone_number_owned_by_other_company")
  })

  it("traduz outros erros de banco sem vazar detalhes", async () => {
    upsertImpl = async () => {
      throw new Error("token tok vazou")
    }
    expect(await codeOf(completeEmbeddedSignup(COMPANY, valid, client()))).toBe("database_error")
  })
})
