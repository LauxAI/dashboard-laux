import { NextResponse } from "next/server"
import { streamAgent, type AgentStream } from "@/lib/ai/agent-runner"
import {
  agentErrorMessages,
  classifyAgentError,
  type AgentErrorCode,
  type AgentErrorStage,
} from "@/lib/ai/errors"
import { logAgent } from "@/lib/ai/log"
import { parseTestRequest } from "@/lib/ai/request"
import { prepareSpecialists } from "@/lib/ai/specialist-tools"
import { encodeStreamEvent, STREAM_CONTENT_TYPE, type AgentStreamEvent } from "@/lib/ai/stream-events"
import { readUsage, recordUsage } from "@/lib/ai/usage"
import { normalizeAIAgentConfig, validateAIAgentConfig } from "@/lib/domain/ai-agents"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

/** Detalhe técnico (já sem segredos) só aparece fora de produção, para depuração. */
const showDetail = process.env.NODE_ENV !== "production"

type Failure = { stage: AgentErrorStage; code: string; message: string; retryable?: boolean; detail?: string }

const fail = (status: number, failure: Failure) => {
  logAgent(status >= 500 ? "error" : "warn", "falha na requisição de teste", {
    stage: failure.stage,
    code: failure.code,
    status,
    detail: failure.detail,
  })
  return NextResponse.json(
    {
      error: failure.message,
      code: failure.code,
      stage: failure.stage,
      retryable: failure.retryable ?? false,
      ...(showDetail && failure.detail ? { detail: failure.detail } : {}),
    },
    { status },
  )
}

const generationFailure = (error: unknown): Failure & { errorCode: AgentErrorCode } => {
  const info = classifyAgentError(error)
  return {
    stage: "generation",
    code: info.code,
    errorCode: info.code,
    message: agentErrorMessages[info.code],
    retryable: info.retryable,
    detail: info.detail,
  }
}

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
  if (!user) return fail(401, { stage: "auth", code: "session_expired", message: "Sessão expirada. Entre novamente." })

  // O company_id nunca vem da requisição: é resolvido pela sessão.
  const { data: companyId, error: companyError } = await supabase.rpc("current_client_company_id")
  if (companyError || !companyId) {
    return fail(403, {
      stage: "company",
      code: "company_not_found",
      message: "Sua conta não está vinculada a uma empresa ativa.",
      detail: companyError?.message,
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail(400, { stage: "request", code: "invalid_request", message: "Requisição inválida." })
  }
  const parsed = parseTestRequest(body)
  if ("error" in parsed) return fail(400, { stage: "request", code: "invalid_request", message: parsed.error })

  // O teste usa a configuração salva e aceita o Atendimento inativo, desde que a configuração seja válida.
  const { data: settings } = await supabase
    .from("ai_agent_settings")
    .select("config")
    .eq("company_id", companyId)
    .eq("agent_type", "atendimento")
    .maybeSingle()
  if (!settings) {
    return fail(409, {
      stage: "agent_config",
      code: "agent_not_configured",
      message: "Salve a configuração do Atendimento antes de testar.",
    })
  }
  const config = normalizeAIAgentConfig("atendimento", settings.config)
  if (validateAIAgentConfig("atendimento", config)) {
    return fail(409, {
      stage: "agent_config",
      code: "agent_incomplete",
      message: "A configuração do Atendimento está incompleta. Complete e salve para testar.",
    })
  }

  // Limites apenas monitoram: o excesso é registrado, mas não bloqueia a chamada.
  const usage = await readUsage(supabase, user.id)
  if (usage.userExceeded || usage.companyExceeded) {
    logAgent("warn", "limite de monitoramento excedido", {
      agentType: "atendimento",
      userExceeded: usage.userExceeded,
      companyExceeded: usage.companyExceeded,
      userCalls: usage.userCalls,
      companyCalls: usage.companyCalls,
    })
  }

  const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle()

  const logContext = { companyId, agentType: "atendimento", mode: "teste" }
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
    (error) =>
      logAgent("error", "falha ao carregar especialistas", {
        ...logContext,
        stage: "specialists",
        code: "specialists_load_failed",
        detail: error instanceof Error ? error.message : "erro desconhecido",
      }),
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
      sideEffectTools: prepared.sideEffectTools,
      abortSignal: request.signal,
      logContext,
    })
  } catch (error) {
    const failure = generationFailure(error)
    await recordUsage(supabase, {
      companyId,
      userId: user.id,
      agentType: "atendimento",
      status: "error",
      latencyMs: Date.now() - startedAt,
    })
    return fail(502, failure)
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
        if (!failure && !hasText) failure = new Error("empty_model_response")
      } catch (error) {
        failure = error
      }

      const latencyMs = Date.now() - startedAt
      if (failure) {
        const info = generationFailure(failure)
        logAgent("error", "falha ao gerar resposta", {
          ...logContext,
          stage: info.stage,
          code: info.code,
          model: agentStream.model(),
          attempts: agentStream.attempts().length,
          latencyMs,
          detail: info.detail,
        })
        await recordUsage(supabase, { companyId, userId: user.id, agentType: "atendimento", status: "error", latencyMs })
        emit({
          type: "error",
          error: info.message,
          code: info.code,
          stage: info.stage,
          retryable: info.retryable,
          ...(showDetail && info.detail ? { detail: info.detail } : {}),
        })
      } else {
        const tokens = await agentStream.usage()
        const attempts = agentStream.attempts().length
        logAgent("info", "resposta gerada", {
          ...logContext,
          model: agentStream.model(),
          fallbacks: attempts,
          latencyMs,
        })
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
