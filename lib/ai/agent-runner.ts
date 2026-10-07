import "server-only"
import { stepCountIs, streamText, type ToolSet } from "ai"
import { buildAgentInstructions } from "@/lib/ai/agent-prompt"
import { createFallbackStream, type AttemptHandle, type FallbackStream } from "@/lib/ai/fallback"
import { assertGeminiConfigured, getGeminiModel, getGeminiModelChain, GEMINI_PROVIDER_OPTIONS } from "@/lib/ai/gemini"
import { logAgent, type AgentLogFields } from "@/lib/ai/log"
import type { ChatMessage } from "@/lib/ai/request"
import type { SpecialistContext } from "@/lib/ai/specialists"
import type { AIAgentConfig, AIAgentType } from "@/lib/domain/types"

const MAX_OUTPUT_TOKENS = 1024
/** Limite de cada tentativa; com o fallback, o pior caso continua dentro de `maxDuration` da rota. */
const ATTEMPT_TIMEOUT_MS = 22_000
const START_NEXT_ATTEMPT_BUDGET_MS = 30_000

export type AgentStream = FallbackStream

export type AgentRunInput = {
  type: AIAgentType
  config: AIAgentConfig
  companyName?: string | null
  messages: ChatMessage[]
  /** Especialistas habilitados (somente Atendimento) e as ferramentas que eles expõem. */
  specialists?: SpecialistContext
  tools?: ToolSet
  /**
   * Ferramentas que alteram dados de verdade. Depois que uma delas roda, a geração
   * não pode ser refeita em outro modelo. Ausente = toda ferramenta conta como efeito.
   */
  sideEffectTools?: string[]
  abortSignal?: AbortSignal
  /** Identificação apenas para o log estruturado. */
  logContext?: AgentLogFields
}

export type AgentReply = { text: string; inputTokens?: number; outputTokens?: number }

/**
 * Resposta completa (sem streaming), com o mesmo prompt, modelo e parâmetros do
 * playground. Lança se o modelo falhar ou devolver texto vazio.
 */
export async function generateAgentReply(input: AgentRunInput): Promise<AgentReply> {
  const stream = streamAgent(input)
  let text = ""
  for await (const chunk of stream.textStream) text += chunk
  const error = stream.getError()
  if (error) throw error
  const trimmed = text.trim()
  if (!trimmed) throw new Error("empty_model_response")
  return { text: trimmed, ...(await stream.usage()) }
}

/** Mesmo prompt e parâmetros para todos os modelos; as mensagens do usuário vão somente em `messages`. */
export function streamAgent(input: AgentRunInput): AgentStream {
  assertGeminiConfigured()
  const instructions = buildAgentInstructions(input.type, input.config, input.companyName, input.specialists)
  const hasTools = Boolean(input.tools && Object.keys(input.tools).length > 0)

  const start = (modelId: string): AttemptHandle => {
    let streamError: unknown
    let sideEffects = false

    const result = streamText({
      model: getGeminiModel(modelId),
      instructions,
      messages: input.messages,
      ...(hasTools ? { tools: input.tools, stopWhen: stepCountIs(5) } : {}),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
      providerOptions: GEMINI_PROVIDER_OPTIONS,
      // O fallback entre modelos já cobre falhas transitórias; evita esperar retries do SDK no mesmo modelo.
      maxRetries: 0,
      timeout: ATTEMPT_TIMEOUT_MS,
      abortSignal: input.abortSignal,
      onToolExecutionStart: (event: { toolCall: { toolName: string } }) => {
        const name = event.toolCall.toolName
        if (!input.sideEffectTools || input.sideEffectTools.includes(name)) sideEffects = true
      },
      onError: ({ error }) => {
        streamError = error
      },
    })

    return {
      textStream: result.textStream,
      getError: () => streamError,
      sideEffectsStarted: () => sideEffects,
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

  return createFallbackStream({
    models: getGeminiModelChain(),
    start,
    startBudgetMs: START_NEXT_ATTEMPT_BUDGET_MS,
    signal: input.abortSignal,
    onAttemptFailed: (record) =>
      logAgent(record.willRetry ? "warn" : "error", "tentativa de geração falhou", {
        ...input.logContext,
        stage: "generation",
        model: record.model,
        code: record.code,
        status: record.status,
        ms: record.ms,
        willRetry: record.willRetry,
        detail: record.detail,
      }),
  })
}
