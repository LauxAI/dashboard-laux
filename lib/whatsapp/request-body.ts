export const MAX_WEBHOOK_BODY_BYTES = 3 * 1024 * 1024

export type BodyReadResult = { ok: true; body: string } | { ok: false; reason: "too_large" | "unreadable" }

/**
 * Lê o corpo como texto interrompendo a leitura ao ultrapassar o limite, em vez
 * de carregar um corpo arbitrariamente grande na memória.
 */
export async function readLimitedBody(request: Request, maxBytes = MAX_WEBHOOK_BODY_BYTES): Promise<BodyReadResult> {
  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return { ok: false, reason: "too_large" }
  if (!request.body) return { ok: true, body: "" }

  const reader = request.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let received = 0
  let body = ""

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, reason: "too_large" }
      }
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
  } catch {
    return { ok: false, reason: "unreadable" }
  }

  return { ok: true, body }
}
