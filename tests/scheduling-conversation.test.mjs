import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FALLBACK_REPLY,
  SAFE_REPLIES,
  computeNextAction,
  createEmptyConversationState,
  hasUnsupportedClaim,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  parseConversationState,
  parseModelOutput,
  resolveAgentTurn,
} from "../lib/ai/agents/scheduling-conversation.ts"

const behavior = {
  askName: true,
  askPhone: true,
  askEmail: true,
  allowCancellation: true,
  allowRescheduling: true,
}

function modelJson({ intent = "none", name = null, phone = null, email = null, reply = "Certo." } = {}) {
  return JSON.stringify({ intent, customer: { name, phone, email }, nextAction: "identify_intent", reply })
}

function turn(raw, userText, previous = createEmptyConversationState(), overrides = {}) {
  return resolveAgentTurn({
    raw,
    previous,
    behavior: { ...behavior, ...overrides },
    userText,
    connectedTools: [],
  })
}

describe("intenções", () => {
  it("agendamento → schedule", () => {
    const result = turn(modelJson({ intent: "schedule" }), "Quero marcar uma consulta.")
    assert.equal(result.state.intent, "schedule")
    assert.equal(result.nextAction, "collect_name")
  })

  it("cancelamento → cancel", () => {
    assert.equal(turn(modelJson({ intent: "cancel" }), "Quero cancelar").state.intent, "cancel")
  })

  it("reagendamento → reschedule", () => {
    assert.equal(turn(modelJson({ intent: "reschedule" }), "Preciso reagendar").state.intent, "reschedule")
  })

  it("intent 'none' mantém a intenção anterior", () => {
    const previous = { ...createEmptyConversationState(), intent: "schedule" }
    assert.equal(turn(modelJson({ intent: "none" }), "ok", previous).state.intent, "schedule")
  })

  it("cancelamento sem permissão encaminha para a equipe", () => {
    const result = turn(modelJson({ intent: "cancel" }), "Quero cancelar", undefined, { allowCancellation: false })
    assert.equal(result.nextAction, "handoff_to_team")
  })
})

describe("extração de dados", () => {
  it("extrai o nome", () => {
    assert.equal(turn(modelJson({ name: "João Silva" }), "João Silva.").state.customer.name, "João Silva")
  })

  it("extrai e formata o telefone", () => {
    const result = turn(modelJson({ phone: "(22) 99999-9999" }), "(22) 99999-9999")
    assert.equal(result.state.customer.phone, "(22) 99999-9999")
    assert.equal(normalizePhone("+55 22 3333 4444"), "(22) 3333-4444")
    assert.equal(normalizePhone("12345"), null)
  })

  it("extrai o e-mail", () => {
    assert.equal(turn(modelJson({ email: "Joao@Email.com" }), "joao@email.com").state.customer.email, "joao@email.com")
    assert.equal(normalizeEmail("joao@"), null)
  })

  it("rejeita dados que o cliente não escreveu (inventados pelo modelo)", () => {
    const result = turn(modelJson({ name: "Maria Souza", phone: "(11) 98888-7777", email: "x@y.com" }), "Quero agendar")
    assert.deepEqual(result.state.customer, { name: null, phone: null, email: null })
  })

  it("ignora campos desativados na configuração", () => {
    const result = turn(modelJson({ email: "joao@email.com" }), "joao@email.com", undefined, { askEmail: false })
    assert.equal(result.state.customer.email, null)
  })

  it("rejeita nomes inválidos", () => {
    assert.equal(normalizeName("<script>"), null)
    assert.equal(normalizeName("J"), null)
  })
})

describe("contexto da conversa", () => {
  it("dados permanecem entre as mensagens e avançam a próxima ação", () => {
    let user = "Quero marcar uma consulta."
    let result = turn(modelJson({ intent: "schedule" }), user)
    assert.equal(result.nextAction, "collect_name")

    user += "\nJoão Silva."
    result = turn(modelJson({ intent: "schedule", name: "João Silva" }), user, result.state)
    assert.equal(result.nextAction, "collect_phone")

    user += "\n(22) 99999-9999"
    // O modelo "esquece" o nome nesta rodada: o estado anterior deve ser mantido.
    result = turn(modelJson({ intent: "none", phone: "22999999999" }), user, result.state)
    assert.equal(result.state.customer.name, "João Silva")
    assert.equal(result.nextAction, "collect_email")

    user += "\njoao@email.com"
    result = turn(modelJson({ intent: "schedule", email: "joao@email.com" }), user, result.state)
    assert.deepEqual(result.state, {
      intent: "schedule",
      customer: { name: "João Silva", phone: "(22) 99999-9999", email: "joao@email.com" },
    })
    assert.equal(result.nextAction, "check_availability")
    assert.equal(result.blockedTool, "get_availability")
  })

  it("reiniciar gera um estado vazio", () => {
    assert.deepEqual(createEmptyConversationState(), {
      intent: null,
      customer: { name: null, phone: null, email: null },
    })
    assert.equal(computeNextAction(createEmptyConversationState(), behavior, []).nextAction, "identify_intent")
  })

  it("estado vindo do navegador é validado", () => {
    const parsed = parseConversationState({ intent: "hack", customer: { name: 1, phone: "abc", email: "a@b.co" } })
    assert.deepEqual(parsed, { intent: null, customer: { name: null, phone: null, email: "a@b.co" } })
  })
})

describe("disponibilidade e ações não suportadas", () => {
  it("bloqueia afirmações de horário livre ou ação executada", () => {
    for (const text of [
      "Temos horários amanhã às 14h.",
      "O horário das 10h está disponível.",
      "Pronto, seu agendamento foi confirmado!",
      "Cancelei sua consulta.",
      "Sua consulta foi reagendada para sexta.",
    ]) {
      assert.equal(hasUnsupportedClaim(text), true, text)
      const result = turn(modelJson({ intent: "schedule", reply: text }), "Quero agendar")
      assert.equal(result.reply, SAFE_REPLIES.schedule)
    }
  })

  it("permite respostas honestas", () => {
    for (const text of [
      "Posso continuar com seus dados, mas ainda preciso consultar a disponibilidade da agenda para confirmar os horários.",
      "Ainda não tenho acesso aos horários disponíveis.",
      "Qual telefone posso usar para contato?",
    ]) {
      assert.equal(hasUnsupportedClaim(text), false, text)
    }
  })

  it("cancelamento nunca é dado como executado", () => {
    const result = turn(modelJson({ intent: "cancel", reply: "Seu horário foi cancelado." }), "Quero cancelar")
    assert.equal(result.reply, SAFE_REPLIES.cancel)
    assert.equal(computeNextAction({ ...result.state, customer: { name: "A B", phone: "x", email: "y" } }, behavior, []).blockedTool, "cancel_appointment")
  })
})

describe("resposta inválida do modelo", () => {
  const previous = { intent: "schedule", customer: { name: "João Silva", phone: null, email: null } }

  for (const [label, raw] of [
    ["JSON quebrado", '{"reply": "oi", "intent":'],
    ["intent desconhecida", JSON.stringify({ reply: "oi", intent: "delete_all", customer: {} })],
    ["sem reply", JSON.stringify({ intent: "cancel", customer: {} })],
    ["customer com tipo errado", JSON.stringify({ reply: "oi", intent: "cancel", customer: { name: 42 } })],
    ["vazio", ""],
  ]) {
    it(`${label} não executa nenhuma ação`, () => {
      const result = turn(raw, "Quero cancelar\n(22) 99999-9999", previous)
      assert.equal(result.structured, false)
      assert.deepEqual(result.state, previous)
      assert.equal(result.reply, FALLBACK_REPLY)
    })
  }

  it("texto livre vira resposta normal, sem alterar o estado", () => {
    const result = turn("Claro, como posso ajudar?", "oi", previous)
    assert.equal(result.structured, false)
    assert.equal(result.reply, "Claro, como posso ajudar?")
    assert.deepEqual(result.state, previous)
  })

  it("parseModelOutput aceita saída válida", () => {
    assert.ok(parseModelOutput(modelJson({ intent: "schedule" })))
  })
})
