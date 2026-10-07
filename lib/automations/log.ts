type LogFields = Record<string, string | number | boolean | null | undefined>

/** Log estruturado. Só ids, códigos e contagens: nunca texto de mensagens, telefones ou tokens. */
export function logAutomation(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  const line = JSON.stringify({ source: "automations", level, event, ...fields })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.info(line)
}
