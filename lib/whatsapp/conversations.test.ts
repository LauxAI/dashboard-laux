import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  findOrCreateWhatsAppConversation,
  getWhatsAppConversationMessages,
  saveWhatsAppInboundMessage,
  saveWhatsAppOutboundMessage,
  WhatsAppConversationError,
} from "./conversations"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("admin client must be injected in tests")
  },
}))

const COMPANY_A = "11111111-1111-4111-8111-111111111111"
const COMPANY_B = "99999999-9999-4999-8999-999999999999"
const CONNECTION = "22222222-2222-4222-8222-222222222222"
const CONVERSATION = "33333333-3333-4333-8333-333333333333"
const OTHER_CONVERSATION = "44444444-4444-4444-8444-444444444444"
const PHONE = "5511999990000"

type Result = { data: unknown; error: { code?: string; message?: string } | null }
type Op = { method: string; args: unknown[] }
type Chain = { table: string; ops: Op[]; terminal: string }

const ok = (data: unknown): Result => ({ data, error: null })
const fail = (code?: string): Result => ({ data: null, error: { code, message: "boom" } })

function fakeDb(handler: (chain: Chain) => Result) {
  const chains: Chain[] = []
  const db = {
    from(table: string) {
      const ops: Op[] = []
      const run = (terminal: string) => {
        const chain = { table, ops, terminal }
        chains.push(chain)
        return handler(chain)
      }
      const builder: Record<string, unknown> = {}
      for (const method of ["select", "eq", "order", "limit", "insert", "update", "returns"]) {
        builder[method] = (...args: unknown[]) => {
          ops.push({ method, args })
          return builder
        }
      }
      builder.maybeSingle = async () => run("maybeSingle")
      builder.single = async () => run("single")
      builder.then = (resolve: (r: Result) => unknown) => resolve(run("then"))
      return builder
    },
  }
  return { db: db as unknown as SupabaseClient, chains }
}

const op = (chain: Chain, method: string) => chain.ops.find((o) => o.method === method)
const hasEq = (chain: Chain, column: string, value: unknown) =>
  chain.ops.some((o) => o.method === "eq" && o.args[0] === column && o.args[1] === value)
const writes = (chains: Chain[]) => chains.filter((c) => c.ops.some((o) => o.method === "insert" || o.method === "update"))

const conversation = {
  id: CONVERSATION,
  company_id: COMPANY_A,
  whatsapp_connection_id: CONNECTION,
  contact_phone: PHONE,
  contact_name: null,
  status: "open",
  last_message_at: null,
  created_at: "2026-10-06T00:00:00Z",
  updated_at: "2026-10-06T00:00:00Z",
}

const inboundMessage = {
  id: "55555555-5555-4555-8555-555555555555",
  conversation_id: CONVERSATION,
  company_id: COMPANY_A,
  direction: "inbound",
  message_type: "text",
  whatsapp_message_id: "wamid.AAA",
  sender_phone: PHONE,
  recipient_phone: null,
  text_content: "oi",
  status: "received",
  created_at: "2026-10-06T00:00:01Z",
}

const inboundInput = {
  conversationId: CONVERSATION,
  companyId: COMPANY_A,
  whatsappMessageId: "wamid.AAA",
  senderPhone: PHONE,
  textContent: "oi",
  messageType: "text" as const,
}

afterEach(() => vi.restoreAllMocks())

describe("findOrCreateWhatsAppConversation", () => {
  const input = { whatsappConnectionId: CONNECTION, companyId: COMPANY_A, contactPhone: PHONE, contactName: "Maria" }

  it("creates the conversation after checking the connection belongs to the company", async () => {
    const { db, chains } = fakeDb((c) => {
      if (c.table === "whatsapp_connections") return ok({ id: CONNECTION })
      if (op(c, "insert")) return ok({ ...conversation, contact_name: "Maria" })
      return ok(null)
    })

    const result = await findOrCreateWhatsAppConversation(input, db)

    expect(result.contact_name).toBe("Maria")
    const connectionCheck = chains.find((c) => c.table === "whatsapp_connections")!
    expect(hasEq(connectionCheck, "id", CONNECTION)).toBe(true)
    expect(hasEq(connectionCheck, "company_id", COMPANY_A)).toBe(true)
    const insert = chains.find((c) => op(c, "insert"))!
    expect(op(insert, "insert")!.args[0]).toEqual({
      company_id: COMPANY_A,
      whatsapp_connection_id: CONNECTION,
      contact_phone: PHONE,
      contact_name: "Maria",
    })
  })

  it("refuses a connection of another company without writing anything", async () => {
    const { db, chains } = fakeDb(() => ok(null))

    await expect(
      findOrCreateWhatsAppConversation({ ...input, companyId: COMPANY_B }, db),
    ).rejects.toMatchObject({ code: "connection_not_found" })
    expect(writes(chains)).toHaveLength(0)
  })

  it("returns the existing conversation for the same connection and phone (no duplicate)", async () => {
    const { db, chains } = fakeDb((c) => {
      if (c.table === "whatsapp_connections") return ok({ id: CONNECTION })
      return ok({ ...conversation, contact_name: "Maria" })
    })

    const result = await findOrCreateWhatsAppConversation(input, db)

    expect(result.id).toBe(CONVERSATION)
    expect(writes(chains)).toHaveLength(0)
    const lookup = chains.find((c) => c.table === "whatsapp_conversations")!
    expect(hasEq(lookup, "whatsapp_connection_id", CONNECTION)).toBe(true)
    expect(hasEq(lookup, "company_id", COMPANY_A)).toBe(true)
    expect(hasEq(lookup, "contact_phone", PHONE)).toBe(true)
  })

  it("updates the contact name only when a different name is provided", async () => {
    const { db, chains } = fakeDb((c) => {
      if (c.table === "whatsapp_connections") return ok({ id: CONNECTION })
      if (op(c, "update")) return ok({ ...conversation, contact_name: "Maria" })
      return ok({ ...conversation, contact_name: "Mari" })
    })

    const result = await findOrCreateWhatsAppConversation(input, db)

    expect(result.contact_name).toBe("Maria")
    const update = chains.find((c) => op(c, "update"))!
    expect(op(update, "update")!.args[0]).toEqual({ contact_name: "Maria" })
    expect(hasEq(update, "company_id", COMPANY_A)).toBe(true)
  })

  it("recovers from a concurrent insert (unique violation) by reading the winner", async () => {
    let lookups = 0
    const { db } = fakeDb((c) => {
      if (c.table === "whatsapp_connections") return ok({ id: CONNECTION })
      if (op(c, "insert")) return fail("23505")
      lookups += 1
      return ok(lookups === 1 ? null : conversation)
    })

    const result = await findOrCreateWhatsAppConversation({ ...input, contactName: null }, db)

    expect(result.id).toBe(CONVERSATION)
  })

  it("rejects invalid ids and phone numbers", async () => {
    const { db, chains } = fakeDb(() => ok(null))

    await expect(findOrCreateWhatsAppConversation({ ...input, companyId: "x" }, db)).rejects.toMatchObject({
      code: "invalid_input",
    })
    await expect(
      findOrCreateWhatsAppConversation({ ...input, whatsappConnectionId: "x" }, db),
    ).rejects.toMatchObject({ code: "invalid_input" })
    await expect(findOrCreateWhatsAppConversation({ ...input, contactPhone: "abc" }, db)).rejects.toMatchObject({
      code: "invalid_input",
    })
    await expect(findOrCreateWhatsAppConversation({ ...input, contactPhone: "123" }, db)).rejects.toMatchObject({
      code: "invalid_input",
    })
    expect(chains).toHaveLength(0)
  })

  it("maps database failures to a generic error code", async () => {
    const { db } = fakeDb(() => fail("XX000"))
    await expect(findOrCreateWhatsAppConversation(input, db)).rejects.toMatchObject({ code: "database_error" })
  })
})

describe("saveWhatsAppInboundMessage", () => {
  it("validates the conversation belongs to the company, then inserts an inbound message", async () => {
    const { db, chains } = fakeDb((c) => {
      if (c.table === "whatsapp_conversations") return ok({ id: CONVERSATION })
      if (op(c, "insert")) return ok(inboundMessage)
      return ok(null)
    })

    const result = await saveWhatsAppInboundMessage(inboundInput, db)

    expect(result).toEqual({ message: inboundMessage, duplicate: false })
    const ownership = chains.find((c) => c.table === "whatsapp_conversations")!
    expect(hasEq(ownership, "id", CONVERSATION)).toBe(true)
    expect(hasEq(ownership, "company_id", COMPANY_A)).toBe(true)
    const insert = chains.find((c) => op(c, "insert"))!
    expect(op(insert, "insert")!.args[0]).toEqual({
      conversation_id: CONVERSATION,
      company_id: COMPANY_A,
      direction: "inbound",
      message_type: "text",
      whatsapp_message_id: "wamid.AAA",
      sender_phone: PHONE,
      recipient_phone: null,
      text_content: "oi",
      status: "received",
    })
  })

  it("does not write when the conversation belongs to another company", async () => {
    const { db, chains } = fakeDb(() => ok(null))

    await expect(
      saveWhatsAppInboundMessage({ ...inboundInput, companyId: COMPANY_B }, db),
    ).rejects.toMatchObject({ code: "conversation_not_found" })
    expect(writes(chains)).toHaveLength(0)
  })

  it("is idempotent: an existing whatsapp_message_id returns the stored message and writes nothing", async () => {
    const { db, chains } = fakeDb((c) => {
      if (c.table === "whatsapp_conversations") return ok({ id: CONVERSATION })
      return ok(inboundMessage)
    })

    const result = await saveWhatsAppInboundMessage(inboundInput, db)

    expect(result).toEqual({ message: inboundMessage, duplicate: true })
    expect(writes(chains)).toHaveLength(0)
  })

  it("never returns a message id that exists in another conversation or company", async () => {
    for (const foreign of [
      { ...inboundMessage, conversation_id: OTHER_CONVERSATION },
      { ...inboundMessage, company_id: COMPANY_B },
    ]) {
      const { db, chains } = fakeDb((c) => (c.table === "whatsapp_conversations" ? ok({ id: CONVERSATION }) : ok(foreign)))
      await expect(saveWhatsAppInboundMessage(inboundInput, db)).rejects.toMatchObject({ code: "message_id_conflict" })
      expect(writes(chains)).toHaveLength(0)
    }
  })

  it("recovers from a concurrent duplicate (unique violation) by reading the stored message", async () => {
    let messageLookups = 0
    const { db } = fakeDb((c) => {
      if (c.table === "whatsapp_conversations") return ok({ id: CONVERSATION })
      if (op(c, "insert")) return fail("23505")
      messageLookups += 1
      return ok(messageLookups === 1 ? null : inboundMessage)
    })

    const result = await saveWhatsAppInboundMessage(inboundInput, db)

    expect(result.duplicate).toBe(true)
    expect(result.message.id).toBe(inboundMessage.id)
  })

  it("rejects invalid input before touching the database", async () => {
    const { db, chains } = fakeDb(() => ok(null))
    const bad = [
      { ...inboundInput, conversationId: "x" },
      { ...inboundInput, whatsappMessageId: "" },
      { ...inboundInput, senderPhone: "not-a-phone" },
      { ...inboundInput, messageType: "sticker" as never },
      { ...inboundInput, textContent: "a".repeat(4097) },
    ]
    for (const input of bad) {
      await expect(saveWhatsAppInboundMessage(input, db)).rejects.toBeInstanceOf(WhatsAppConversationError)
    }
    expect(chains).toHaveLength(0)
  })

  it("accepts media messages without text", async () => {
    const { db, chains } = fakeDb((c) => {
      if (c.table === "whatsapp_conversations") return ok({ id: CONVERSATION })
      if (op(c, "insert")) return ok({ ...inboundMessage, message_type: "image", text_content: null })
      return ok(null)
    })

    await saveWhatsAppInboundMessage({ ...inboundInput, messageType: "image", textContent: null }, db)

    const insert = chains.find((c) => op(c, "insert"))!
    expect(op(insert, "insert")!.args[0]).toMatchObject({ message_type: "image", text_content: null })
  })
})

describe("saveWhatsAppOutboundMessage", () => {
  const outboundInput = {
    conversationId: CONVERSATION,
    companyId: COMPANY_A,
    whatsappMessageId: "wamid.OUT",
    recipientPhone: PHONE,
    textContent: "olá",
    messageType: "text" as const,
  }
  const outboundMessage = {
    ...inboundMessage,
    direction: "outbound",
    whatsapp_message_id: "wamid.OUT",
    sender_phone: null,
    recipient_phone: PHONE,
    text_content: "olá",
    status: "sent",
  }

  it("inserts an outbound message with status sent", async () => {
    const { db, chains } = fakeDb((c) => {
      if (c.table === "whatsapp_conversations") return ok({ id: CONVERSATION })
      if (op(c, "insert")) return ok(outboundMessage)
      return ok(null)
    })

    const result = await saveWhatsAppOutboundMessage(outboundInput, db)

    expect(result.duplicate).toBe(false)
    const insert = chains.find((c) => op(c, "insert"))!
    expect(op(insert, "insert")!.args[0]).toEqual({
      conversation_id: CONVERSATION,
      company_id: COMPANY_A,
      direction: "outbound",
      message_type: "text",
      whatsapp_message_id: "wamid.OUT",
      sender_phone: null,
      recipient_phone: PHONE,
      text_content: "olá",
      status: "sent",
    })
  })

  it("works without a whatsapp_message_id and skips the idempotency lookup", async () => {
    const { db, chains } = fakeDb((c) => {
      if (c.table === "whatsapp_conversations") return ok({ id: CONVERSATION })
      if (op(c, "insert")) return ok({ ...outboundMessage, whatsapp_message_id: null, status: "failed" })
      return ok(null)
    })

    await saveWhatsAppOutboundMessage({ ...outboundInput, whatsappMessageId: undefined, status: "failed" }, db)

    expect(chains.some((c) => c.table === "whatsapp_messages" && !op(c, "insert"))).toBe(false)
    const insert = chains.find((c) => op(c, "insert"))!
    expect(op(insert, "insert")!.args[0]).toMatchObject({ whatsapp_message_id: null, status: "failed" })
  })

  it("is idempotent by whatsapp_message_id and isolated by company", async () => {
    const dup = fakeDb((c) => (c.table === "whatsapp_conversations" ? ok({ id: CONVERSATION }) : ok(outboundMessage)))
    expect((await saveWhatsAppOutboundMessage(outboundInput, dup.db)).duplicate).toBe(true)
    expect(writes(dup.chains)).toHaveLength(0)

    const cross = fakeDb(() => ok(null))
    await expect(
      saveWhatsAppOutboundMessage({ ...outboundInput, companyId: COMPANY_B }, cross.db),
    ).rejects.toMatchObject({ code: "conversation_not_found" })
    expect(writes(cross.chains)).toHaveLength(0)
  })

  it("rejects the received status and invalid recipients", async () => {
    const { db, chains } = fakeDb(() => ok(null))
    await expect(
      saveWhatsAppOutboundMessage({ ...outboundInput, status: "received" as never }, db),
    ).rejects.toMatchObject({ code: "invalid_input" })
    await expect(saveWhatsAppOutboundMessage({ ...outboundInput, recipientPhone: "x" }, db)).rejects.toMatchObject({
      code: "invalid_input",
    })
    expect(chains).toHaveLength(0)
  })
})

describe("getWhatsAppConversationMessages", () => {
  const older = { ...inboundMessage, id: "a", created_at: "2026-10-06T00:00:01Z" }
  const newer = { ...inboundMessage, id: "b", created_at: "2026-10-06T00:00:02Z" }

  it("reads only the company's messages and returns them in chronological order", async () => {
    const { db, chains } = fakeDb((c) => {
      if (c.table === "whatsapp_conversations") return ok({ id: CONVERSATION })
      return ok([newer, older])
    })

    const result = await getWhatsAppConversationMessages({ conversationId: CONVERSATION, companyId: COMPANY_A }, db)

    expect(result.map((m) => m.id)).toEqual(["a", "b"])
    const read = chains.find((c) => c.table === "whatsapp_messages")!
    expect(hasEq(read, "conversation_id", CONVERSATION)).toBe(true)
    expect(hasEq(read, "company_id", COMPANY_A)).toBe(true)
    expect(op(read, "limit")!.args[0]).toBe(50)
  })

  it("denies cross-company reads before querying messages", async () => {
    const { db, chains } = fakeDb(() => ok(null))

    await expect(
      getWhatsAppConversationMessages({ conversationId: CONVERSATION, companyId: COMPANY_B }, db),
    ).rejects.toMatchObject({ code: "conversation_not_found" })
    expect(chains.some((c) => c.table === "whatsapp_messages")).toBe(false)
  })

  it("clamps the limit and rejects non-numeric limits", async () => {
    const { db, chains } = fakeDb((c) => (c.table === "whatsapp_conversations" ? ok({ id: CONVERSATION }) : ok([])))
    const base = { conversationId: CONVERSATION, companyId: COMPANY_A }

    await getWhatsAppConversationMessages({ ...base, limit: 10_000 }, db)
    await getWhatsAppConversationMessages({ ...base, limit: 0 }, db)
    const limits = chains.filter((c) => c.table === "whatsapp_messages").map((c) => op(c, "limit")!.args[0])
    expect(limits).toEqual([200, 1])

    await expect(getWhatsAppConversationMessages({ ...base, limit: Number.NaN }, db)).rejects.toMatchObject({
      code: "invalid_input",
    })
  })
})

describe("secrets and logging", () => {
  it("never selects access_token or any sensitive column, and never logs", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m))
    const { db, chains } = fakeDb((c) => {
      if (c.table === "whatsapp_connections") return ok({ id: CONNECTION })
      if (c.table === "whatsapp_conversations") return ok(op(c, "insert") ? conversation : null)
      return ok(null)
    })

    await findOrCreateWhatsAppConversation(
      { whatsappConnectionId: CONNECTION, companyId: COMPANY_A, contactPhone: PHONE },
      db,
    ).catch(() => undefined)
    await saveWhatsAppInboundMessage(inboundInput, db).catch(() => undefined)
    await getWhatsAppConversationMessages({ conversationId: CONVERSATION, companyId: COMPANY_A }, db).catch(
      () => undefined,
    )

    const selected = chains.flatMap((c) => c.ops.filter((o) => o.method === "select").map((o) => String(o.args[0])))
    expect(selected.length).toBeGreaterThan(0)
    for (const columns of selected) {
      expect(columns).not.toMatch(/token|secret|signature|header|payload/i)
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })

  it("returns objects without token fields", async () => {
    const { db } = fakeDb((c) => {
      if (c.table === "whatsapp_conversations") return ok({ id: CONVERSATION })
      return ok(inboundMessage)
    })
    const { message } = await saveWhatsAppInboundMessage(inboundInput, db)
    expect(JSON.stringify(message)).not.toMatch(/token|secret|signature/i)
    expect(Object.keys(message)).not.toContain("access_token")
  })
})

describe("migration 20261006040000_create_whatsapp_conversations", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261006040000_create_whatsapp_conversations.sql"),
    "utf8",
  )
  const tables = ["whatsapp_conversations", "whatsapp_messages"]

  it("enables and forces RLS on both tables", () => {
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`)
      expect(sql).toContain(`alter table public.${table} force row level security;`)
    }
  })

  it("only grants SELECT to authenticated and nothing to anon", () => {
    for (const table of tables) {
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated;`)
      expect(sql).toContain(`grant select on table public.${table} to authenticated;`)
      expect(sql).toContain(`grant select, insert, update, delete on table public.${table} to service_role;`)
    }
    expect(sql).not.toMatch(/grant [^;]*\bto (anon|public)\b/i)
    expect(sql).not.toMatch(/grant [^;]*(insert|update|delete)[^;]* to authenticated/i)
  })

  it("has only SELECT policies, scoped to the current company, and none for anon", () => {
    const policies = [...sql.matchAll(/create policy (\w+)\s+on public\.(\w+)\s+for (\w+)\s+to (\w+)\s+using \(([^;]+)\);/g)]
    expect(policies).toHaveLength(2)
    for (const [, , , command, role, expression] of policies) {
      expect(command).toBe("select")
      expect(role).toBe("authenticated")
      expect(expression).toContain("company_id = (select public.current_client_company_id())")
    }
    expect((sql.match(/create policy/g) ?? []).length).toBe(2)
    expect(sql).not.toMatch(/to anon/i)
  })

  it("keeps the required constraints and indexes", () => {
    expect(sql).toContain("unique (whatsapp_connection_id, contact_phone)")
    expect(sql).toContain("check (status in ('open', 'closed', 'handoff'))")
    expect(sql).toContain("check (direction in ('inbound', 'outbound'))")
    expect(sql).toContain("on public.whatsapp_messages (whatsapp_message_id)")
    expect(sql).toContain("where whatsapp_message_id is not null")
    expect(sql).toContain("foreign key (conversation_id, company_id)")
  })
})
