import type { SupabaseClient } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MAX_TEXT_LENGTH, sendWhatsAppText } from "./send"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("admin client must be injected in tests")
  },
}))

const TOKEN = "EAAG-super-secret-token-123"
const PHONE_NUMBER_ID = "123456789012345"
const TO = "5511999998888"
const TEXT = "Olá, sua consulta está confirmada."

type Row = { status: string; access_token: string | null; token_expires_at: string | null } | null

function fakeDb(data: Row, error: { message: string } | null = null) {
  const calls: { method: string; args: unknown[] }[] = []
  const builder: Record<string, unknown> = {}
  for (const method of ["from", "select", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }
  builder.maybeSingle = async () => ({ data, error })
  return { db: builder as unknown as SupabaseClient, calls }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

const activeRow = { status: "active", access_token: TOKEN, token_expires_at: null }
const input = { phoneNumberId: PHONE_NUMBER_ID, to: TO, text: TEXT }

let logs: string[] = []

beforeEach(() => {
  logs = []
  for (const level of ["log", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "))
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

function expectNoSensitiveData(result: unknown) {
  const serialized = JSON.stringify(result) + logs.join("\n")
  expect(serialized).not.toContain(TOKEN)
  expect(serialized).not.toContain(TEXT)
  expect(serialized).not.toContain(TO)
}

describe("sendWhatsAppText", () => {
  it("retorna connection_not_found quando a conexão não existe", async () => {
    const fetchMock = vi.fn()
    const { db } = fakeDb(null)
    const result = await sendWhatsAppText(input, { db, fetch: fetchMock })
    expect(result).toEqual({ ok: false, error: "connection_not_found" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(["inactive", "disconnected"])("retorna connection_inactive para status %s", async (status) => {
    const fetchMock = vi.fn()
    const { db } = fakeDb({ ...activeRow, status })
    const result = await sendWhatsAppText(input, { db, fetch: fetchMock })
    expect(result).toEqual({ ok: false, error: "connection_inactive" })
    expect(fetchMock).not.toHaveBeenCalled()
    expectNoSensitiveData(result)
  })

  it("retorna token_missing quando a conexão ativa não tem token", async () => {
    const fetchMock = vi.fn()
    const { db } = fakeDb({ ...activeRow, access_token: null })
    const result = await sendWhatsAppText(input, { db, fetch: fetchMock })
    expect(result).toEqual({ ok: false, error: "token_missing" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("retorna token_expired quando o token já venceu", async () => {
    const fetchMock = vi.fn()
    const { db } = fakeDb({ ...activeRow, token_expires_at: "2026-01-01T00:00:00Z" })
    const result = await sendWhatsAppText(input, { db, fetch: fetchMock, now: () => new Date("2026-06-01T00:00:00Z") })
    expect(result).toEqual({ ok: false, error: "token_expired" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("envia a mensagem com o payload e o header corretos", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { messaging_product: "whatsapp", contacts: [{ wa_id: TO }], messages: [{ id: "wamid.ABC" }] }),
    )
    const { db, calls } = fakeDb(activeRow)
    const result = await sendWhatsAppText({ ...input, to: `+${TO}` }, { db, fetch: fetchMock })

    expect(result).toEqual({ ok: true, messageId: "wamid.ABC" })
    expect(calls).toContainEqual({ method: "from", args: ["whatsapp_connections"] })
    expect(calls).toContainEqual({ method: "eq", args: ["phone_number_id", PHONE_NUMBER_ID] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`)
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      to: TO,
      type: "text",
      text: { body: TEXT },
    })
    expectNoSensitiveData(result)
  })

  it("retorna graph_api_error com status e código da Meta, sem a mensagem bruta", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, {
        error: { message: `Invalid OAuth access token ${TOKEN}`, type: "OAuthException", code: 190, fbtrace_id: "x" },
      }),
    )
    const { db } = fakeDb(activeRow)
    const result = await sendWhatsAppText(input, { db, fetch: fetchMock })
    expect(result).toEqual({ ok: false, error: "graph_api_error", httpStatus: 401, graphErrorCode: 190 })
    expect(JSON.stringify(result)).not.toContain("OAuth")
    expectNoSensitiveData(result)
  })

  it("retorna network_error quando a requisição falha", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error(`connect failed Bearer ${TOKEN}`)
    })
    const { db } = fakeDb(activeRow)
    const result = await sendWhatsAppText(input, { db, fetch: fetchMock })
    expect(result).toEqual({ ok: false, error: "network_error" })
    expectNoSensitiveData(result)
  })

  it("retorna database_error sem detalhes quando a consulta falha", async () => {
    const { db } = fakeDb(null, { message: "relation does not exist" })
    const result = await sendWhatsAppText(input, { db, fetch: vi.fn() })
    expect(result).toEqual({ ok: false, error: "database_error" })
  })

  it.each([
    { ...input, phoneNumberId: "" },
    { ...input, phoneNumberId: "../abc" },
    { ...input, to: "abc" },
    { ...input, to: "123" },
    { ...input, text: "   " },
    { ...input, text: "a".repeat(MAX_TEXT_LENGTH + 1) },
  ])("rejeita entrada inválida sem consultar o banco (%#)", async (bad) => {
    const fetchMock = vi.fn()
    const { db, calls } = fakeDb(activeRow)
    const result = await sendWhatsAppText(bad, { db, fetch: fetchMock })
    expect(result).toEqual({ ok: false, error: "invalid_input" })
    expect(calls).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("nunca devolve o token em nenhum resultado", async () => {
    const scenarios: [Row, () => Promise<Response>][] = [
      [activeRow, async () => jsonResponse(200, { messages: [{ id: "wamid.1" }] })],
      [activeRow, async () => jsonResponse(500, { error: { message: TOKEN, code: 1 } })],
      [activeRow, async () => new Response("not json", { status: 502 })],
      [{ ...activeRow, status: "inactive" }, async () => jsonResponse(200, {})],
    ]
    for (const [row, response] of scenarios) {
      const { db } = fakeDb(row)
      const result = await sendWhatsAppText(input, { db, fetch: vi.fn(response) })
      expect(Object.keys(result)).not.toContain("accessToken")
      expectNoSensitiveData(result)
    }
  })
})
