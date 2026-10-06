import { NextResponse } from "next/server"
import { runAgent } from "@/lib/ai/agent-runner"
import { GeminiNotConfiguredError } from "@/lib/ai/gemini"
import { parseTestRequest } from "@/lib/ai/request"
import { readUsage, recordUsage } from "@/lib/ai/usage"
import { isAIAgentType, normalizeAIAgentConfig, validateAIAgentConfig } from "@/lib/domain/ai-agents"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

export async function POST(request: Request, { params }: { params: Promise<{ agente: string }> }) {
  const { agente } = await params
  if (!isAIAgentType(agente)) return fail(404, "Agente não encontrado.")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail(401, "Sessão expirada. Entre novamente.")

  // O company_id nunca vem da requisição: é resolvido pela sessão.
  const { data: companyId, error: companyError } = await supabase.rpc("current_client_company_id")
  if (companyError || !companyId) return fail(403, "Sua conta não está vinculada a uma empresa ativa.")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail(400, "Requisição inválida.")
  }
  const parsed = parseTestRequest(body)
  if ("error" in parsed) return fail(400, parsed.error)

  // O teste usa a configuração salva e aceita agente inativo, desde que a configuração seja válida.
  const { data: settings } = await supabase
    .from("ai_agent_settings")
    .select("config")
    .eq("company_id", companyId)
    .eq("agent_type", agente)
    .maybeSingle()
  if (!settings) return fail(409, "Salve a configuração do agente antes de testá-lo.")
  const config = normalizeAIAgentConfig(agente, settings.config)
  if (validateAIAgentConfig(agente, config)) {
    return fail(409, "A configuração salva está incompleta. Complete e salve para testar.")
  }

  // Limites apenas monitoram: o excesso é registrado, mas não bloqueia a chamada.
  const usage = await readUsage(supabase, user.id)
  if (usage.userExceeded || usage.companyExceeded) {
    console.warn("[ai-agent] limite de monitoramento excedido", {
      agentType: agente,
      userExceeded: usage.userExceeded,
      companyExceeded: usage.companyExceeded,
      userCalls: usage.userCalls,
      companyCalls: usage.companyCalls,
    })
  }

  const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle()

  const startedAt = Date.now()
  try {
    const result = await runAgent({
      type: agente,
      config,
      companyName: company?.name ?? null,
      messages: parsed.messages,
    })
    await recordUsage(supabase, {
      companyId,
      userId: user.id,
      agentType: agente,
      status: "success",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: Date.now() - startedAt,
    })
    return NextResponse.json({
      reply: result.reply,
      usage: { userExceeded: usage.userExceeded, companyExceeded: usage.companyExceeded },
    })
  } catch (error) {
    // Nunca registra a chave nem o conteúdo das mensagens.
    console.error("[ai-agent] falha ao gerar resposta:", error instanceof Error ? error.name : "erro desconhecido")
    await recordUsage(supabase, {
      companyId,
      userId: user.id,
      agentType: agente,
      status: "error",
      latencyMs: Date.now() - startedAt,
    })
    if (error instanceof GeminiNotConfiguredError) return fail(502, "O serviço de IA não está configurado.")
    return fail(502, "Não foi possível gerar a resposta agora. Tente novamente.")
  }
}
