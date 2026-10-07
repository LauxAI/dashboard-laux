import { classifyAgentError, isFallbackEligible, type AgentErrorCode } from "@/lib/ai/errors"

export type TokenUsage = { inputTokens?: number; outputTokens?: number }

/** Uma tentativa de geração com um modelo específico. */
export type AttemptHandle = {
  textStream: AsyncIterable<string>
  getError: () => unknown
  usage: () => Promise<TokenUsage>
  /** Verdadeiro quando o modelo já executou uma ação que não pode ser repetida em outro modelo. */
  sideEffectsStarted: () => boolean
}

export type AttemptRecord = {
  model: string
  code: AgentErrorCode
  status?: number
  detail: string
  ms: number
  willRetry: boolean
}

export type FallbackStream = {
  textStream: AsyncIterable<string>
  getError: () => unknown
  usage: () => Promise<TokenUsage>
  attempts: () => AttemptRecord[]
  /** Modelo que gerou (ou tentou gerar) a última resposta. */
  model: () => string | null
}

type Options = {
  models: string[]
  start: (model: string) => AttemptHandle
  /** Não inicia novas tentativas depois deste tempo, para caber no limite da função. */
  startBudgetMs?: number
  now?: () => number
  signal?: AbortSignal
  onAttemptFailed?: (record: AttemptRecord) => void
}

/**
 * Tenta os modelos em ordem. Só recorre ao próximo quando nada foi entregue ao
 * usuário e nenhuma ação irreversível foi executada: assim nunca duplica texto
 * nem repete um agendamento.
 */
export function createFallbackStream(options: Options): FallbackStream {
  const now = options.now ?? Date.now
  const startedAt = now()
  const budget = options.startBudgetMs ?? Number.POSITIVE_INFINITY
  const attempts: AttemptRecord[] = []
  let finalError: unknown
  let current: AttemptHandle | null = null
  let currentModel: string | null = null

  async function* generate(): AsyncGenerator<string> {
    for (let index = 0; index < options.models.length; index += 1) {
      const model = options.models[index]
      if (options.signal?.aborted) {
        finalError ??= Object.assign(new Error("Requisição cancelada."), { name: "AbortError" })
        return
      }
      if (index > 0 && now() - startedAt > budget) return

      const attemptStartedAt = now()
      const handle = options.start(model)
      current = handle
      currentModel = model
      let delivered = false
      let thrown: unknown

      try {
        for await (const text of handle.textStream) {
          if (!text) continue
          if (text.trim()) delivered = true
          yield text
        }
      } catch (error) {
        thrown = error
      }

      let error = thrown ?? handle.getError()
      if (!error && !delivered) error = new Error("empty_model_response")
      if (!error) {
        finalError = undefined
        return
      }

      finalError = error
      const info = classifyAgentError(error)
      const hasNext = index < options.models.length - 1
      const willRetry = hasNext && !delivered && !handle.sideEffectsStarted() && isFallbackEligible(info)
      const record: AttemptRecord = {
        model,
        code: info.code,
        status: info.status,
        detail: info.detail,
        ms: now() - attemptStartedAt,
        willRetry,
      }
      attempts.push(record)
      options.onAttemptFailed?.(record)
      if (!willRetry) return
    }
  }

  return {
    textStream: generate(),
    getError: () => finalError,
    usage: async () => (current ? current.usage() : {}),
    attempts: () => attempts,
    model: () => currentModel,
  }
}
