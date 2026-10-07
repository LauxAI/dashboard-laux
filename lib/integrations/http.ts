import "server-only"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

export type IntegrationErrorCode =
  | "invalid_credentials"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "network"
  | "invalid_url"
  | "provider_error"
  | "bad_response"
  | "not_configured"
  | "not_supported"

const MESSAGES: Record<IntegrationErrorCode, string> = {
  invalid_credentials: "Credenciais inválidas ou expiradas. Confira os dados e tente novamente.",
  forbidden: "A credencial não tem permissão para esta operação. Revise as permissões no serviço.",
  not_found: "O recurso não foi encontrado no serviço.",
  rate_limited: "O serviço limitou as requisições. Aguarde um pouco e tente novamente.",
  timeout: "O serviço demorou demais para responder.",
  network: "Não foi possível alcançar o serviço. Verifique o endereço informado.",
  invalid_url: "O endereço informado não é permitido. Use uma URL https pública.",
  provider_error: "O serviço retornou um erro. Tente novamente em instantes.",
  bad_response: "O serviço respondeu em um formato inesperado.",
  not_configured: "A integração não está configurada.",
  not_supported: "Esta operação não é compatível com o serviço conectado.",
}

export class IntegrationError extends Error {
  constructor(
    readonly code: IntegrationErrorCode,
    message?: string,
    readonly httpStatus?: number,
  ) {
    super(message ?? MESSAGES[code])
    this.name = "IntegrationError"
  }
}

export function errorFromStatus(status: number): IntegrationError {
  if (status === 401) return new IntegrationError("invalid_credentials", undefined, status)
  if (status === 403) return new IntegrationError("forbidden", undefined, status)
  if (status === 404) return new IntegrationError("not_found", undefined, status)
  if (status === 429) return new IntegrationError("rate_limited", undefined, status)
  return new IntegrationError("provider_error", undefined, status)
}

export function toIntegrationError(error: unknown): IntegrationError {
  if (error instanceof IntegrationError) return error
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return new IntegrationError("timeout")
  return new IntegrationError("network")
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
}

const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]

/** true para loopback, rede privada, link-local (inclui metadados de nuvem) e reservados. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const value = ipv4ToInt(ip)
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
      return (value & mask) === (ipv4ToInt(base) & mask)
    })
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase()
    if (lower === "::" || lower === "::1") return true
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") || lower.startsWith("fe9")) return true
    if (lower.startsWith("fea") || lower.startsWith("feb") || lower.startsWith("ff")) return true
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isPrivateAddress(mapped[1]) : false
  }
  return true
}

/**
 * Valida uma URL informada pelo usuário antes de chamá-la do servidor (SSRF):
 * somente https, sem credenciais embutidas, sem porta incomum e sem resolver para
 * endereços privados, loopback ou de metadados.
 */
export async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new IntegrationError("invalid_url")
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new IntegrationError("invalid_url")
  if (url.port && url.port !== "443") throw new IntegrationError("invalid_url")

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new IntegrationError("invalid_url")
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new IntegrationError("invalid_url")
    return url
  }
  try {
    const addresses = await lookup(host, { all: true })
    if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
      throw new IntegrationError("invalid_url")
    }
  } catch (error) {
    if (error instanceof IntegrationError) throw error
    throw new IntegrationError("network")
  }
  return url
}

export type RequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  /** true para URLs informadas pelo usuário: aplica a proteção contra SSRF. */
  userSupplied?: boolean
}

export type JsonResponse<T> = { status: number; data: T; text: string; durationMs: number }

const MAX_BODY_BYTES = 1_000_000

/**
 * Chamada HTTP com timeout, sem seguir redirecionamentos e com leitura limitada do
 * corpo. Respostas não 2xx viram IntegrationError (nunca vazam o corpo cru).
 */
export async function requestJson<T = unknown>(url: string, options: RequestOptions = {}): Promise<JsonResponse<T>> {
  if (options.userSupplied) await assertPublicHttpsUrl(url)
  const started = Date.now()
  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: { Accept: "application/json", ...options.headers },
      body: options.body,
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
      cache: "no-store",
    })
  } catch (error) {
    throw toIntegrationError(error)
  }

  const durationMs = Date.now() - started
  if (response.status >= 300 && response.status < 400) throw new IntegrationError("provider_error", "O serviço tentou redirecionar a chamada.", response.status)
  if (!response.ok) throw errorFromStatus(response.status)

  const buffer = await response.arrayBuffer().catch(() => new ArrayBuffer(0))
  const text = new TextDecoder().decode(buffer.byteLength > MAX_BODY_BYTES ? buffer.slice(0, MAX_BODY_BYTES) : buffer)
  if (text.trim() === "") return { status: response.status, data: null as T, text, durationMs }
  try {
    return { status: response.status, data: JSON.parse(text) as T, text, durationMs }
  } catch {
    return { status: response.status, data: null as T, text, durationMs }
  }
}
