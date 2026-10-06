import { NextResponse } from "next/server"
import { streamAgent, type AgentStream } from "@/lib/ai/agent-runner"
import { GeminiNotConfiguredError } from "@/lib/ai/gemini"
import { parseTestRequest } from "@/lib/ai/request"
import { encodeStreamEvent, STREAM_CONTENT_TYPE, type AgentStreamEvent } from "@/lib/ai/stream-events"
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
  let agentStream: AgentStream
  try {
    agentStream = streamAgent({
      type: agente,
      config,
      companyName: company?.name ?? null,
      messages: parsed.messages,
      abortSignal: request.signal,
    })
  } catch (error) {
    console.error("[ai-agent] falha ao iniciar resposta:", error instanceof Error ? error.name : "erro desconhecido")
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

  const encoder = new TextEncoder()
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentStreamEvent) => controller.enqueue(encoder.encode(encodeStreamEvent(event)))
      let hasText = false
      let failure: unknown

      try {
        for await (const text of agentStream.textStream) {
          if (!text) continue
          // O conteúdo nunca é guardado: só se registra se houve texto.
          if (text.trim()) hasText = true
          send({ type: "delta", text })
        }
        failure = agentStream.getError()
        if (!failure && !hasText) failure = new Error("Resposta vazia do modelo.")
      } catch (error) {
        failure = error
      }

      const latencyMs = Date.now() - startedAt
      if (failure) {
        // Nunca registra a chave nem o conteúdo das mensagens.
        console.error("[ai-agent] falha ao gerar resposta:", failure instanceof Error ? failure.name : "erro desconhecido")
        await recordUsage(supabase, { companyId, userId: user.id, agentType: agente, status: "error", latencyMs })
        try {
          send({ type: "error", error: "Não foi possível gerar a resposta agora. Tente novamente." })
        } catch {}
      } else {
        const tokens = await agentStream.usage()
        await recordUsage(supabase, {
          companyId,
          userId: user.id,
          agentType: agente,
          status: "success",
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          latencyMs,
        })
        try {
          send({ type: "done", usage: { userExceeded: usage.userExceeded, companyExceeded: usage.companyExceeded } })
        } catch {}
      }
      try {
        controller.close()
      } catch {}
    },
  })

  return new Response(responseStream, {
    headers: {
      "Content-Type": STREAM_CONTENT_TYPE,
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
