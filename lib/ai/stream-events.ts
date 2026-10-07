export type StreamUsageFlags = { userExceeded: boolean; companyExceeded: boolean }

export type StreamSpecialistKey = "scheduling" | "sales" | "support"
const specialistKeys: StreamSpecialistKey[] = ["scheduling", "sales", "support"]

export type AgentStreamEvent =
  | { type: "delta"; text: string }
  | { type: "specialist"; specialist: StreamSpecialistKey; tool: string; success: boolean }
  | { type: "done"; usage: StreamUsageFlags }
  | { type: "error"; error: string; code?: string; stage?: string; retryable?: boolean; detail?: string }

export const STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8"

export function encodeStreamEvent(event: AgentStreamEvent): string {
  return `${JSON.stringify(event)}\n`
}

/** Linha inválida ou de formato desconhecido retorna null; o cliente a ignora. */
export function parseStreamLine(line: string): AgentStreamEvent | null {
  if (!line.trim()) return null
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (!value || typeof value !== "object") return null
  const event = value as Record<string, unknown>

  if (event.type === "delta" && typeof event.text === "string") return { type: "delta", text: event.text }
  if (
    event.type === "specialist" &&
    typeof event.specialist === "string" &&
    specialistKeys.includes(event.specialist as StreamSpecialistKey) &&
    typeof event.tool === "string" &&
    typeof event.success === "boolean"
  ) {
    return { type: "specialist", specialist: event.specialist as StreamSpecialistKey, tool: event.tool, success: event.success }
  }
  if (event.type === "error" && typeof event.error === "string") {
    return {
      type: "error",
      error: event.error,
      ...(typeof event.code === "string" ? { code: event.code } : {}),
      ...(typeof event.stage === "string" ? { stage: event.stage } : {}),
      ...(typeof event.retryable === "boolean" ? { retryable: event.retryable } : {}),
      ...(typeof event.detail === "string" ? { detail: event.detail } : {}),
    }
  }
  if (event.type === "done" && event.usage && typeof event.usage === "object") {
    const usage = event.usage as Record<string, unknown>
    return {
      type: "done",
      usage: { userExceeded: usage.userExceeded === true, companyExceeded: usage.companyExceeded === true },
    }
  }
  return null
}

/** Separa o buffer em linhas completas e devolve o resto (linha ainda incompleta). */
export function splitStreamBuffer(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n")
  const rest = parts.pop() ?? ""
  return { lines: parts, rest }
}
