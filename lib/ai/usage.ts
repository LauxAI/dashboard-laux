import type { SupabaseClient } from "@supabase/supabase-js"
import type { AIAgentType } from "@/lib/domain/types"

/**
 * Limites de monitoramento. Nesta versão NÃO bloqueiam o agente: o excesso é
 * apenas detectado, registrado em log e informado na resposta.
 */
export const USAGE_LIMITS = {
  perUser: { calls: 20, windowMs: 10 * 60 * 1000 },
  perCompany: { calls: 300, windowMs: 24 * 60 * 60 * 1000 },
} as const

export type UsageSnapshot = {
  userCalls: number
  companyCalls: number
  userExceeded: boolean
  companyExceeded: boolean
}

/** `previousCalls` são as chamadas já registradas; a atual é a próxima. */
export function evaluateUsage(userCalls: number, companyCalls: number): UsageSnapshot {
  return {
    userCalls,
    companyCalls,
    userExceeded: userCalls + 1 > USAGE_LIMITS.perUser.calls,
    companyExceeded: companyCalls + 1 > USAGE_LIMITS.perCompany.calls,
  }
}

async function countSince(
  supabase: SupabaseClient,
  windowMs: number,
  filter?: { column: "user_id"; value: string },
  now = Date.now(),
): Promise<number> {
  let query = supabase
    .from("ai_agent_usage")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(now - windowMs).toISOString())
  if (filter) query = query.eq(filter.column, filter.value)
  const { count } = await query
  return count ?? 0
}

/** O isolamento por empresa vem da RLS: a contagem só enxerga a empresa da sessão. */
export async function readUsage(supabase: SupabaseClient, userId: string): Promise<UsageSnapshot> {
  const [userCalls, companyCalls] = await Promise.all([
    countSince(supabase, USAGE_LIMITS.perUser.windowMs, { column: "user_id", value: userId }),
    countSince(supabase, USAGE_LIMITS.perCompany.windowMs),
  ])
  return evaluateUsage(userCalls, companyCalls)
}

export async function recordUsage(
  supabase: SupabaseClient,
  entry: {
    companyId: string
    userId: string
    agentType: AIAgentType
    status: "success" | "error"
    inputTokens?: number
    outputTokens?: number
    latencyMs?: number
  },
): Promise<void> {
  const { error } = await supabase.from("ai_agent_usage").insert({
    company_id: entry.companyId,
    user_id: entry.userId,
    agent_type: entry.agentType,
    source: "playground",
    status: entry.status,
    input_tokens: entry.inputTokens ?? null,
    output_tokens: entry.outputTokens ?? null,
    latency_ms: entry.latencyMs ?? null,
  })
  if (error) console.error("[ai-agent] falha ao registrar uso:", error.code)
}
