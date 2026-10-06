import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { processWhatsAppInboundMessage, type InboundWhatsAppMessage } from "./inbound"
import { parseWhatsAppPayload, type WhatsAppEvent } from "./payload"
import { processWhatsAppEvents, type WebhookEventRow } from "./processor"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("admin client must be injected in tests")
  },
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

const COMPANY_A = "11111111-1111-4111-8111-111111111111"
const COMPANY_B = "99999999-9999-4999-8999-999999999999"
const CONNECTION_A = "22222222-2222-4222-8222-222222222222"
const CONNECTION_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const CONNECTION_OFF = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PHONE = "5511999990000"
const TEXT = "Mensagem confidencial 123"
const NAME = "Maria Silva"
const TOKEN = "EAAG-SECRET-TOKEN"

type Row = Record<string, unknown>
type Tables = Record<"whatsapp_connections" | "whatsapp_conversations" | "whatsapp_messages", Row[]>

const UNIQUE: Record<string, string[]> = {
  whatsapp_conversations: ["whatsapp_connection_id", "contact_phone"],
  whatsapp_messages: ["whatsapp_message_id"],
}

/**
 * Banco em memória com o mínimo que os helpers usam: filtros eq, projeção de colunas
 * (o access_token só aparece se alguém o selecionar), unicidade (23505) e yields entre
 * leitura e escrita para que chamadas concorrentes realmente disputem a mesma corrida.
 */
function memoryDb(seed: Partial<Tables> = {}, failTables: string[] = []) {
  const tables: Tables = { whatsapp_connections: [], whatsapp_conversations: [], whatsapp_messages: [], ...seed }

  const db = {
    from(table: keyof Tables) {
      const filters: [string, unknown][] = []
      let columns: string | null = null
      let inserted: Row | null = null
      let patch: Row | null = null
      const rows = tables[table]
      const project = (row: Row): Row =>
        columns ? Object.fromEntries(columns.split(",").map((c) => [c.trim(), row[c.trim()]])) : row

      const exec = async () => {
        await Promise.resolve()
        await Promise.resolve()
        if (failTables.includes(table)) return { data: null, error: { code: "XX000", message: "boom" } }

        if (inserted) {
          const unique = UNIQUE[table] ?? []
          const clashes =
            unique.length > 0 &&
            unique.every((c) => inserted![c] !== null && inserted![c] !== undefined) &&
            rows.some((r) => unique.every((c) => r[c] === inserted![c]))
          if (clashes) return { data: null, error: { code: "23505", message: "duplicate key" } }
          const row: Row = {
            id: randomUUID(),
            contact_name: null,
            last_message_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(table === "whatsapp_conversations" ? { status: "open" } : {}),
            ...inserted,
          }
          rows.push(row)
          return { data: project(row), error: null }
        }

        const matches = rows.filter((row) => filters.every(([c, v]) => row[c] === v))
        if (patch) {
          for (const row of matches) Object.assign(row, patch)
          return { data: matches[0] ? project(matches[0]) : null, error: null }
        }
        return { data: matches[0] ? project(matches[0]) : null, error: null }
      }

      const builder = {
        select(cols: string) {
          columns = cols
          return builder
        },
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return builder
        },
        insert(row: Row) {
          inserted = row
          return builder
        },
        update(values: Row) {
          patch = values
          return builder
        },
        maybeSingle: exec,
        single: exec,
      }
      return builder
    },
  }
  return { db: db as unknown as SupabaseClient, tables }
}

const connectionRow = (id: string, companyId: string, phoneNumberId: string, status = "active"): Row => ({
  id,
  company_id: companyId,
  phone_number_id: phoneNumberId,
  waba_id: "waba-1",
  display_phone_number: null,
  business_name: null,
  status,
  token_expires_at: null,
  connected_at: "2026-10-06T00:00:00Z",
  updated_at: "2026-10-06T00:00:00Z",
  access_token: TOKEN,
})

const seed = (): Partial<Tables> => ({
  whatsapp_connections: [
    connectionRow(CONNECTION_A, COMPANY_A, "PNID_A"),
    connectionRow(CONNECTION_B, COMPANY_B, "PNID_B"),
    connectionRow(CONNECTION_OFF, COMPANY_A, "PNID_OFF", "inactive"),
  ],
})

const inbound = (overrides: Partial<InboundWhatsAppMessage> = {}): InboundWhatsAppMessage => ({
  phoneNumberId: "PNID_A",
  senderWaId: PHONE,
  messageId: "wamid.AAA",
  messageType: "text",
  text: TEXT,
  contactName: NAME,
  timestamp: "2025-10-09T00:00:00.000Z",
  ...overrides,
})

afterEach(() => vi.restoreAllMocks())

describe("processWhatsAppInboundMessage", () => {
  it("salva uma mensagem de texto válida criando a conversa automaticamente", async () => {
    const { db, tables } = memoryDb(seed())
    const result = await processWhatsAppInboundMessage(inbound(), { db })

    expect(result).toMatchObject({ status: "saved", messageType: "text" })
    expect(tables.whatsapp_conversations).toHaveLength(1)
    expect(tables.whatsapp_conversations[0]).toMatchObject({
      company_id: COMPANY_A,
      whatsapp_connection_id: CONNECTION_A,
      contact_phone: PHONE,
      contact_name: NAME,
      status: "open",
    })
    expect(tables.whatsapp_messages).toHaveLength(1)
    expect(tables.whatsapp_messages[0]).toMatchObject({
      conversation_id: tables.whatsapp_conversations[0].id,
      company_id: COMPANY_A,
      direction: "inbound",
      message_type: "text",
      whatsapp_message_id: "wamid.AAA",
      sender_phone: PHONE,
      recipient_phone: null,
      text_content: TEXT,
      status: "received",
    })
  })

  it("reaproveita a conversa para novas mensagens do mesmo contato", async () => {
    const { db, tables } = memoryDb(seed())
    await processWhatsAppInboundMessage(inbound(), { db })
    await processWhatsAppInboundMessage(inbound({ messageId: "wamid.BBB", text: "outra" }), { db })

    expect(tables.whatsapp_conversations).toHaveLength(1)
    expect(tables.whatsapp_messages.map((m) => m.whatsapp_message_id)).toEqual(["wamid.AAA", "wamid.BBB"])
  })

  it("usa o company_id da conexão e ignora qualquer company_id do evento", async () => {
    const { db, tables } = memoryDb(seed())
    const forged = { ...inbound(), company_id: COMPANY_B, companyId: COMPANY_B } as InboundWhatsAppMessage
    await processWhatsAppInboundMessage(forged, { db })

    expect(tables.whatsapp_conversations[0].company_id).toBe(COMPANY_A)
    expect(tables.whatsapp_messages[0].company_id).toBe(COMPANY_A)
  })

  it("trata o mesmo wamid reenviado como duplicate, sem duplicar conversa nem mensagem", async () => {
    const { db, tables } = memoryDb(seed())
    const first = await processWhatsAppInboundMessage(inbound(), { db })
    const second = await processWhatsAppInboundMessage(inbound(), { db })

    expect(first.status).toBe("saved")
    expect(second.status).toBe("duplicate")
    expect(tables.whatsapp_conversations).toHaveLength(1)
    expect(tables.whatsapp_messages).toHaveLength(1)
  })

  it("resulta em 1 conversa e 1 mensagem com duas chamadas simultâneas do mesmo wamid", async () => {
    const { db, tables } = memoryDb(seed())
    const results = await Promise.all([
      processWhatsAppInboundMessage(inbound(), { db }),
      processWhatsAppInboundMessage(inbound(), { db }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(["duplicate", "saved"])
    expect(tables.whatsapp_conversations).toHaveLength(1)
    expect(tables.whatsapp_messages).toHaveLength(1)
  })

  it("cria uma única conversa quando mensagens diferentes do mesmo contato chegam juntas", async () => {
    const { db, tables } = memoryDb(seed())
    const results = await Promise.all([
      processWhatsAppInboundMessage(inbound({ messageId: "wamid.1" }), { db }),
      processWhatsAppInboundMessage(inbound({ messageId: "wamid.2" }), { db }),
      processWhatsAppInboundMessage(inbound({ messageId: "wamid.3" }), { db }),
    ])

    expect(results.every((r) => r.status === "saved")).toBe(true)
    expect(tables.whatsapp_conversations).toHaveLength(1)
    expect(tables.whatsapp_messages).toHaveLength(3)
  })

  it("não cria nada quando o phone_number_id não está cadastrado", async () => {
    const { db, tables } = memoryDb(seed())
    const result = await processWhatsAppInboundMessage(inbound({ phoneNumberId: "PNID_DESCONHECIDO" }), { db })

    expect(result).toEqual({ status: "ignored", reason: "connection_not_configured" })
    expect(tables.whatsapp_conversations).toHaveLength(0)
    expect(tables.whatsapp_messages).toHaveLength(0)
  })

  it("não cria nada quando a conexão está inativa", async () => {
    const { db, tables } = memoryDb(seed())
    const result = await processWhatsAppInboundMessage(inbound({ phoneNumberId: "PNID_OFF" }), { db })

    expect(result).toEqual({ status: "ignored", reason: "connection_not_configured" })
    expect(tables.whatsapp_conversations).toHaveLength(0)
    expect(tables.whatsapp_messages).toHaveLength(0)
  })

  it.each([null, "", "   "])("registra texto sem conteúdo (%j) como unknown, sem texto", async (text) => {
    const { db, tables } = memoryDb(seed())
    const result = await processWhatsAppInboundMessage(inbound({ text }), { db })

    expect(result).toMatchObject({ status: "saved", messageType: "unknown" })
    expect(tables.whatsapp_messages[0]).toMatchObject({ message_type: "unknown", text_content: null })
  })

  it.each(["image", "audio", "video", "document", "sticker", "location", "reaction", "interactive", "button"])(
    "registra o tipo não suportado %s como unknown, sem conteúdo",
    async (messageType) => {
      const { db, tables } = memoryDb(seed())
      const result = await processWhatsAppInboundMessage(inbound({ messageType, text: null }), { db })

      expect(result).toMatchObject({ status: "saved", messageType: "unknown" })
      expect(tables.whatsapp_messages[0]).toMatchObject({ message_type: "unknown", text_content: null })
    },
  )

  it("nunca guarda texto de um tipo não suportado, mesmo que o evento o traga", async () => {
    const { db, tables } = memoryDb(seed())
    await processWhatsAppInboundMessage(inbound({ messageType: "image", text: TEXT }), { db })

    expect(tables.whatsapp_messages[0].text_content).toBeNull()
  })

  it("isola conversas e mensagens entre empresas, mesmo com o mesmo contato", async () => {
    const { db, tables } = memoryDb(seed())
    await processWhatsAppInboundMessage(inbound({ phoneNumberId: "PNID_A", messageId: "wamid.A" }), { db })
    await processWhatsAppInboundMessage(inbound({ phoneNumberId: "PNID_B", messageId: "wamid.B" }), { db })

    expect(tables.whatsapp_conversations).toHaveLength(2)
    const conversationA = tables.whatsapp_conversations.find((c) => c.company_id === COMPANY_A)
    const conversationB = tables.whatsapp_conversations.find((c) => c.company_id === COMPANY_B)
    expect(conversationA?.whatsapp_connection_id).toBe(CONNECTION_A)
    expect(conversationB?.whatsapp_connection_id).toBe(CONNECTION_B)

    const messageA = tables.whatsapp_messages.find((m) => m.whatsapp_message_id === "wamid.A")
    const messageB = tables.whatsapp_messages.find((m) => m.whatsapp_message_id === "wamid.B")
    expect(messageA).toMatchObject({ company_id: COMPANY_A, conversation_id: conversationA?.id })
    expect(messageB).toMatchObject({ company_id: COMPANY_B, conversation_id: conversationB?.id })
  })

  it("não lança com telefone de remetente inválido e não grava nada", async () => {
    const { db, tables } = memoryDb(seed())
    const result = await processWhatsAppInboundMessage(inbound({ senderWaId: "abc" }), { db })

    expect(result).toEqual({ status: "failed", reason: "invalid_input" })
    expect(tables.whatsapp_conversations).toHaveLength(0)
    expect(tables.whatsapp_messages).toHaveLength(0)
  })

  it("não lança quando o banco falha ou a conexão não pode ser consultada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    const failing = memoryDb(seed(), ["whatsapp_messages"])
    await expect(processWhatsAppInboundMessage(inbound(), { db: failing.db })).resolves.toEqual({
      status: "failed",
      reason: "database_error",
    })

    await expect(
      processWhatsAppInboundMessage(inbound(), {
        resolveConnection: async () => {
          throw new Error("boom")
        },
      }),
    ).resolves.toEqual({ status: "failed", reason: "connection_lookup_failed" })
  })

  it("não registra texto, telefone, nome nem credenciais nos logs", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ]
    const { db } = memoryDb(seed())
    const failing = memoryDb(seed(), ["whatsapp_messages"])

    await processWhatsAppInboundMessage(inbound(), { db })
    await processWhatsAppInboundMessage(inbound(), { db })
    await processWhatsAppInboundMessage(inbound({ phoneNumberId: "PNID_OFF", messageId: "wamid.OFF" }), { db })
    await processWhatsAppInboundMessage(inbound({ messageId: "wamid.FAIL" }), { db: failing.db })

    const output = spies.map((spy) => JSON.stringify(spy.mock.calls)).join("\n")
    expect(output).toContain("inbound_message_saved")
    expect(output).toContain("inbound_message_duplicate")
    expect(output).toContain("inbound_skipped_connection_not_configured")
    expect(output).toContain("inbound_message_failed")
    for (const secret of [TEXT, PHONE, NAME, TOKEN, "EAAG", "signature", "sha256"]) {
      expect(output).not.toContain(secret)
    }
  })
})

describe("contactName no parser", () => {
  const payload = (value: Record<string, unknown>) => ({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [{ field: "messages", value: { metadata: { phone_number_id: "PNID_A" }, ...value } }],
      },
    ],
  })
  const message = (from: string) => ({ id: `wamid.${from}`, from, type: "text", text: { body: "oi" }, timestamp: "1760000000" })
  const names = (value: Record<string, unknown>) => {
    const parsed = parseWhatsAppPayload(payload(value))
    if (!parsed.ok) throw new Error("payload inválido")
    return parsed.events.map((e) => (e.kind === "message" ? e.contactName : "status"))
  }

  it("extrai profile.name do contato com o mesmo wa_id do remetente", () => {
    expect(names({ contacts: [{ wa_id: PHONE, profile: { name: NAME } }], messages: [message(PHONE)] })).toEqual([NAME])
  })

  it("liga cada mensagem ao contato correto quando há vários", () => {
    const contacts = [
      { wa_id: "5511111111111", profile: { name: "Ana" } },
      { wa_id: "5522222222222", profile: { name: "Bruno" } },
    ]
    expect(names({ contacts, messages: [message("5522222222222"), message("5511111111111")] })).toEqual(["Bruno", "Ana"])
  })

  it("retorna null sem contacts, sem nome, com nome em branco ou de outro contato", () => {
    expect(names({ messages: [message(PHONE)] })).toEqual([null])
    expect(names({ contacts: [{ wa_id: PHONE, profile: {} }], messages: [message(PHONE)] })).toEqual([null])
    expect(names({ contacts: [{ wa_id: PHONE, profile: { name: "   " } }], messages: [message(PHONE)] })).toEqual([null])
    expect(names({ contacts: [{ wa_id: "5500000000000", profile: { name: "Outro" } }], messages: [message(PHONE)] })).toEqual([null])
  })

  it("aceita contato sem wa_id somente quando é o único", () => {
    expect(names({ contacts: [{ profile: { name: NAME } }], messages: [message(PHONE)] })).toEqual([NAME])
    const two = [{ profile: { name: "Ana" } }, { profile: { name: "Bruno" } }]
    expect(names({ contacts: two, messages: [message(PHONE)] })).toEqual([null])
  })

  it("limita o tamanho do nome", () => {
    const [name] = names({ contacts: [{ wa_id: PHONE, profile: { name: "x".repeat(500) } }], messages: [message(PHONE)] })
    expect(name).toHaveLength(256)
  })
})

describe("processWhatsAppEvents com mensagens recebidas", () => {
  const events = (): WhatsAppEvent[] => {
    const parsed = parseWhatsAppPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PNID_A" },
                contacts: [{ wa_id: PHONE, profile: { name: NAME } }],
                messages: [
                  { id: "wamid.1", from: PHONE, type: "text", text: { body: TEXT }, timestamp: "1760000000" },
                  { id: "wamid.2", from: PHONE, type: "image", timestamp: "1760000001" },
                ],
                statuses: [{ id: "wamid.OUT", status: "delivered", timestamp: "1760000002" }],
              },
            },
          ],
        },
      ],
    })
    if (!parsed.ok) throw new Error("payload inválido")
    return parsed.events
  }

  function eventStore() {
    const stored = new Set<string>()
    return vi.fn(async (rows: WebhookEventRow[]) => {
      const inserted = new Set<string>()
      for (const row of rows) {
        if (stored.has(row.dedupe_key)) continue
        stored.add(row.dedupe_key)
        inserted.add(row.dedupe_key)
      }
      return inserted
    })
  }

  it("chama o processamento só para mensagens, em ordem, e nunca para status", async () => {
    const processInboundMessage = vi.fn(async () => undefined)
    await processWhatsAppEvents(events(), {
      resolveCompany: async () => COMPANY_A,
      insertEvents: eventStore(),
      processInboundMessage,
    })

    const calls = processInboundMessage.mock.calls as unknown as [WhatsAppEvent][]
    expect(calls.map(([e]) => e.messageId)).toEqual(["wamid.1", "wamid.2"])
    expect(calls.every(([e]) => e.kind === "message")).toBe(true)
  })

  it("não chama o processamento quando a empresa não está configurada", async () => {
    const processInboundMessage = vi.fn(async () => undefined)
    await processWhatsAppEvents(events(), {
      resolveCompany: async () => null,
      insertEvents: eventStore(),
      processInboundMessage,
    })
    expect(processInboundMessage).not.toHaveBeenCalled()
  })

  it("não lança nem interrompe as demais mensagens quando uma falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const seen: string[] = []
    await expect(
      processWhatsAppEvents(events(), {
        resolveCompany: async () => COMPANY_A,
        insertEvents: eventStore(),
        processInboundMessage: async (event) => {
          seen.push(event.messageId)
          if (event.messageId === "wamid.1") throw new Error("boom")
        },
      }),
    ).resolves.toBeUndefined()
    expect(seen).toEqual(["wamid.1", "wamid.2"])
  })

  it("grava conversa e mensagens de ponta a ponta e não duplica no reenvio da Meta", async () => {
    const { db, tables } = memoryDb(seed())
    const insertEvents = eventStore()
    const deps = {
      resolveCompany: async () => COMPANY_A,
      insertEvents,
      processInboundMessage: (event: Parameters<typeof processWhatsAppInboundMessage>[0]) =>
        processWhatsAppInboundMessage(event, { db }),
    }

    await processWhatsAppEvents(events(), deps)
    await processWhatsAppEvents(events(), deps)

    expect(tables.whatsapp_conversations).toHaveLength(1)
    expect(tables.whatsapp_conversations[0]).toMatchObject({ company_id: COMPANY_A, contact_name: NAME })
    expect(tables.whatsapp_messages.map((m) => [m.whatsapp_message_id, m.message_type])).toEqual([
      ["wamid.1", "text"],
      ["wamid.2", "unknown"],
    ])
  })

  it("recupera uma falha anterior quando a Meta reenvia um evento já registrado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { db, tables } = memoryDb(seed())
    const insertEvents = eventStore()
    const deps = (failing: boolean) => ({
      resolveCompany: async () => COMPANY_A,
      insertEvents,
      processInboundMessage: (event: Parameters<typeof processWhatsAppInboundMessage>[0]) =>
        processWhatsAppInboundMessage(event, { db: failing ? memoryDb(seed(), ["whatsapp_messages"]).db : db }),
    })

    await processWhatsAppEvents(events(), deps(true))
    expect(tables.whatsapp_messages).toHaveLength(0)

    await processWhatsAppEvents(events(), deps(false))
    expect(tables.whatsapp_messages).toHaveLength(2)
  })
})
