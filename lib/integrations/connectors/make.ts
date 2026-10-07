import "server-only"
import { IntegrationError, requestJson } from "../http"

export type RemoteScenario = { id: string; name: string; active: boolean }

export const MAKE_ZONES = ["eu1", "eu2", "us1", "us2"] as const

type ScenarioList = { scenarios?: { id?: unknown; name?: unknown; isActive?: unknown }[] }

const base = (zone: string) => `https://${zone}.make.com/api/v2`
const headers = (token: string) => ({ Authorization: `Token ${token}` })

export function validateTarget(zone: string, teamId: string): void {
  if (!(MAKE_ZONES as readonly string[]).includes(zone)) throw new IntegrationError("not_configured", "Zona do Make inválida.")
  if (!/^\d{1,12}$/.test(teamId)) throw new IntegrationError("not_configured", "O ID da equipe deve ser numérico.")
}

export async function listScenarios(zone: string, teamId: string, token: string, limit = 100): Promise<RemoteScenario[]> {
  validateTarget(zone, teamId)
  const { data } = await requestJson<ScenarioList>(`${base(zone)}/scenarios?teamId=${teamId}&pg%5Blimit%5D=${limit}`, { headers: headers(token) })
  if (!data || !Array.isArray(data.scenarios)) throw new IntegrationError("bad_response")
  return data.scenarios
    .filter((item) => typeof item.id === "number" || typeof item.id === "string")
    .map((item) => ({ id: String(item.id), name: typeof item.name === "string" ? item.name : String(item.id), active: item.isActive === true }))
}

export async function verify(zone: string, teamId: string, token: string): Promise<{ accountLabel: string; config: Record<string, string> }> {
  await listScenarios(zone, teamId, token, 1)
  return { accountLabel: `Equipe ${teamId} (${zone})`, config: { zone, teamId } }
}

export async function runScenario(zone: string, token: string, scenarioId: string, payload: Record<string, unknown>): Promise<{ status: number; durationMs: number }> {
  if (!(MAKE_ZONES as readonly string[]).includes(zone)) throw new IntegrationError("not_configured")
  if (!/^\d{1,12}$/.test(scenarioId)) throw new IntegrationError("not_found", "Cenário inválido.")
  const result = await requestJson(`${base(zone)}/scenarios/${scenarioId}/run`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ data: payload, responsive: false }),
    timeoutMs: 25_000,
  })
  return { status: result.status, durationMs: result.durationMs }
}
