import { describe, expect, it, vi } from "vitest"
import { parseWhatsAppPayload } from "./payload"
import { processWhatsAppEvents, dedupeKeyFor, type WebhookEventRow } from "./processor"
import { readLimitedBody } from "./request-body"
import { signBody, verifySignature, verifySubscription } from "./security"

function envelope(value: Record<string, unknown>, field = "messages") {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "WABA_1", changes: [{ field, value: { metadata: { phone_number_id: "PNID_1" }, ...value } }] }],
  }
}

const textMessage = {
  messages: [{ id: "wamid.A", from: "5511999990000", timestamp: "1760000000", type: "text", text: { body: "Olá" } }],
}

describe("parseWhatsAppPayload", () => {
  it("extrai mensagem de texto", () => {
    const parsed = parseWhatsAppPayload(envelope(textMessage))
    expect(parsed).toEqual({
      ok: true,
      events: [
        {
          kind: "message",
          businessAccountId: "WABA_1",
          phoneNumberId: "PNID_1",
          senderWaId: "5511999990000",
          messageId: "wamid.A",
          timestamp: new Date(1760000000 * 1000).toISOString(),
          messageType: "text",
          text: "Olá",
        },
      ],
    })
  })

  it("não extrai texto de mensagens que não são do tipo text", () => {
    const parsed = parseWhatsAppPayload(
      envelope({ messages: [{ id: "wamid.B", from: "551100", timestamp: "1760000000", type: "image", image: { id: "x" } }] }),
    )
    expect(parsed.ok && parsed.events[0]).toMatchObject({ kind: "message", messageType: "image", text: null })
  })

  it("extrai status com erro", () => {
    const parsed = parseWhatsAppPayload(
      envelope({
        statuses: [
          {
            id: "wamid.C",
            status: "failed",
            timestamp: "1760000001",
            recipient_id: "5511999990000",
            errors: [{ code: 131026, title: "Message undeliverable" }],
          },
        ],
      }),
    )
    expect(parsed.ok && parsed.events[0]).toMatchObject({
      kind: "status",
      messageId: "wamid.C",
      recipientId: "5511999990000",
      status: "failed",
      errorCode: 131026,
      errorTitle: "Message undeliverable",
    })
  })

  it("rejeita payloads que não são da WhatsApp Cloud API", () => {
    for (const payload of [null, [], "x", {}, { object: "page", entry: [] }, { object: "whatsapp_business_account" }]) {
      expect(parseWhatsAppPayload(payload)).toEqual({ ok: false, reason: "not_whatsapp_payload" })
    }
  })

  it("aceita campos não suportados sem eventos e ignora itens malformados", () => {
    expect(parseWhatsAppPayload(envelope({}, "account_update"))).toEqual({ ok: true, events: [] })
    expect(parseWhatsAppPayload(envelope({ messages: [null, { id: 1 }, "x"], statuses: [{}] }))).toEqual({
      ok: true,
      events: [],
    })
  })

  it("ignora mudanças sem phone_number_id", () => {
    const payload = { object: "whatsapp_business_account", entry: [{ id: "W", changes: [{ field: "messages", value: textMessage }] }] }
    expect(parseWhatsAppPayload(payload)).toEqual({ ok: true, events: [] })
  })
})

describe("verifySubscription", () => {
  const ok = { mode: "subscribe", token: "segredo", challenge: "12345" }

  it("devolve o challenge quando o token confere", () => {
    expect(verifySubscription(ok, "segredo")).toBe("12345")
  })

  it("rejeita modo, token ou challenge inválidos", () => {
    expect(verifySubscription({ ...ok, mode: "unsubscribe" }, "segredo")).toBeNull()
    expect(verifySubscription({ ...ok, token: "errado" }, "segredo")).toBeNull()
    expect(verifySubscription({ ...ok, challenge: null }, "segredo")).toBeNull()
    expect(verifySubscription({ ...ok, challenge: "x".repeat(513) }, "segredo")).toBeNull()
  })

  it("falha fechada quando o token do servidor não está configurado", () => {
    expect(verifySubscription({ ...ok, token: "" }, undefined)).toBeNull()
    expect(verifySubscription(ok, undefined)).toBeNull()
    expect(verifySubscription(ok, "")).toBeNull()
  })
})

describe("verifySignature", () => {
  const body = JSON.stringify(envelope(textMessage))

  it("aceita assinatura correta e rejeita as demais", () => {
    expect(verifySignature(body, signBody(body, "app-secret"), "app-secret")).toBe(true)
    expect(verifySignature(body, signBody(body, "outro"), "app-secret")).toBe(false)
    expect(verifySignature(body + " ", signBody(body, "app-secret"), "app-secret")).toBe(false)
    expect(verifySignature(body, null, "app-secret")).toBe(false)
    expect(verifySignature(body, "abc", "app-secret")).toBe(false)
  })
})

describe("readLimitedBody", () => {
  function request(body: string, headers: Record<string, string> = {}) {
    return new Request("http://localhost/x", { method: "POST", body, headers })
  }

  it("lê corpos dentro do limite", async () => {
    expect(await readLimitedBody(request("olá mundo"), 100)).toEqual({ ok: true, body: "olá mundo" })
  })

  it("rejeita corpos acima do limite durante a leitura", async () => {
    expect(await readLimitedBody(request("x".repeat(200)), 100)).toEqual({ ok: false, reason: "too_large" })
  })

  it("rejeita pelo content-length declarado", async () => {
    expect(await readLimitedBody(request("x", { "content-length": "999" }), 100)).toEqual({
      ok: false,
      reason: "too_large",
    })
  })
})

describe("processWhatsAppEvents", () => {
  function setup(companyId: string | null) {
    const stored = new Set<string>()
    const rows: WebhookEventRow[] = []
    const insertEvents = vi.fn(async (batch: WebhookEventRow[]) => {
      const inserted = new Set<string>()
      for (const row of batch) {
        if (stored.has(row.dedupe_key)) continue
        stored.add(row.dedupe_key)
        rows.push(row)
        inserted.add(row.dedupe_key)
      }
      return inserted
    })
    return { rows, insertEvents, deps: { resolveCompany: vi.fn(async () => companyId), insertEvents } }
  }

  const events = () => {
    const parsed = parseWhatsAppPayload(envelope({ ...textMessage, statuses: [{ id: "wamid.A", status: "sent", timestamp: "1760000002" }] }))
    if (!parsed.ok) throw new Error("payload inválido")
    return parsed.events
  }

  it("não processa duas vezes o mesmo message_id", async () => {
    const { rows, deps } = setup("company-1")
    await processWhatsAppEvents(events(), deps)
    await processWhatsAppEvents(events(), deps)
    expect(rows.map((r) => r.dedupe_key).sort()).toEqual(["message:wamid.A", "status:wamid.A:sent"])
  })

  it("deduplica o mesmo evento repetido no mesmo lote", async () => {
    const { insertEvents, deps } = setup("company-1")
    const [message] = events()
    await processWhatsAppEvents([message, message], deps)
    expect(insertEvents.mock.calls[0][0]).toHaveLength(1)
  })

  it("marca como ignored quando a empresa não está configurada", async () => {
    const { rows, deps } = setup(null)
    await processWhatsAppEvents(events(), deps)
    expect(rows.every((r) => r.company_id === null && r.status === "ignored" && r.error_message === "company_not_configured")).toBe(true)
  })

  it("guarda company_id e status received quando a empresa é resolvida", async () => {
    const { rows, deps } = setup("company-1")
    await processWhatsAppEvents(events(), deps)
    expect(rows.every((r) => r.company_id === "company-1" && r.status === "received" && r.processed_at === null)).toBe(true)
  })

  it("nunca persiste texto, telefone ou payload", async () => {
    const { rows, deps } = setup("company-1")
    await processWhatsAppEvents(events(), deps)
    const serialized = JSON.stringify(rows)
    expect(serialized).not.toContain("Olá")
    expect(serialized).not.toContain("5511999990000")
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.payload_hash))).toBe(true)
  })

  it("não registra texto nem telefone nos logs", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const { deps } = setup("company-1")
    await processWhatsAppEvents(events(), deps)
    const output = spy.mock.calls.map((c) => String(c[0])).join("\n")
    spy.mockRestore()
    expect(output).toContain("message_received")
    expect(output).not.toContain("Olá")
    expect(output).not.toContain("5511999990000")
  })

  it("não lança quando a persistência falha", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await expect(
      processWhatsAppEvents(events(), {
        resolveCompany: async () => null,
        insertEvents: async () => {
          throw new Error("insert_failed:42P01")
        },
      }),
    ).resolves.toBeUndefined()
    err.mockRestore()
  })

  it("usa chaves distintas por tipo e status", () => {
    const [message, status] = events()
    expect(dedupeKeyFor(message)).toBe("message:wamid.A")
    expect(dedupeKeyFor(status)).toBe("status:wamid.A:sent")
  })
})
