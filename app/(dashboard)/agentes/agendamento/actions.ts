"use server"

import { revalidatePath } from "next/cache"
import {
  normalizeSchedulingAgentConfig,
  normalizeSchedulingAgentStatus,
  validateSchedulingAgentConfig,
} from "@/lib/domain/scheduling-agent"
import type { SchedulingAgentConfig, SchedulingAgentStatus } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

type ActionResult = { error: string } | { success: true }

type Supabase = Awaited<ReturnType<typeof createClient>>
type Context = { error: string } | { error?: undefined; supabase: Supabase; userId: string; companyId: string }

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

function revalidateAgentPages() {
  revalidatePath("/agentes")
  revalidatePath("/agentes/agendamento")
}

export async function saveSchedulingAgentConfig(input: SchedulingAgentConfig): Promise<ActionResult> {
  const config = normalizeSchedulingAgentConfig(input)
  const invalid = validateSchedulingAgentConfig(config)
  if (invalid) return { error: invalid }

  const context = await getContext()
  if (context.error !== undefined) return { error: context.error }

  const { error } = await context.supabase
    .from("scheduling_agent_settings")
    .upsert({ company_id: context.companyId, config, updated_by: context.userId }, { onConflict: "company_id" })
  if (error) return { error: "Não foi possível salvar as configurações. Tente novamente." }

  revalidateAgentPages()
  return { success: true }
}

export async function setSchedulingAgentStatus(input: SchedulingAgentStatus): Promise<ActionResult> {
  const status = normalizeSchedulingAgentStatus(input)

  const context = await getContext()
  if (context.error !== undefined) return { error: context.error }

  if (status === "ativo") {
    const { data } = await context.supabase
      .from("scheduling_agent_settings")
      .select("config")
      .eq("company_id", context.companyId)
      .maybeSingle()
    if (!data || validateSchedulingAgentConfig(normalizeSchedulingAgentConfig(data.config))) {
      return { error: "Salve as configurações do agente antes de ativá-lo." }
    }
  }

  const { error } = await context.supabase
    .from("scheduling_agent_settings")
    .upsert({ company_id: context.companyId, status, updated_by: context.userId }, { onConflict: "company_id" })
  if (error) return { error: "Não foi possível alterar o status do agente. Tente novamente." }

  revalidateAgentPages()
  return { success: true }
}
