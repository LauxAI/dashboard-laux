import "server-only"
import { streamText } from "ai"
import { buildAgentInstructions } from "@/lib/ai/agent-prompt"
import { getGeminiModel } from "@/lib/ai/gemini"
import type { ChatMessage } from "@/lib/ai/request"
import type { AIAgentConfig, AIAgentType } from "@/lib/domain/types"

const MAX_OUTPUT_TOKENS = 1024
const TIMEOUT_MS = 30_000

export type AgentStream = {
  textStream: AsyncIterable<string>
  /** Erro ocorrido durante a geração (o `textStream` não propaga erros por si só). */
  getError: () => unknown
  usage: () => Promise<{ inputTokens?: number; outputTokens?: number }>
}

/** Mesmo prompt, modelo e parâmetros de antes; as mensagens do usuário vão somente em `messages`. */
export function streamAgent(input: {
  type: AIAgentType
  config: AIAgentConfig
  companyName?: string | null
  messages: ChatMessage[]
  abortSignal?: AbortSignal
}): AgentStream {
  let streamError: unknown

  const result = streamText({
    model: getGeminiModel(),
    instructions: buildAgentInstructions(input.type, input.config, input.companyName),
    messages: input.messages,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.4,
    maxRetries: 1,
    timeout: TIMEOUT_MS,
    abortSignal: input.abortSignal,
    onError: ({ error }) => {
      streamError = error
    },
  })

  return {
    textStream: result.textStream,
    getError: () => streamError,
    usage: async () => {
      try {
        const usage = await result.usage
        return { inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens }
      } catch {
        return {}
      }
    },
  }
}
