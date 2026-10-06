import { createHash, createHmac, timingSafeEqual } from "node:crypto"

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

/** Comparação em tempo constante, sem vazar o tamanho do segredo. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b))
}

const MAX_CHALLENGE_LENGTH = 512

export type VerificationParams = {
  mode: string | null
  token: string | null
  challenge: string | null
}

/** Handshake GET da Meta: devolve o challenge somente se o token conferir. */
export function verifySubscription(params: VerificationParams, expectedToken: string | undefined): string | null {
  if (!expectedToken) return null
  if (params.mode !== "subscribe" || !params.token || !params.challenge) return null
  if (params.challenge.length > MAX_CHALLENGE_LENGTH) return null
  return safeEqual(params.token, expectedToken) ? params.challenge : null
}

export function signBody(rawBody: string, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`
}

/** Valida o cabeçalho `X-Hub-Signature-256` contra o corpo bruto da requisição. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false
  return safeEqual(header, signBody(rawBody, appSecret))
}

export function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}
