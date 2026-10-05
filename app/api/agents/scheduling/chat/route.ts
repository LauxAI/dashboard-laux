import { NextResponse } from "next/server"
import {
  buildSchedulingSystemPrompt,
  connectedSchedulingTools,
  parseSchedulingAgentConfig,
  schedulingAgentResponseSchema,
} from "@/lib/ai/agents/scheduling-agent"
import { parseConversationState, resolveAgentTurn } from "@/lib/ai/agents/scheduling-conversation"
import { GEMINI_MODEL, GeminiError, generateGeminiChat, type GeminiChatMessage } from "@/lib/ai/gemini"
import { createClient } from "@/lib/supabase/server"

const MAX_MESSAGE_LENGTH = 4000
const MAX_HISTORY_MESSAGES = 40

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

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as
    | { messages?: unknown; config?: unknown; state?: unknown }
    | null
  const messages = parseMessages(body?.messages)
  if (typeof messages === "string") {
    return NextResponse.json({ error: messages }, { status: 400 })
  }

  const config = parseSchedulingAgentConfig(body?.config)
  const previous = parseConversationState(body?.state)

  try {
    const raw = await generateGeminiChat({
      messages,
      systemInstruction: buildSchedulingSystemPrompt(config, previous),
      temperature: 0.2,
      responseSchema: schedulingAgentResponseSchema,
    })

    const turn = resolveAgentTurn({
      raw,
      previous,
      behavior: config.behavior,
      userText: messages
        .filter((message) => message.role === "user")
        .map((message) => message.text)
        .join("\n"),
      connectedTools: connectedSchedulingTools,
    })
    if (!turn.structured) {
      console.warn("[api/agents/scheduling/chat] Invalid structured output; no action applied")
    }

    return NextResponse.json({ ...turn, model: GEMINI_MODEL })
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[api/agents/scheduling/chat] Unexpected error", error)
    return NextResponse.json({ error: "Erro inesperado ao consultar o agente." }, { status: 500 })
  }
}
