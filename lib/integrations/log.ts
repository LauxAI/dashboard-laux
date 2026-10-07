import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

export type IntegrationLogEntry = {
  companyId: string
  provider: string
  operation: string
  ok: boolean
  httpStatus?: number
  durationMs?: number
  errorCode?: string
  message?: string
}

/**
 * Registra uma chamada a um serviço externo. Guarda apenas metadados (provedor,
 * operação, status, duração, código de erro): nunca tokens, cabeçalhos, corpo de
 * requisição/resposta nem dados de clientes. Nunca lança.
 */
export async function logIntegration(entry: IntegrationLogEntry, db?: SupabaseClient): Promise<void> {
  const record = {
    level: entry.ok ? "info" : "warn",
    event: "integration_call",
    provider: entry.provider,
    operation: entry.operation,
    ok: entry.ok,
    http_status: entry.httpStatus,
    duration_ms: entry.durationMs,
    error_code: entry.errorCode,
  }
  console.log(JSON.stringify(record))
  try {
    const client = db ?? createAdminClient()
    await client.from("integration_logs").insert({
      company_id: entry.companyId,
      provider: entry.provider,
      operation: entry.operation,
      status: entry.ok ? "success" : "failed",
      http_status: entry.httpStatus ?? null,
      duration_ms: entry.durationMs ?? null,
      error_code: entry.errorCode ?? null,
      message: entry.message ? entry.message.slice(0, 300) : null,
    })
  } catch {
    // Falha ao gravar o log não pode quebrar a operação que o originou.
  }
}
