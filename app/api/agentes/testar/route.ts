import { NextResponse } from "next/server"
import { streamAgent, type AgentStream } from "@/lib/ai/agent-runner"
import { GeminiNotConfiguredError } from "@/lib/ai/gemini"
import { parseTestRequest } from "@/lib/ai/request"
import { prepareSpecialists } from "@/lib/ai/specialist-tools"
import { encodeStreamEvent, STREAM_CONTENT_TYPE, type AgentStreamEvent } from "@/lib/ai/stream-events"
import { readUsage, recordUsage } from "@/lib/ai/usage"
import { normalizeAIAgentConfig, validateAIAgentConfig } from "@/lib/domain/ai-agents"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

/**
 * Teste integrado: o Atendimento conversa e aciona os especialistas habilitados,
 * exatamente como no WhatsApp (mesmo prompt, mesmo runner, mesma preparação de
 * especialistas). A única diferença é `dryRun: true`, fixo no servidor: consultas
 * são reais, mas nenhuma ação altera a agenda.
 */
export async function POST(request: Request) {
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

  // O teste usa a configuração salva e aceita o Atendimento inativo, desde que a configuração seja válida.
  const { data: settings } = await supabase
    .from("ai_agent_settings")
    .select("config")
    .eq("company_id", companyId)
    .eq("agent_type", "atendimento")
    .maybeSingle()
  if (!settings) return fail(409, "Salve a configuração do Atendimento antes de testar.")
  const config = normalizeAIAgentConfig("atendimento", settings.config)
  if (validateAIAgentConfig("atendimento", config)) {
    return fail(409, "A configuração do Atendimento está incompleta. Complete e salve para testar.")
  }

  // Limites apenas monitoram: o excesso é registrado, mas não bloqueia a chamada.
  const usage = await readUsage(supabase, user.id)
  if (usage.userExceeded || usage.companyExceeded) {
    console.warn("[ai-agent] limite de monitoramento excedido", {
      agentType: "atendimento",
      userExceeded: usage.userExceeded,
      companyExceeded: usage.companyExceeded,
      userCalls: usage.userCalls,
      companyCalls: usage.companyCalls,
    })
  }

  const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle()

  let emit: (event: AgentStreamEvent) => void = () => {}
  const prepared = await prepareSpecialists(
    {
      db: supabase,
      companyId,
      contactPhone: null,
      dryRun: true,
      onCall: (call) => emit({ type: "specialist", ...call }),
    },
    config.specialists,
    (error) => console.error("[ai-agent] falha ao carregar especialistas:", error instanceof Error ? error.name : "erro desconhecido"),
  )

  const startedAt = Date.now()
  let agentStream: AgentStream
  try {
    agentStream = streamAgent({
      type: "atendimento",
      config,
      companyName: company?.name ?? null,
      messages: parsed.messages,
      specialists: prepared.specialists,
      tools: prepared.tools,
      abortSignal: request.signal,
    })
  } catch (error) {
    console.error("[ai-agent] falha ao iniciar resposta:", error instanceof Error ? error.name : "erro desconhecido")
    await recordUsage(supabase, {
      companyId,
      userId: user.id,
      agentType: "atendimento",
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
      emit = (event) => {
        try {
          send(event)
        } catch {}
      }
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
        await recordUsage(supabase, { companyId, userId: user.id, agentType: "atendimento", status: "error", latencyMs })
        emit({ type: "error", error: "Não foi possível gerar a resposta agora. Tente novamente." })
      } else {
        const tokens = await agentStream.usage()
        await recordUsage(supabase, {
          companyId,
          userId: user.id,
          agentType: "atendimento",
          status: "success",
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          latencyMs,
        })
        emit({ type: "done", usage: { userExceeded: usage.userExceeded, companyExceeded: usage.companyExceeded } })
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
