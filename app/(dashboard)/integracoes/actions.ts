"use server"

import { revalidatePath } from "next/cache"
import { getSessionContext } from "@/lib/automations/session"
import * as make from "@/lib/integrations/connectors/make"
import * as n8n from "@/lib/integrations/connectors/n8n"
import * as openai from "@/lib/integrations/connectors/openai"
import { importContactsFromCrm, type ImportSummary } from "@/lib/integrations/crm-sync"
import { crmProviderIds, isProviderId, type ProviderId } from "@/lib/integrations/registry"
import { connectProvider, disconnectProvider, requireCredentials, testProvider, tracked } from "@/lib/integrations/service"
import { updateConfig } from "@/lib/integrations/store"
import { rotateInboundToken, setInboundEnabled } from "@/lib/integrations/inbound"
import { toIntegrationError } from "@/lib/integrations/http"
import { createEndpoint, deleteEndpoint, sendTestDelivery, setEndpointActive } from "@/lib/integrations/webhooks"
import { getOrCreateWidget, normalizeOrigin, saveWidget } from "@/lib/integrations/widget"

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string }

type Failed = { ok: false; error: string }

async function withCompany<T>(run: (companyId: string) => Promise<Result<T>>): Promise<Result<T>> {
  const context = await getSessionContext()
  if (context.error !== undefined) return { ok: false, error: context.error }
  return run(context.companyId)
}

function strip<T>(result: { ok: true; data: T } | { ok: false; error: string; code: string }): Result<T> {
  return result.ok ? result : ({ ok: false, error: result.error } satisfies Failed)
}

export async function connectIntegration(provider: string, values: Record<string, unknown>): Promise<Result<{ accountLabel: string | null }>> {
  if (!isProviderId(provider)) return { ok: false, error: "Integração desconhecida." }
  return withCompany(async (companyId) => {
    const result = strip(await connectProvider(companyId, provider, values))
    revalidatePath("/integracoes")
    return result
  })
}

export async function testIntegration(provider: string): Promise<Result> {
  if (!isProviderId(provider)) return { ok: false, error: "Integração desconhecida." }
  return withCompany(async (companyId) => {
    const result = strip(await testProvider(companyId, provider))
    revalidatePath("/integracoes")
    return result
  })
}

export async function disconnectIntegration(provider: string): Promise<Result> {
  if (!isProviderId(provider)) return { ok: false, error: "Integração desconhecida." }
  return withCompany(async (companyId) => {
    const result = strip(await disconnectProvider(companyId, provider))
    revalidatePath("/integracoes")
    return result
  })
}

export type RemoteItem = { id: string; name: string; active: boolean }

/** Lista workflows (n8n) ou cenários (Make) da conta conectada. */
export async function listRemoteItems(provider: string): Promise<Result<RemoteItem[]>> {
  if (provider !== "n8n" && provider !== "make") return { ok: false, error: "Integração desconhecida." }
  return withCompany(async (companyId) =>
    strip(
      await tracked(companyId, provider, "list", async () => {
        const credentials = await requireCredentials(companyId, provider)
        return provider === "n8n"
          ? n8n.listWorkflows(credentials.baseUrl, credentials.apiKey)
          : make.listScenarios(credentials.zone, credentials.teamId, credentials.apiToken)
      }),
    ),
  )
}

/** Executa um workflow/cenário com um payload de teste. */
export async function runRemoteItem(provider: string, itemId: string): Promise<Result<{ status: number }>> {
  if (provider !== "n8n" && provider !== "make") return { ok: false, error: "Integração desconhecida." }
  return withCompany(async (companyId) =>
    strip(
      await tracked(companyId, provider, "run", async () => {
        const credentials = await requireCredentials(companyId, provider)
        const payload = { source: "lauxai", event: "teste", sentAt: new Date().toISOString() }
        return provider === "n8n"
          ? n8n.runWorkflow(credentials.baseUrl, credentials.apiKey, itemId, payload)
          : make.runScenario(credentials.zone, credentials.apiToken, itemId, payload)
      }),
    ),
  )
}

export async function listOpenAIModels(): Promise<Result<string[]>> {
  return withCompany(async (companyId) =>
    strip(await tracked(companyId, "openai", "list_models", async () => openai.listModels((await requireCredentials(companyId, "openai")).apiKey))),
  )
}

export async function saveOpenAIModel(model: string): Promise<Result> {
  if (!openai.isValidModelId(model)) return { ok: false, error: "Modelo inválido." }
  return withCompany(async (companyId) => {
    try {
      await updateConfig(companyId, "openai", { model })
    } catch {
      return { ok: false, error: "Não foi possível salvar o modelo." }
    }
    revalidatePath("/integracoes")
    return { ok: true, data: undefined }
  })
}

export async function testOpenAI(question: string): Promise<Result<{ text: string }>> {
  const prompt = question.trim().slice(0, 500)
  if (!prompt) return { ok: false, error: "Escreva uma pergunta de teste." }
  return withCompany(async (companyId) =>
    strip(
      await tracked(companyId, "openai", "test_generation", async () => {
        const credentials = await requireCredentials(companyId, "openai")
        if (!credentials.model) throw new Error("model_missing")
        return openai.generateText({
          apiKey: credentials.apiKey,
          model: credentials.model,
          instructions: "Você é um assistente de testes. Responda em português do Brasil, em até duas frases.",
          messages: [{ role: "user", content: prompt }],
          maxOutputTokens: 200,
        })
      }),
    ),
  )
}

export async function importCrmContacts(provider: string): Promise<Result<ImportSummary>> {
  if (!isProviderId(provider) || !crmProviderIds.includes(provider as ProviderId)) return { ok: false, error: "CRM desconhecido." }
  return withCompany(async (companyId) => {
    const result = strip(await importContactsFromCrm(companyId, provider))
    revalidatePath("/leads")
    return result
  })
}

async function guarded<T>(path: string, run: (companyId: string) => Promise<T>): Promise<Result<T>> {
  return withCompany(async (companyId) => {
    try {
      const data = await run(companyId)
      revalidatePath(path)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: toIntegrationError(error).message }
    }
  })
}

export async function createWebhookEndpoint(input: { name: string; url: string; events: string[] }): Promise<Result<{ signingSecret: string }>> {
  return guarded("/integracoes/webhooks", async (companyId) => {
    const { signingSecret } = await createEndpoint(companyId, input)
    return { signingSecret }
  })
}

export async function toggleWebhookEndpoint(id: string, active: boolean): Promise<Result> {
  return guarded("/integracoes/webhooks", async (companyId) => setEndpointActive(companyId, id, active))
}

export async function removeWebhookEndpoint(id: string): Promise<Result> {
  return guarded("/integracoes/webhooks", async (companyId) => deleteEndpoint(companyId, id))
}

export async function testWebhookEndpoint(id: string): Promise<Result<{ ok: boolean; httpStatus: number | null; error: string | null }>> {
  return guarded("/integracoes/webhooks", async (companyId) => {
    const outcome = await sendTestDelivery(companyId, id)
    return { ok: outcome.ok, httpStatus: outcome.httpStatus ?? null, error: outcome.error ?? null }
  })
}

export async function generateInboundUrl(): Promise<Result<{ token: string }>> {
  return guarded("/integracoes/webhooks", async (companyId) => ({ token: await rotateInboundToken(companyId) }))
}

export async function toggleInboundUrl(enabled: boolean): Promise<Result> {
  return guarded("/integracoes/webhooks", async (companyId) => setInboundEnabled(companyId, enabled))
}

export type WidgetInput = {
  enabled: boolean
  title: string
  welcomeMessage: string
  primaryColor: string
  position: "left" | "right"
  collectContact: boolean
  allowedOrigins: string
}

export async function saveWidgetSettings(input: WidgetInput): Promise<Result> {
  const title = input.title.trim()
  const welcomeMessage = input.welcomeMessage.trim()
  if (!title || title.length > 60) return { ok: false, error: "O título deve ter de 1 a 60 caracteres." }
  if (!welcomeMessage || welcomeMessage.length > 300) return { ok: false, error: "A mensagem de boas-vindas deve ter de 1 a 300 caracteres." }
  if (!/^#[0-9a-fA-F]{6}$/.test(input.primaryColor)) return { ok: false, error: "Use uma cor no formato #RRGGBB." }
  const origins: string[] = []
  for (const line of input.allowedOrigins.split(/[\s,]+/).filter(Boolean)) {
    const origin = normalizeOrigin(line)
    if (!origin) return { ok: false, error: `Origem inválida: ${line.slice(0, 80)}. Use https://seusite.com.br.` }
    if (!origins.includes(origin)) origins.push(origin)
  }
  if (origins.length > 10) return { ok: false, error: "Informe no máximo 10 origens." }
  return guarded("/integracoes/widget", async (companyId) => {
    await getOrCreateWidget(companyId)
    await saveWidget(companyId, {
      enabled: input.enabled,
      title,
      welcomeMessage,
      primaryColor: input.primaryColor,
      position: input.position,
      collectContact: input.collectContact,
      allowedOrigins: origins,
    })
  })
}
