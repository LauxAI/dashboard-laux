import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isAIAgentType,
  normalizeAIAgentConfig,
  normalizeAIAgentStatus,
  specialistAgentType,
  validateAIAgentConfig,
} from "@/lib/domain/ai-agents"
import {
  normalizeSchedulingAgentConfig,
  normalizeSchedulingAgentStatus,
  validateSchedulingAgentConfig,
} from "@/lib/domain/scheduling-agent"
import type { AIAgentConfig, SchedulingAgentConfig, SpecialistKey, SpecialistsConfig } from "@/lib/domain/types"

/** Especialistas habilitados, ativos e com configuração válida: os únicos que o Atendimento pode usar. */
export type SpecialistContext = {
  scheduling?: SchedulingAgentConfig
  sales?: AIAgentConfig
  support?: AIAgentConfig
}

/**
 * - `ativo`: habilitado no Atendimento, ativo e configurado; o Atendimento o utiliza.
 * - `desativado`: não está habilitado na seção "Especialistas" do Atendimento.
 * - `inativo`: habilitado no Atendimento, mas o próprio especialista está inativo.
 * - `precisa_configurar`: habilitado, mas sem configuração salva ou com configuração inválida.
 */
export type SpecialistState = "ativo" | "desativado" | "inativo" | "precisa_configurar"

export type SpecialistStatus = { key: SpecialistKey; state: SpecialistState }

export type SpecialistRow = { status: unknown; config: unknown }
export type SpecialistRows = Partial<Record<SpecialistKey, SpecialistRow | null>>

export const specialistLabels: Record<SpecialistKey, string> = {
  scheduling: "Agendamento",
  sales: "Vendas",
  support: "Suporte",
}

export const specialistConfigHref: Record<SpecialistKey, string> = {
  scheduling: "/agentes/agendamento",
  sales: "/agentes/vendas",
  support: "/agentes/suporte",
}

export const specialistStateLabels: Record<SpecialistState, string> = {
  ativo: "Ativo",
  desativado: "Desativado",
  inativo: "Inativo",
  precisa_configurar: "Precisa configurar",
}

/**
 * Única regra de elegibilidade dos especialistas. A mesma avaliação alimenta o
 * contexto usado pelo Atendimento e o status exibido na interface, então a tela
 * nunca diverge do que o runtime realmente usa.
 */
export function evaluateSpecialists(
  enabled: SpecialistsConfig,
  rows: SpecialistRows,
): { statuses: SpecialistStatus[]; context: SpecialistContext } {
  const context: SpecialistContext = {}
  const statuses: SpecialistStatus[] = []

  for (const key of ["scheduling", "sales", "support"] as const) {
    if (!enabled[key]) {
      statuses.push({ key, state: "desativado" })
      continue
    }
    const row = rows[key]
    if (!row) {
      statuses.push({ key, state: "precisa_configurar" })
      continue
    }

    if (key === "scheduling") {
      const config = normalizeSchedulingAgentConfig(row.config)
      if (validateSchedulingAgentConfig(config) !== null) statuses.push({ key, state: "precisa_configurar" })
      else if (normalizeSchedulingAgentStatus(row.status) !== "ativo") statuses.push({ key, state: "inativo" })
      else {
        context.scheduling = config
        statuses.push({ key, state: "ativo" })
      }
      continue
    }

    const type = specialistAgentType[key]
    const config = normalizeAIAgentConfig(type, row.config)
    if (validateAIAgentConfig(type, config) !== null) statuses.push({ key, state: "precisa_configurar" })
    else if (normalizeAIAgentStatus(row.status) !== "ativo") statuses.push({ key, state: "inativo" })
    else {
      context[key] = config
      statuses.push({ key, state: "ativo" })
    }
  }

  return { statuses, context }
}

/**
 * Lê a configuração persistida dos especialistas da empresa. O `companyId` é
 * sempre resolvido no servidor (sessão ou conversa), nunca vem do cliente nem do modelo.
 */
export async function loadSpecialistRows(db: SupabaseClient, companyId: string): Promise<SpecialistRows> {
  const [agents, scheduling] = await Promise.all([
    db
      .from("ai_agent_settings")
      .select("agent_type, status, config")
      .eq("company_id", companyId)
      .in("agent_type", [specialistAgentType.sales, specialistAgentType.support])
      .returns<{ agent_type: string; status: unknown; config: unknown }[]>(),
    db
      .from("scheduling_agent_settings")
      .select("status, config")
      .eq("company_id", companyId)
      .maybeSingle<SpecialistRow>(),
  ])
  if (agents.error) throw new Error("specialists_load_failed")
  if (scheduling.error) throw new Error("specialists_load_failed")

  const rows: SpecialistRows = { scheduling: scheduling.data ?? null }
  for (const row of agents.data ?? []) {
    if (!isAIAgentType(row.agent_type)) continue
    if (row.agent_type === "vendas") rows.sales = row
    if (row.agent_type === "suporte") rows.support = row
  }
  return rows
}

/** Carrega e avalia os especialistas habilitados no Atendimento a partir da fonte persistida. */
export async function loadSpecialistState(db: SupabaseClient, companyId: string, enabled: SpecialistsConfig) {
  return evaluateSpecialists(enabled, await loadSpecialistRows(db, companyId))
}
