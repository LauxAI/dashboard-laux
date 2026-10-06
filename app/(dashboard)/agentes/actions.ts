"use server"

import { revalidatePath } from "next/cache"
import {
  isAIAgentType,
  normalizeAIAgentConfig,
  normalizeAIAgentStatus,
  validateAIAgentConfig,
} from "@/lib/domain/ai-agents"
import type { AIAgentConfig, AIAgentStatus, AIAgentType } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

type ActionResult = { error: string } | { success: true }

type Supabase = Awaited<ReturnType<typeof createClient>>
type Context = { error: string } | { error?: undefined; supabase: Supabase; userId: string; companyId: string }

/** O company_id vem sempre da sessão (RPC), nunca do cliente. */
async function getContext(): Promise<Context> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sessão expirada. Entre novamente." }

  const { data: companyId, error } = await supabase.rpc("current_client_company_id")
  if (error || !companyId) return { error: "Sua conta não está vinculada a uma empresa ativa." }

  return { supabase, userId: user.id, companyId: companyId as string }
}

function revalidateAgentPages(type: AIAgentType) {
  revalidatePath("/agentes")
  revalidatePath(`/agentes/${type}`)
}

export async function saveAIAgentConfig(type: AIAgentType, input: AIAgentConfig): Promise<ActionResult> {
  if (!isAIAgentType(type)) return { error: "Agente inválido." }
  const config = normalizeAIAgentConfig(type, input)
  const invalid = validateAIAgentConfig(type, config)
  if (invalid) return { error: invalid }

  const context = await getContext()
  if (context.error !== undefined) return { error: context.error }

  const { error } = await context.supabase
    .from("ai_agent_settings")
    .upsert(
      { company_id: context.companyId, agent_type: type, config, updated_by: context.userId },
      { onConflict: "company_id,agent_type" },
    )
  if (error) return { error: "Não foi possível salvar as configurações. Tente novamente." }

  revalidateAgentPages(type)
  return { success: true }
}

export async function setAIAgentStatus(type: AIAgentType, input: AIAgentStatus): Promise<ActionResult> {
  if (!isAIAgentType(type)) return { error: "Agente inválido." }
  const status = normalizeAIAgentStatus(input)

  const context = await getContext()
  if (context.error !== undefined) return { error: context.error }

  if (status === "ativo") {
    const { data } = await context.supabase
      .from("ai_agent_settings")
      .select("config")
      .eq("company_id", context.companyId)
      .eq("agent_type", type)
      .maybeSingle()
    if (!data || validateAIAgentConfig(type, normalizeAIAgentConfig(type, data.config))) {
      return { error: "Salve as configurações do agente antes de ativá-lo." }
    }
  }

  const { error } = await context.supabase
    .from("ai_agent_settings")
    .upsert(
      { company_id: context.companyId, agent_type: type, status, updated_by: context.userId },
      { onConflict: "company_id,agent_type" },
    )
  if (error) return { error: "Não foi possível alterar o status do agente. Tente novamente." }

  revalidateAgentPages(type)
  return { success: true }
}
