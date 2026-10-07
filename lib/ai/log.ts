import { sanitizeDetail } from "@/lib/ai/errors"

type LogLevel = "info" | "warn" | "error"

export type AgentLogFields = Record<string, string | number | boolean | null | undefined>

/**
 * Log estruturado do agente. Nunca recebe o conteúdo das mensagens nem a chave:
 * todo texto livre passa por `sanitizeDetail`.
 */
export function logAgent(level: LogLevel, event: string, fields: AgentLogFields = {}) {
  const safe: AgentLogFields = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    safe[key] = typeof value === "string" ? sanitizeDetail(value) : value
  }
  console[level](`[ai-agent] ${event}`, JSON.stringify(safe))
}
