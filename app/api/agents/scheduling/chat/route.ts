import { NextResponse } from "next/server"
import {
  SCHEDULING_FUNCTION_DECLARATIONS,
  buildSchedulingSystemPrompt,
  parseSchedulingAgentConfig,
} from "@/lib/ai/agents/scheduling-agent"
import {
  parseConversationState,
  resolveAgentTurn,
  type ClaimEvidence,
} from "@/lib/ai/agents/scheduling-conversation"
import { GEMINI_MODEL, GeminiError, generateGeminiWithTools, type GeminiChatMessage } from "@/lib/ai/gemini"
import { minutesToTime, toZoned } from "@/lib/scheduling/availability"
import type { SchedulingRepository } from "@/lib/scheduling/repository"
import { createSupabaseSchedulingRepository } from "@/lib/scheduling/supabase-repository"
import { allowedSchedulingTools, createSchedulingToolExecutor, type ToolOutcome } from "@/lib/scheduling/tool-executor"
import { getAccountAccess } from "@/lib/supabase/account-access"
import { createClient } from "@/lib/supabase/server"

const MAX_MESSAGE_LENGTH = 4000
const MAX_HISTORY_MESSAGES = 40
/** Limite de escritas na agenda por mensagem do cliente. */
const MAX_WRITES_PER_TURN = 1

const WEEKDAY_NAMES = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"]

function parseMessages(input: unknown): GeminiChatMessage[] | string {
  if (!Array.isArray(input) || input.length === 0) return "Envie ao menos uma mensagem."

  const messages: GeminiChatMessage[] = []
  for (const item of input.slice(-MAX_HISTORY_MESSAGES)) {
    const role = (item as { role?: unknown })?.role
    const text = (item as { text?: unknown })?.text
    if ((role !== "user" && role !== "model") || typeof text !== "string" || !text.trim()) {
      return "Histórico de conversa inválido."
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      return `Cada mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`
    }
    messages.push({ role, text: text.trim() })
  }

  while (messages.length && messages[0].role !== "user") messages.shift()
  if (messages.at(-1)?.role !== "user") return "A última mensagem deve ser do cliente."
  return messages
}

function describeLocalNow(now: Date, timezone: string): string {
  const local = toZoned(now, timezone)
  const weekday = WEEKDAY_NAMES[new Date(`${local.dateKey}T12:00:00Z`).getUTCDay()]
  return `${weekday}, ${local.dateKey} ${minutesToTime(local.minutes)}`
}

function buildEvidence(outcomes: ToolOutcome[]): ClaimEvidence {
  const lastFailure = outcomes.filter((outcome) => !outcome.ok && outcome.message).at(-1)
  return {
    availabilityChecked: outcomes.some((outcome) => outcome.availabilityChecked),
    completed: outcomes.flatMap((outcome) => (outcome.action ? [outcome.action.type] : [])),
    failureReply: lastFailure ? `Não consegui concluir essa etapa: ${lastFailure.message}` : null,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const access = await getAccountAccess(supabase)
  if (access.status !== "active") {
    return NextResponse.json(
      { error: access.status === "error" ? "Não foi possível validar sua conta." : "Não autenticado." },
      { status: access.status === "error" ? 500 : 401 },
    )
  }
  const { companyId } = access

  const body = (await request.json().catch(() => null)) as
    | { messages?: unknown; config?: unknown; state?: unknown }
    | null
  const messages = parseMessages(body?.messages)
  if (typeof messages === "string") {
    return NextResponse.json({ error: messages }, { status: 400 })
  }

  const config = parseSchedulingAgentConfig(body?.config)
  const previous = parseConversationState(body?.state)
  const userText = messages
    .filter((message) => message.role === "user")
    .map((message) => message.text)
    .join("\n")

  try {
    const baseRepo = createSupabaseSchedulingRepository(supabase)
    const rules = await baseRepo.loadRules(companyId)
    const repo: SchedulingRepository = { ...baseRepo, loadRules: async () => rules }

    const now = new Date()
    const tools = allowedSchedulingTools(config.behavior)
    const executor = createSchedulingToolExecutor({
      companyId,
      behavior: config.behavior,
      customer: previous.customer,
      userText,
      now,
      repo,
    })

    const outcomes: ToolOutcome[] = []
    const raw = await generateGeminiWithTools({
      messages,
      systemInstruction: buildSchedulingSystemPrompt(config, previous, {
        tools,
        timezone: rules.settings.timezone,
        localNow: describeLocalNow(now, rules.settings.timezone),
      }),
      temperature: 0.2,
      functions: tools.map((tool) => SCHEDULING_FUNCTION_DECLARATIONS[tool]),
      executeFunction: async ({ name, args }) => {
        const writes = outcomes.filter((outcome) => outcome.action).length
        if (writes >= MAX_WRITES_PER_TURN && name !== "get_services" && name !== "get_availability") {
          return { ok: false, error: "limit", message: "Apenas uma alteração na agenda por mensagem." }
        }
        const outcome = await executor.execute(name, args)
        outcomes.push(outcome)
        return outcome.response
      },
    })

    const turn = resolveAgentTurn({
      raw,
      previous: { ...previous, customer: executor.customer() },
      behavior: config.behavior,
      userText,
      connectedTools: tools,
      evidence: buildEvidence(outcomes),
    })
    if (!turn.structured) {
      console.warn("[api/agents/scheduling/chat] Invalid structured output; reply guarded")
    }

    return NextResponse.json({
      ...turn,
      actions: outcomes.flatMap((outcome) => (outcome.action ? [outcome.action] : [])),
      toolCalls: outcomes.map(({ tool, ok }) => ({ tool, ok })),
      model: GEMINI_MODEL,
    })
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[api/agents/scheduling/chat] Unexpected error", error)
    return NextResponse.json({ error: "Erro inesperado ao consultar o agente." }, { status: 500 })
  }
}
