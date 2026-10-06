import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getAccountAccess } from "@/lib/supabase/account-access"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createSessionClient } from "@/lib/supabase/server"

/**
 * Acesso à tabela whatsapp_connections. Somente servidor, sempre com a service role
 * (a tabela não tem privilégios para anon/authenticated).
 *
 * O access_token nunca é selecionado aqui: nenhuma função deste módulo devolve o
 * token. O company_id das funções "*ForCompany" deve vir de fonte confiável do
 * servidor; para fluxos com usuário logado use as variantes "*ForCurrentCompany",
 * que derivam a empresa da sessão via current_client_company_id().
 */

export const WHATSAPP_CONNECTION_STATUSES = ["active", "inactive", "disconnected"] as const
export type WhatsAppConnectionStatus = (typeof WHATSAPP_CONNECTION_STATUSES)[number]

export type WhatsAppConnection = {
  id: string
  company_id: string
  phone_number_id: string
  waba_id: string | null
  display_phone_number: string | null
  business_name: string | null
  status: WhatsAppConnectionStatus
  token_expires_at: string | null
  connected_at: string
  updated_at: string
}

export type WhatsAppConnectionInput = {
  phoneNumberId: string
  wabaId?: string | null
  displayPhoneNumber?: string | null
  businessName?: string | null
  status?: WhatsAppConnectionStatus
  /** Omitido = mantém o token atual. null = remove. */
  accessToken?: string | null
  tokenExpiresAt?: Date | null
}

export class WhatsAppConnectionError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "phone_number_owned_by_other_company"
      | "no_company_in_session"
      | "database_error",
  ) {
    super(code)
    this.name = "WhatsAppConnectionError"
  }
}

const SAFE_COLUMNS =
  "id, company_id, phone_number_id, waba_id, display_phone_number, business_name, status, token_expires_at, connected_at, updated_at"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= 256 ? trimmed : null
}

function optionalText(value: string | null | undefined, max: number): string | null | undefined {
  if (value === undefined || value === null) return value
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > max) throw new WhatsAppConnectionError("invalid_input")
  return trimmed
}

/** Valida e converte a entrada para a linha do banco. Exportada para testes. */
export function buildConnectionRow(companyId: string, input: WhatsAppConnectionInput): Record<string, unknown> {
  if (!isUuid(companyId)) throw new WhatsAppConnectionError("invalid_input")
  const phoneNumberId = normalizeId(input.phoneNumberId)
  if (!phoneNumberId) throw new WhatsAppConnectionError("invalid_input")

  const row: Record<string, unknown> = { company_id: companyId, phone_number_id: phoneNumberId }

  if (input.wabaId !== undefined) {
    const wabaId = input.wabaId === null ? null : normalizeId(input.wabaId)
    if (input.wabaId !== null && wabaId === null) throw new WhatsAppConnectionError("invalid_input")
    row.waba_id = wabaId
  }
  const display = optionalText(input.displayPhoneNumber, 32)
  if (display !== undefined) row.display_phone_number = display
  const businessName = optionalText(input.businessName, 256)
  if (businessName !== undefined) row.business_name = businessName

  if (input.status !== undefined) {
    if (!WHATSAPP_CONNECTION_STATUSES.includes(input.status)) throw new WhatsAppConnectionError("invalid_input")
    row.status = input.status
  }
  if (input.accessToken !== undefined) {
    if (input.accessToken !== null && (input.accessToken.length === 0 || input.accessToken.length > 4096)) {
      throw new WhatsAppConnectionError("invalid_input")
    }
    row.access_token = input.accessToken
  }
  if (input.tokenExpiresAt !== undefined) {
    if (input.tokenExpiresAt !== null && Number.isNaN(input.tokenExpiresAt.getTime())) {
      throw new WhatsAppConnectionError("invalid_input")
    }
    row.token_expires_at = input.tokenExpiresAt?.toISOString() ?? null
  }
  return row
}

/** Busca a conexão (qualquer status) pelo phone_number_id. */
export async function findConnectionByPhoneNumberId(
  phoneNumberId: string,
  db: SupabaseClient = createAdminClient(),
): Promise<WhatsAppConnection | null> {
  const id = normalizeId(phoneNumberId)
  if (!id) return null

  const { data, error } = await db
    .from("whatsapp_connections")
    .select(SAFE_COLUMNS)
    .eq("phone_number_id", id)
    .maybeSingle<WhatsAppConnection>()
  if (error) throw new WhatsAppConnectionError("database_error")
  return data
}

export async function listConnectionsForCompany(
  companyId: string,
  db: SupabaseClient = createAdminClient(),
): Promise<WhatsAppConnection[]> {
  if (!isUuid(companyId)) throw new WhatsAppConnectionError("invalid_input")

  const { data, error } = await db
    .from("whatsapp_connections")
    .select(SAFE_COLUMNS)
    .eq("company_id", companyId)
    .order("connected_at", { ascending: true })
    .returns<WhatsAppConnection[]>()
  if (error) throw new WhatsAppConnectionError("database_error")
  return data ?? []
}

/**
 * Cria ou atualiza a conexão pelo phone_number_id. Se o número já pertence a outra
 * empresa, o trigger do banco rejeita e lançamos phone_number_owned_by_other_company.
 */
export async function upsertConnectionForCompany(
  companyId: string,
  input: WhatsAppConnectionInput,
  db: SupabaseClient = createAdminClient(),
): Promise<WhatsAppConnection> {
  const row = buildConnectionRow(companyId, input)

  const { data, error } = await db
    .from("whatsapp_connections")
    .upsert(row, { onConflict: "phone_number_id" })
    .select(SAFE_COLUMNS)
    .single<WhatsAppConnection>()

  if (error) {
    if (error.message?.includes("whatsapp_connection_company_immutable")) {
      throw new WhatsAppConnectionError("phone_number_owned_by_other_company")
    }
    if (error.code === "23514") throw new WhatsAppConnectionError("invalid_input")
    throw new WhatsAppConnectionError("database_error")
  }
  return data
}

/**
 * Marca a conexão como desconectada e apaga o token. Só afeta a conexão se ela for
 * da empresa informada. Retorna false quando não encontrou.
 */
export async function disconnectConnectionForCompany(
  companyId: string,
  connectionId: string,
  db: SupabaseClient = createAdminClient(),
): Promise<boolean> {
  if (!isUuid(companyId) || !isUuid(connectionId)) throw new WhatsAppConnectionError("invalid_input")

  const { data, error } = await db
    .from("whatsapp_connections")
    .update({ status: "disconnected", access_token: null, token_expires_at: null })
    .eq("id", connectionId)
    .eq("company_id", companyId)
    .select("id")
  if (error) throw new WhatsAppConnectionError("database_error")
  return (data?.length ?? 0) > 0
}

/** Empresa do usuário logado (conta de cliente ativa), derivada no servidor. */
export async function getSessionCompanyId(): Promise<string> {
  const access = await getAccountAccess(await createSessionClient())
  if (access.status !== "active") throw new WhatsAppConnectionError("no_company_in_session")
  return access.companyId
}

export async function listConnectionsForCurrentCompany(): Promise<WhatsAppConnection[]> {
  return listConnectionsForCompany(await getSessionCompanyId())
}

export async function upsertConnectionForCurrentCompany(input: WhatsAppConnectionInput): Promise<WhatsAppConnection> {
  return upsertConnectionForCompany(await getSessionCompanyId(), input)
}

export async function disconnectConnectionForCurrentCompany(connectionId: string): Promise<boolean> {
  return disconnectConnectionForCompany(await getSessionCompanyId(), connectionId)
}
