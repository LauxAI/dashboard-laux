import "server-only"
import { generateText } from "ai"
import { buildAgentInstructions } from "@/lib/ai/agent-prompt"
import { getGeminiModel } from "@/lib/ai/gemini"
import type { ChatMessage } from "@/lib/ai/request"
import type { AIAgentConfig, AIAgentType } from "@/lib/domain/types"

const MAX_OUTPUT_TOKENS = 1024
const TIMEOUT_MS = 30_000

export type AgentRunResult = { reply: string; inputTokens?: number; outputTokens?: number }

/** As mensagens do usuário vão somente em `messages`, nunca nas instruções. */
export async function runAgent(input: {
  type: AIAgentType
  config: AIAgentConfig
  companyName?: string | null
  messages: ChatMessage[]
}): Promise<AgentRunResult> {
  const result = await generateText({
    model: getGeminiModel(),
    instructions: buildAgentInstructions(input.type, input.config, input.companyName),
    messages: input.messages,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.4,
    maxRetries: 1,
    timeout: TIMEOUT_MS,
  })

  const reply = result.text.trim()
  if (!reply) throw new Error("Resposta vazia do modelo.")
  return { reply, inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens }
}
