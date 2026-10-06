import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { normalizeAIAgentConfig } from "@/lib/domain/ai-agents"
import { buildConversationHistory, processWhatsAppAgentReply, type AgentReplyContext } from "./agent-reply"
import type { WhatsAppMessage } from "./conversations"
import type { ReplyStore } from "./reply-store"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("admin client must be injected in tests")
  },
}))
vi.mock("@/lib/ai/agent-runner", () => ({
  generateAgentReply: () => {
    throw new Error("generate must be injected in tests")
  },
}))

const COMPANY = "11111111-1111-4111-8111-111111111111"
const CONVERSATION = "22222222-2222-4222-8222-222222222222"
const INBOUND = "33333333-3333-4333-8333-333333333333"
const REPLY = "44444444-4444-4444-8444-444444444444"
const PHONE = "5511999998888"
const SECRET_TEXT = "Qual o horário de funcionamento?"
const MODEL_TEXT = "Funcionamos das 9h às 18h."

const context: AgentReplyContext = {
  companyId: COMPANY,
  conversationId: CONVERSATION,
  inboundMessageId: INBOUND,
  phoneNumberId: "123456789012345",
}

const agentConfig = normalizeAIAgentConfig("atendimento", { name: "Ana", objective: "Atender", knowledge: "Horário: 9h às 18h" })

function message(overrides: Partial<WhatsAppMessage>): WhatsAppMessage {
  return {
    id: INBOUND,
    conversation_id: CONVERSATION,
    company_id: COMPANY,
    direction: "inbound",
    message_type: "text",
    whatsapp_message_id: null,
    sender_phone: PHONE,
    recipient_phone: null,
    text_content: SECRET_TEXT,
    status: "received",
    created_at: "2026-10-06T10:00:00Z",
    ...overrides,
  }
}

function makeStore(overrides: Partial<ReplyStore> = {}) {
  const store: ReplyStore = {
    loadContext: vi.fn(async () => ({
      conversationStatus: "open" as const,
      contactPhone: PHONE,
      inbound: { id: INBOUND, messageType: "text", textContent: SECRET_TEXT },
    })),
    loadActiveAgent: vi.fn(async () => ({ type: "atendimento" as const, config: agentConfig, companyName: "Loja X" })),
    claim: vi.fn(async () => ({ claimed: true as const, replyId: REPLY })),
    finalize: vi.fn(async () => {}),
    loadHistory: vi.fn(async () => [message({})]),
    recordUsage: vi.fn(async () => {}),
    ...overrides,
  }
  return store
}

const generateOk = () => vi.fn(async () => ({ text: MODEL_TEXT, inputTokens: 10, outputTokens: 5 }))
const sendOk = () => vi.fn(async () => ({ ok: true as const, messageId: "wamid.OUT1" }))

let logs: string[]
beforeEach(() => {
  logs = []
  for (const method of ["log", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((line: unknown) => {
      logs.push(String(line))
    })
  }
})
afterEach(() => vi.restoreAllMocks())

describe("processWhatsAppAgentReply", () => {
  it("gera, envia e grava a resposta como 'sent' com o wamid", async () => {
    const store = makeStore()
    const generate = generateOk()
    const send = sendOk()

    const result = await processWhatsAppAgentReply(context, { store, generate, send })

    expect(result).toEqual({ status: "sent", replyId: REPLY })
    expect(store.claim).toHaveBeenCalledWith({
      companyId: COMPANY,
      conversationId: CONVERSATION,
      inboundMessageId: INBOUND,
      recipientPhone: PHONE,
    })
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "atendimento",
        companyName: "Loja X",
        messages: [{ role: "user", content: SECRET_TEXT }],
      }),
    )
    expect(send).toHaveBeenCalledWith({ phoneNumberId: context.phoneNumberId, to: PHONE, text: MODEL_TEXT })
    expect(store.finalize).toHaveBeenCalledWith({
      companyId: COMPANY,
      replyId: REPLY,
      status: "sent",
      whatsappMessageId: "wamid.OUT1",
      textContent: MODEL_TEXT,
    })
    expect(store.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY, agentType: "atendimento", status: "success", inputTokens: 10, outputTokens: 5 }),
    )
  })

  it("usa o telefone da conversa gravada, não o do evento", async () => {
    const send = sendOk()
    await processWhatsAppAgentReply(
      { ...context, contactPhone: "5500000000000" } as AgentReplyContext,
      { store: makeStore(), generate: generateOk(), send },
    )
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: PHONE }))
  })

  it("não responde duas vezes: quando a reserva já existe, nada é gerado nem enviado", async () => {
    const store = makeStore({ claim: vi.fn(async () => ({ claimed: false as const })) })
    const generate = generateOk()
    const send = sendOk()

    const result = await processWhatsAppAgentReply(context, { store, generate, send })

    expect(result).toEqual({ status: "skipped", reason: "already_handled" })
    expect(generate).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(store.finalize).not.toHaveBeenCalled()
  })

  it("execuções concorrentes para a mesma mensagem geram uma única resposta", async () => {
    let claimed = false
    const store = makeStore({
      claim: vi.fn(async () => {
        if (claimed) return { claimed: false as const }
        claimed = true
        return { claimed: true as const, replyId: REPLY }
      }),
    })
    const send = sendOk()
    const results = await Promise.all(
      [1, 2, 3].map(() => processWhatsAppAgentReply(context, { store, generate: generateOk(), send })),
    )
    expect(results.filter((r) => r.status === "sent")).toHaveLength(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it.each(["handoff", "closed"] as const)("não responde conversa em '%s'", async (conversationStatus) => {
    const store = makeStore({
      loadContext: vi.fn(async () => ({
        conversationStatus,
        contactPhone: PHONE,
        inbound: { id: INBOUND, messageType: "text", textContent: SECRET_TEXT },
      })),
    })
    const send = sendOk()
    const result = await processWhatsAppAgentReply(context, { store, generate: generateOk(), send })
    expect(result).toEqual({ status: "skipped", reason: "conversation_not_open" })
    expect(store.claim).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it.each([
    ["unknown", null],
    ["image", null],
    ["text", "   "],
  ])("ignora mensagem não textual (%s)", async (messageType, textContent) => {
    const store = makeStore({
      loadContext: vi.fn(async () => ({
        conversationStatus: "open" as const,
        contactPhone: PHONE,
        inbound: { id: INBOUND, messageType, textContent },
      })),
    })
    const result = await processWhatsAppAgentReply(context, { store, generate: generateOk(), send: sendOk() })
    expect(result).toEqual({ status: "skipped", reason: "not_text" })
    expect(store.claim).not.toHaveBeenCalled()
  })

  it("não faz nada quando a empresa não tem agente ativo e válido", async () => {
    const store = makeStore({ loadActiveAgent: vi.fn(async () => null) })
    const send = sendOk()
    const result = await processWhatsAppAgentReply(context, { store, generate: generateOk(), send })
    expect(result).toEqual({ status: "skipped", reason: "no_active_agent" })
    expect(store.claim).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it("ignora conversa/mensagem que não pertence à empresa", async () => {
    const store = makeStore({ loadContext: vi.fn(async () => null) })
    const result = await processWhatsAppAgentReply(context, { store, generate: generateOk(), send: sendOk() })
    expect(result).toEqual({ status: "skipped", reason: "context_not_found" })
    expect(store.claim).not.toHaveBeenCalled()
  })

  it("falha da IA marca a reserva como 'failed', registra uso com erro e não envia", async () => {
    const store = makeStore()
    const send = sendOk()
    const generate = vi.fn(async () => {
      throw new Error("boom")
    })
    const result = await processWhatsAppAgentReply(context, { store, generate, send })

    expect(result).toEqual({ status: "failed", reason: "generation_failed" })
    expect(send).not.toHaveBeenCalled()
    expect(store.finalize).toHaveBeenCalledWith({ companyId: COMPANY, replyId: REPLY, status: "failed" })
    expect(store.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }))
  })

  it("falha no envio marca 'failed' guardando o texto gerado e não tenta de novo", async () => {
    const store = makeStore()
    const send = vi.fn(async () => ({ ok: false as const, error: "graph_api_error" as const, httpStatus: 400, graphErrorCode: 131047 }))
    const result = await processWhatsAppAgentReply(context, { store, generate: generateOk(), send })

    expect(result).toEqual({ status: "failed", reason: "send_failed" })
    expect(send).toHaveBeenCalledTimes(1)
    expect(store.finalize).toHaveBeenCalledWith({ companyId: COMPANY, replyId: REPLY, status: "failed", textContent: MODEL_TEXT })
  })

  it("se o registro final falhar depois do envio, não reenvia e informa finalize_failed", async () => {
    const store = makeStore({
      finalize: vi.fn(async () => {
        throw new Error("db")
      }),
    })
    const send = sendOk()
    const result = await processWhatsAppAgentReply(context, { store, generate: generateOk(), send })
    expect(result).toEqual({ status: "failed", reason: "finalize_failed" })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("falha de banco ao carregar contexto, agente ou reserva vira 'failed' sem lançar", async () => {
    const boom = async () => {
      throw new Error("db")
    }
    await expect(
      processWhatsAppAgentReply(context, { store: makeStore({ loadContext: boom }), generate: generateOk(), send: sendOk() }),
    ).resolves.toEqual({ status: "failed", reason: "context_lookup_failed" })
    await expect(
      processWhatsAppAgentReply(context, { store: makeStore({ loadActiveAgent: boom }), generate: generateOk(), send: sendOk() }),
    ).resolves.toEqual({ status: "failed", reason: "agent_lookup_failed" })
    await expect(
      processWhatsAppAgentReply(context, { store: makeStore({ claim: boom }), generate: generateOk(), send: sendOk() }),
    ).resolves.toEqual({ status: "failed", reason: "claim_failed" })
  })

  it("falha ao registrar uso não impede o envio", async () => {
    const store = makeStore({
      recordUsage: vi.fn(async () => {
        throw new Error("db")
      }),
    })
    const result = await processWhatsAppAgentReply(context, { store, generate: generateOk(), send: sendOk() })
    expect(result.status).toBe("sent")
  })

  it("nunca registra texto, telefone, token ou resposta do modelo nos logs", async () => {
    const send = vi.fn(async () => ({ ok: false as const, error: "graph_api_error" as const, httpStatus: 400 }))
    await processWhatsAppAgentReply(context, { store: makeStore(), generate: generateOk(), send })
    await processWhatsAppAgentReply(context, { store: makeStore(), generate: generateOk(), send: sendOk() })
    const all = logs.join("\n")
    expect(logs.length).toBeGreaterThan(0)
    for (const secret of [SECRET_TEXT, MODEL_TEXT, PHONE, "Loja X", "Horário"]) expect(all).not.toContain(secret)
  })
})

describe("buildConversationHistory", () => {
  const user = (id: string, text: string, at: string) => message({ id, text_content: text, created_at: at })
  const bot = (id: string, text: string, at: string, status: WhatsAppMessage["status"] = "sent") =>
    message({ id, direction: "outbound", sender_phone: null, recipient_phone: PHONE, text_content: text, status, created_at: at })

  it("mantém a ordem, alterna papéis e termina na mensagem respondida", () => {
    const history = buildConversationHistory(
      [user("a", "oi", "1"), bot("b", "olá!", "2"), user(INBOUND, "preço?", "3"), user("later", "depois", "4")],
      { id: INBOUND, text: "preço?" },
    )
    expect(history).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "olá!" },
      { role: "user", content: "preço?" },
    ])
  })

  it("junta mensagens seguidas do mesmo autor", () => {
    const history = buildConversationHistory([user("a", "oi", "1"), user(INBOUND, "tem horário?", "2")], {
      id: INBOUND,
      text: "tem horário?",
    })
    expect(history).toEqual([{ role: "user", content: "oi\ntem horário?" }])
  })

  it("descarta respostas pendentes ou falhas, mídia e mensagens sem texto", () => {
    const history = buildConversationHistory(
      [
        user("a", "oi", "1"),
        bot("b", "nunca enviada", "2", "failed"),
        bot("c", "reservada", "3", "pending"),
        message({ id: "d", message_type: "unknown", text_content: null, created_at: "4" }),
        user(INBOUND, "preço?", "5"),
      ],
      { id: INBOUND, text: "preço?" },
    )
    expect(history).toEqual([{ role: "user", content: "oi\npreço?" }])
  })

  it("começa sempre pelo cliente", () => {
    const history = buildConversationHistory([bot("a", "mensagem ativa", "1"), user(INBOUND, "oi", "2")], {
      id: INBOUND,
      text: "oi",
    })
    expect(history).toEqual([{ role: "user", content: "oi" }])
  })

  it("usa o texto da mensagem quando ela não está no histórico carregado", () => {
    expect(buildConversationHistory([], { id: INBOUND, text: "oi" })).toEqual([{ role: "user", content: "oi" }])
  })

  it("respeita os limites de tamanho", () => {
    const history = buildConversationHistory([user(INBOUND, "x".repeat(5000), "1")], { id: INBOUND, text: "x" })
    expect(history[0].content).toHaveLength(2000)
  })
})

describe("migration whatsapp_agent_reply_claims", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261006050000_whatsapp_agent_reply_claims.sql"), "utf8")

  it("aceita 'pending', cria a coluna e o índice único parcial de respostas outbound", () => {
    expect(sql).toMatch(/status in \('received', 'pending', 'sent', 'delivered', 'read', 'failed'\)/)
    expect(sql).toMatch(/add column if not exists reply_to_message_id uuid/)
    expect(sql).toMatch(/create unique index if not exists idx_whatsapp_messages_reply_to_outbound/)
    expect(sql).toMatch(/where direction = 'outbound' and reply_to_message_id is not null/)
  })

  it("valida alvo inbound, mesma conversa e empresa, e protege a função", () => {
    expect(sql).toMatch(/target\.direction <> 'inbound'/)
    expect(sql).toMatch(/target\.conversation_id <> new\.conversation_id/)
    expect(sql).toMatch(/target\.company_id <> new\.company_id/)
    expect(sql).toMatch(/revoke all on function public\.validate_whatsapp_message_reply\(\) from public, anon, authenticated/)
  })

  it("não mexe em RLS, policies nem grants de tabela", () => {
    expect(sql).not.toMatch(/policy|enable row level security|grant /i)
  })
})
