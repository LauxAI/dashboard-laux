import "server-only"
import { IntegrationError, assertPublicHttpsUrl, requestJson } from "../http"

export type RemoteWorkflow = { id: string; name: string; active: boolean }

type WorkflowList = { data?: { id?: unknown; name?: unknown; active?: unknown }[] }
type WorkflowDetail = { id?: unknown; active?: unknown; nodes?: { type?: unknown; parameters?: { path?: unknown; httpMethod?: unknown } }[] }

/** Normaliza a URL base: remove barra final e um eventual /api/v1 colado pelo usuário. */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "").replace(/\/api\/v\d+$/i, "")
  return trimmed
}

const headers = (apiKey: string) => ({ "X-N8N-API-KEY": apiKey })

export async function verify(baseUrl: string, apiKey: string): Promise<{ accountLabel: string; config: Record<string, string> }> {
  const url = normalizeBaseUrl(baseUrl)
  const parsed = await assertPublicHttpsUrl(url)
  await requestJson(`${url}/api/v1/workflows?limit=1`, { headers: headers(apiKey), userSupplied: true })
  return { accountLabel: parsed.hostname, config: { baseUrl: url } }
}

export async function listWorkflows(baseUrl: string, apiKey: string): Promise<RemoteWorkflow[]> {
  const { data } = await requestJson<WorkflowList>(`${normalizeBaseUrl(baseUrl)}/api/v1/workflows?limit=100`, {
    headers: headers(apiKey),
    userSupplied: true,
  })
  if (!data || !Array.isArray(data.data)) throw new IntegrationError("bad_response")
  return data.data
    .filter((item) => typeof item.id === "string" || typeof item.id === "number")
    .map((item) => ({ id: String(item.id), name: typeof item.name === "string" ? item.name : String(item.id), active: item.active === true }))
}

const WORKFLOW_ID = /^[A-Za-z0-9_-]{1,64}$/
const WEBHOOK_PATH = /^[A-Za-z0-9._~\-/:]{1,200}$/

/**
 * A API pública do n8n não executa workflows diretamente. A execução acontece pelo
 * gatilho Webhook do próprio workflow (URL de produção), que exige o workflow ativo.
 */
export async function runWorkflow(baseUrl: string, apiKey: string, workflowId: string, payload: Record<string, unknown>): Promise<{ status: number; durationMs: number }> {
  if (!WORKFLOW_ID.test(workflowId)) throw new IntegrationError("not_found", "Workflow inválido.")
  const base = normalizeBaseUrl(baseUrl)
  const { data } = await requestJson<WorkflowDetail>(`${base}/api/v1/workflows/${encodeURIComponent(workflowId)}`, {
    headers: headers(apiKey),
    userSupplied: true,
  })
  if (!data) throw new IntegrationError("bad_response")
  if (data.active !== true) throw new IntegrationError("not_configured", "O workflow está inativo. Ative-o no n8n para poder executá-lo.")

  const node = (data.nodes ?? []).find((item) => item.type === "n8n-nodes-base.webhook")
  const path = typeof node?.parameters?.path === "string" ? node.parameters.path.replace(/^\/+/, "") : ""
  if (!node || !path || !WEBHOOK_PATH.test(path)) {
    throw new IntegrationError("not_supported", "Este workflow não tem um gatilho Webhook. Adicione um nó Webhook para executá-lo pela LAUXAI.")
  }
  const method = typeof node.parameters?.httpMethod === "string" ? node.parameters.httpMethod.toUpperCase() : "GET"
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new IntegrationError("not_supported")

  const target = `${base}/webhook/${path}`
  if (method === "GET") {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") query.set(key, String(value))
    }
    const result = await requestJson(`${target}?${query.toString()}`, { userSupplied: true, timeoutMs: 20_000 })
    return { status: result.status, durationMs: result.durationMs }
  }
  const result = await requestJson(target, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    userSupplied: true,
    timeoutMs: 20_000,
  })
  return { status: result.status, durationMs: result.durationMs }
}
