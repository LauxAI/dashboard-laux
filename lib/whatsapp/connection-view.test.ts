import { describe, expect, it } from "vitest"
import { pickCurrentConnection, toSafeConnection } from "./connection-view"
import type { WhatsAppConnection } from "./connections"

function make(overrides: Partial<WhatsAppConnection>): WhatsAppConnection {
  return {
    id: "id",
    company_id: "company-secret",
    phone_number_id: "111",
    waba_id: "222",
    display_phone_number: "+55 11 99999-0000",
    business_name: "Empresa",
    status: "active",
    connected_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as WhatsAppConnection
}

describe("toSafeConnection", () => {
  it("só repassa campos da lista branca, sem token nem company_id", () => {
    const source = { ...make({}), access_token: "SEGREDO", token_expires_at: "2027-01-01" } as WhatsAppConnection
    const safe = toSafeConnection(source)
    expect(Object.keys(safe).sort()).toEqual(
      [
        "business_name",
        "connected_at",
        "display_phone_number",
        "id",
        "phone_number_id",
        "status",
        "updated_at",
        "waba_id",
      ].sort(),
    )
    expect(JSON.stringify(safe)).not.toContain("SEGREDO")
    expect(JSON.stringify(safe)).not.toContain("company-secret")
  })
})

describe("pickCurrentConnection", () => {
  it("retorna null sem conexões", () => {
    expect(pickCurrentConnection([])).toBeNull()
  })

  it("prioriza ativa sobre inativa e desconectada", () => {
    const picked = pickCurrentConnection([
      make({ id: "d", status: "disconnected", updated_at: "2026-03-01T00:00:00Z" }),
      make({ id: "i", status: "inactive", updated_at: "2026-02-01T00:00:00Z" }),
      make({ id: "a", status: "active", updated_at: "2026-01-01T00:00:00Z" }),
    ])
    expect(picked?.id).toBe("a")
  })

  it("entre desconectadas escolhe a mais recente", () => {
    const picked = pickCurrentConnection([
      make({ id: "old", status: "disconnected", updated_at: "2026-01-01T00:00:00Z" }),
      make({ id: "new", status: "disconnected", updated_at: "2026-02-01T00:00:00Z" }),
    ])
    expect(picked?.id).toBe("new")
  })
})
