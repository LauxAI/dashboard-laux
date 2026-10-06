export const TEST_LIMITS = {
  maxMessages: 20,
  maxUserChars: 2000,
  maxAssistantChars: 8000,
} as const

export type ChatMessage = { role: "user" | "assistant"; content: string }

/** Valida o corpo de "Testar agente". Retorna as mensagens limpas ou uma mensagem de erro. */
export function parseTestRequest(body: unknown): { messages: ChatMessage[] } | { error: string } {
  const raw = body && typeof body === "object" ? (body as { messages?: unknown }).messages : undefined
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Envie ao menos uma mensagem." }
  if (raw.length > TEST_LIMITS.maxMessages) return { error: "A conversa de teste é longa demais. Limpe a conversa." }

  const messages: ChatMessage[] = []
  for (const item of raw) {
    const role = item && typeof item === "object" ? (item as { role?: unknown }).role : undefined
    const content = item && typeof item === "object" ? (item as { content?: unknown }).content : undefined
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return { error: "Mensagem inválida." }
    }
    const trimmed = content.trim()
    if (!trimmed) return { error: "Mensagem vazia." }
    const max = role === "user" ? TEST_LIMITS.maxUserChars : TEST_LIMITS.maxAssistantChars
    if (trimmed.length > max) return { error: `A mensagem excede o limite de ${max} caracteres.` }
    messages.push({ role, content: trimmed })
  }

  if (messages[messages.length - 1].role !== "user") return { error: "A última mensagem deve ser do usuário." }
  return { messages }
}
