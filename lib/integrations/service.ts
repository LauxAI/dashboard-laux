import "server-only"
import { crmConnectors } from "./connectors/crm"
import * as make from "./connectors/make"
import * as n8n from "./connectors/n8n"
import * as openai from "./connectors/openai"
import { isEncryptionConfigured } from "./crypto"
import { IntegrationError, toIntegrationError } from "./http"
import { logIntegration } from "./log"
import { getProvider, type ProviderId } from "./registry"
import { disconnect, getCredentials, markStatus, saveConnection } from "./store"

const MAX_FIELD_LENGTH = 2048

export type ServiceResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code: string }

export function failure(error: unknown): { ok: false; error: string; code: string } {
  const normalized = toIntegrationError(error)
  return { ok: false, error: normalized.message, code: normalized.code }
}

/** Executa uma operação, registra o resultado (sem dados sensíveis) e normaliza erros. */
export async function tracked<T>(companyId: string, provider: string, operation: string, run: () => Promise<T>): Promise<ServiceResult<T>> {
  const started = Date.now()
  try {
    const data = await run()
    await logIntegration({ companyId, provider, operation, ok: true, durationMs: Date.now() - started })
    return { ok: true, data }
  } catch (error) {
    const normalized = toIntegrationError(error)
    await logIntegration({
      companyId,
      provider,
      operation,
      ok: false,
      durationMs: Date.now() - started,
      httpStatus: normalized.httpStatus,
      errorCode: normalized.code,
      message: normalized.message,
    })
    return { ok: false, error: normalized.message, code: normalized.code }
  }
}

async function verifyProvider(provider: ProviderId, values: Record<string, string>) {
  switch (provider) {
    case "openai":
      return openai.verify(values.apiKey)
    case "n8n":
      return n8n.verify(values.baseUrl, values.apiKey)
    case "make":
      make.validateTarget(values.zone, values.teamId)
      return make.verify(values.zone, values.teamId, values.apiToken)
    default: {
      const ops = crmConnectors[provider]
      if (!ops) throw new IntegrationError("not_supported")
      return ops.verify(values)
    }
  }
}

export async function connectProvider(companyId: string, provider: ProviderId, rawValues: Record<string, unknown>): Promise<ServiceResult<{ accountLabel: string | null }>> {
  const definition = getProvider(provider)
  if (!definition) return { ok: false, error: "Integração desconhecida.", code: "not_supported" }
  if (!isEncryptionConfigured()) {
    return { ok: false, error: "A chave de criptografia das integrações não está configurada no servidor.", code: "not_configured" }
  }

  const values: Record<string, string> = {}
  for (const field of definition.fields) {
    const raw = rawValues[field.key]
    const value = typeof raw === "string" ? raw.trim() : ""
    if (field.required && !value) return { ok: false, error: `Preencha o campo "${field.label}".`, code: "not_configured" }
    if (value.length > MAX_FIELD_LENGTH) return { ok: false, error: `O campo "${field.label}" é longo demais.`, code: "not_configured" }
    if (field.type === "select" && value && !field.options?.some((option) => option.value === value)) {
      return { ok: false, error: `Valor inválido em "${field.label}".`, code: "not_configured" }
    }
    values[field.key] = value
  }

  const verified = await tracked(companyId, provider, "connect", () => verifyProvider(provider, values))
  if (!verified.ok) return verified

  const secrets: Record<string, string> = {}
  const config: Record<string, string> = { ...verified.data.config }
  for (const field of definition.fields) {
    if (field.secret) secrets[field.key] = values[field.key]
    else if (values[field.key]) config[field.key] = config[field.key] ?? values[field.key]
  }
  const primary = definition.fields.find((field) => field.secret)?.key ?? ""

  try {
    await saveConnection(companyId, provider, { secrets, config, accountLabel: verified.data.accountLabel, primarySecret: values[primary] ?? "" })
  } catch (error) {
    return failure(error)
  }
  return { ok: true, data: { accountLabel: verified.data.accountLabel } }
}

export async function testProvider(companyId: string, provider: ProviderId): Promise<ServiceResult> {
  const result = await tracked(companyId, provider, "test", async () => {
    const credentials = await getCredentials(companyId, provider)
    if (!credentials) throw new IntegrationError("not_configured", "Conecte a integração primeiro.")
    await verifyProvider(provider, { ...credentials.config, ...credentials.secrets })
  })
  await markStatus(companyId, provider, result.ok ? { ok: true } : { ok: false, code: result.code, message: result.error })
  return result.ok ? { ok: true, data: undefined } : result
}

export async function disconnectProvider(companyId: string, provider: ProviderId): Promise<ServiceResult> {
  try {
    await disconnect(companyId, provider)
    return { ok: true, data: undefined }
  } catch (error) {
    return failure(error)
  }
}

/** Credenciais combinadas (config + segredos) ou erro amigável se não houver conexão ativa. */
export async function requireCredentials(companyId: string, provider: ProviderId): Promise<Record<string, string>> {
  const credentials = await getCredentials(companyId, provider)
  if (!credentials) throw new IntegrationError("not_configured", `Conecte o ${getProvider(provider)?.name ?? provider} em Integrações.`)
  return { ...credentials.config, ...credentials.secrets }
}
