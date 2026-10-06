import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"
import { resolveWhatsAppCompany } from "./company"
import {
  buildConnectionRow,
  findConnectionByPhoneNumberId,
  upsertConnectionForCompany,
  WhatsAppConnectionError,
} from "./connections"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("admin client must be injected in tests")
  },
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

const COMPANY = "11111111-1111-4111-8111-111111111111"

type Result = { data: unknown; error: { code?: string; message?: string } | null }

function fakeDb(result: Result) {
  const calls: { method: string; args: unknown[] }[] = []
  const builder: Record<string, unknown> = {}
  for (const method of ["from", "select", "eq", "order", "upsert", "update", "returns"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }
  builder.maybeSingle = async () => result
  builder.single = async () => result
  builder.then = (resolve: (r: Result) => unknown) => resolve(result)
  return { db: builder as unknown as SupabaseClient, calls }
}

const connection = {
  id: "22222222-2222-4222-8222-222222222222",
  company_id: COMPANY,
  phone_number_id: "1234567890",
  waba_id: "999",
  display_phone_number: "+55 11 90000-0000",
  business_name: "Empresa",
  status: "active",
  token_expires_at: null,
  connected_at: "2026-10-06T00:00:00Z",
  updated_at: "2026-10-06T00:00:00Z",
}

describe("whatsapp connections", () => {
  it("never selects access_token", async () => {
    const { db, calls } = fakeDb({ data: connection, error: null })
    await findConnectionByPhoneNumberId("1234567890", db)
    const selected = calls.find((c) => c.method === "select")?.args[0] as string
    expect(selected).not.toContain("access_token")
    expect(calls).toContainEqual({ method: "eq", args: ["phone_number_id", "1234567890"] })
  })

  it("resolves an active connection to minimal data without the token", async () => {
    const { db } = fakeDb({ data: { ...connection, access_token: "leak" }, error: null })
    const resolved = await resolveWhatsAppCompany(" 1234567890 ", db)
    expect(resolved).toEqual({
      company_id: COMPANY,
      connection_id: connection.id,
      phone_number_id: "1234567890",
      waba_id: "999",
      display_phone_number: "+55 11 90000-0000",
      status: "active",
    })
    expect(JSON.stringify(resolved)).not.toContain("leak")
  })

  it.each(["inactive", "disconnected"])("returns null for %s connections", async (status) => {
    const { db } = fakeDb({ data: { ...connection, status }, error: null })
    expect(await resolveWhatsAppCompany("1234567890", db)).toBeNull()
  })

  it("returns null when not found or id is blank", async () => {
    expect(await resolveWhatsAppCompany("1", fakeDb({ data: null, error: null }).db)).toBeNull()
    expect(await resolveWhatsAppCompany("   ", fakeDb({ data: connection, error: null }).db)).toBeNull()
  })

  it("keeps the existing token when accessToken is omitted", () => {
    const row = buildConnectionRow(COMPANY, { phoneNumberId: "123" })
    expect(row).toEqual({ company_id: COMPANY, phone_number_id: "123" })
    expect("access_token" in row).toBe(false)
  })

  it("rejects invalid input", () => {
    expect(() => buildConnectionRow("not-a-uuid", { phoneNumberId: "1" })).toThrow(WhatsAppConnectionError)
    expect(() => buildConnectionRow(COMPANY, { phoneNumberId: "  " })).toThrow(WhatsAppConnectionError)
    expect(() =>
      buildConnectionRow(COMPANY, { phoneNumberId: "1", status: "deleted" as never }),
    ).toThrow(WhatsAppConnectionError)
    expect(() => buildConnectionRow(COMPANY, { phoneNumberId: "1", accessToken: "" })).toThrow(WhatsAppConnectionError)
  })

  it("maps the company immutability trigger to a typed error", async () => {
    const { db } = fakeDb({ data: null, error: { code: "P0001", message: "whatsapp_connection_company_immutable" } })
    await expect(upsertConnectionForCompany(COMPANY, { phoneNumberId: "1" }, db)).rejects.toMatchObject({
      code: "phone_number_owned_by_other_company",
    })
  })
})
