export type AgentErrorStage = "auth" | "company" | "request" | "agent_config" | "specialists" | "generation"

export type AgentErrorCode =
  | "gemini_not_configured"
  | "gemini_auth"
  | "gemini_timeout"
  | "gemini_overloaded"
  | "gemini_rate_limited"
  | "gemini_model_unavailable"
  | "gemini_bad_request"
  | "gemini_server_error"
  | "empty_response"
  | "request_aborted"
  | "unknown"

export type AgentErrorInfo = {
  code: AgentErrorCode
  /** Falhas transitórias: tentar de novo (ou em outro modelo) pode resolver. */
  retryable: boolean
  status?: number
  /** Mensagem técnica já sem segredos, apenas para log e diagnóstico. */
  detail: string
}

export const agentErrorMessages: Record<AgentErrorCode, string> = {
  gemini_not_configured: "O serviço de IA não está configurado.",
  gemini_auth: "A chave do serviço de IA foi recusada. Verifique a configuração.",
  gemini_timeout: "O serviço de IA demorou demais para responder. Tente novamente.",
  gemini_overloaded: "O serviço de IA está com alta demanda no momento. Tente novamente em instantes.",
  gemini_rate_limited: "Muitas requisições ao serviço de IA. Aguarde um instante e tente novamente.",
  gemini_model_unavailable: "O modelo de IA configurado está indisponível.",
  gemini_bad_request: "O serviço de IA recusou a requisição.",
  gemini_server_error: "O serviço de IA apresentou uma falha temporária. Tente novamente.",
  empty_response: "O agente não gerou uma resposta. Tente reformular a mensagem.",
  request_aborted: "A requisição foi cancelada.",
  unknown: "Não foi possível gerar a resposta agora. Tente novamente.",
}

const MAX_DETAIL = 300

/** Remove chaves de API e tokens de qualquer texto antes de registrá-lo ou exibi-lo. */
export function sanitizeDetail(value: string): string {
  return value
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[chave]")
    .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, "$1[token]")
    .replace(/([?&]key=)[^&\s"']+/gi, "$1[chave]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DETAIL)
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {}

/** Desce por `lastError`/`cause` (ex.: AI_RetryError) até o erro que tem o status HTTP. */
function rootError(error: unknown): Record<string, unknown> {
  let current = asRecord(error)
  for (let depth = 0; depth < 4; depth += 1) {
    const next = current.lastError ?? (typeof current.statusCode === "number" ? undefined : current.cause)
    if (!next || typeof next !== "object") break
    current = next as Record<string, unknown>
  }
  return current
}

const byStatus = (status: number): { code: AgentErrorCode; retryable: boolean } => {
  if (status === 401 || status === 403) return { code: "gemini_auth", retryable: false }
  if (status === 404) return { code: "gemini_model_unavailable", retryable: true }
  if (status === 408 || status === 504) return { code: "gemini_timeout", retryable: true }
  if (status === 429) return { code: "gemini_rate_limited", retryable: true }
  if (status === 503) return { code: "gemini_overloaded", retryable: true }
  if (status >= 500) return { code: "gemini_server_error", retryable: true }
  if (status >= 400) return { code: "gemini_bad_request", retryable: true }
  return { code: "unknown", retryable: false }
}

export function classifyAgentError(error: unknown): AgentErrorInfo {
  const root = rootError(error)
  const name = typeof root.name === "string" ? root.name : ""
  const message = typeof root.message === "string" ? root.message : typeof error === "string" ? error : ""
  const detail = sanitizeDetail(message || name || "erro desconhecido")
  const status = typeof root.statusCode === "number" ? root.statusCode : undefined

  if (name === "GeminiNotConfiguredError") return { code: "gemini_not_configured", retryable: false, detail }
  if (name === "AbortError") return { code: "request_aborted", retryable: false, detail }
  if (name === "TimeoutError") return { code: "gemini_timeout", retryable: true, detail }
  if (message === "empty_model_response" || message === "Resposta vazia do modelo.") {
    return { code: "empty_response", retryable: true, detail }
  }
  if (status !== undefined) return { ...byStatus(status), status, detail }
  return { code: "unknown", retryable: false, detail }
}

/** Uma falha de configuração (chave) ou o cancelamento do usuário se repetiriam em qualquer modelo. */
export function isFallbackEligible(info: AgentErrorInfo): boolean {
  return !["gemini_not_configured", "gemini_auth", "request_aborted"].includes(info.code)
}
