type LogFields = Record<string, string | number | boolean | null | undefined>

/**
 * Log estruturado do webhook. Aceita apenas valores primitivos: não há como
 * passar um payload, token ou texto de cliente por acidente como objeto.
 * Quem chama é responsável por nunca incluir segredos, números de telefone ou
 * conteúdo de mensagens.
 */
export function logWebhook(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  const line = JSON.stringify({ source: "whatsapp_webhook", level, event, ...fields })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}
