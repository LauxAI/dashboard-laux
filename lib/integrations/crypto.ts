import "server-only"
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

/**
 * Criptografia de segredos das integrações (AES-256-GCM).
 *
 * A chave vem de INTEGRATIONS_ENCRYPTION_KEY (32 bytes em base64 ou 64 caracteres
 * hex) e nunca vai para o cliente. Formato gravado: `v1.<iv>.<tag>.<texto cifrado>`
 * (base64url). O prefixo de versão permite trocar de algoritmo ou chave no futuro.
 */

const VERSION = "v1"
const KEY_BYTES = 32

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super("encryption_not_configured")
    this.name = "EncryptionNotConfiguredError"
  }
}

function loadKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim()
  if (!raw) throw new EncryptionNotConfiguredError()
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64")
  if (key.length !== KEY_BYTES) throw new EncryptionNotConfiguredError()
  return key
}

export function isEncryptionConfigured(): boolean {
  try {
    loadKey()
    return true
  } catch {
    return false
  }
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".")
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split(".")
  if (version !== VERSION || !iv || !tag || !data) throw new Error("invalid_ciphertext")
  const decipher = createDecipheriv("aes-256-gcm", loadKey(), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")
}

export function encryptJson(value: Record<string, string>): string {
  return encryptSecret(JSON.stringify(value))
}

export function decryptJson(payload: string): Record<string, string> {
  const parsed: unknown = JSON.parse(decryptSecret(payload))
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("invalid_ciphertext")
  return parsed as Record<string, string>
}

/** Mostra apenas o final do segredo, ex.: "••••a1b2". Nunca devolve o valor completo. */
export function secretHint(secret: string): string {
  const tail = secret.trim().slice(-4)
  return secret.trim().length <= 8 ? "••••" : `••••${tail}`
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function hmacSha256Hex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex")
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8")
  const right = Buffer.from(b, "utf8")
  return left.length === right.length && timingSafeEqual(left, right)
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}
