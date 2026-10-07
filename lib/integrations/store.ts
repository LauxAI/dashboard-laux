import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptJson, encryptJson, secretHint } from "./crypto"
import { IntegrationError } from "./http"
import { getProvider, type ConnectionStatus, type IntegrationView, type ProviderId } from "./registry"

type IntegrationRow = {
  id: string
  company_id: string
  provider: string
  status: ConnectionStatus
  config: Record<string, unknown> | null
  account_label: string | null
  last_tested_at: string | null
  last_error_message: string | null
  connected_at: string | null
}

const COLUMNS = "id, company_id, provider, status, config, account_label, last_tested_at, last_error_message, connected_at"

export type Credentials = {
  integrationId: string
  secrets: Record<string, string>
  config: Record<string, string>
}

function stringConfig(value: Record<string, unknown> | null): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value ?? {})) {
    if (typeof item === "string") result[key] = item
  }
  return result
}

async function hintFor(db: SupabaseClient, integrationId: string): Promise<string | null> {
  const { data } = await db.from("integration_secrets").select("hint").eq("integration_id", integrationId).maybeSingle<{ hint: string | null }>()
  return data?.hint ?? null
}

export async function listIntegrationViews(companyId: string, db: SupabaseClient = createAdminClient()): Promise<IntegrationView[]> {
  const { data, error } = await db.from("integrations").select(COLUMNS).eq("company_id", companyId).returns<IntegrationRow[]>()
  if (error) throw new IntegrationError("provider_error", "Não foi possível carregar as integrações.")

  const hints = await db.from("integration_secrets").select("integration_id, hint").eq("company_id", companyId)
  const hintById = new Map((hints.data ?? []).map((row) => [row.integration_id as string, row.hint as string | null]))

  const views: IntegrationView[] = []
  for (const row of data ?? []) {
    if (!getProvider(row.provider)) continue
    views.push({
      provider: row.provider as ProviderId,
      status: row.status,
      accountLabel: row.account_label,
      config: stringConfig(row.config),
      secretHint: hintById.get(row.id) ?? null,
      lastTestedAt: row.last_tested_at,
      lastErrorMessage: row.last_error_message,
      connectedAt: row.connected_at,
    })
  }
  return views
}

export async function getIntegrationView(companyId: string, provider: ProviderId, db?: SupabaseClient): Promise<IntegrationView | null> {
  const views = await listIntegrationViews(companyId, db)
  return views.find((view) => view.provider === provider) ?? null
}

/** Segredos descriptografados. Somente servidor; devolve null se não houver conexão ativa. */
export async function getCredentials(
  companyId: string,
  provider: ProviderId,
  db: SupabaseClient = createAdminClient(),
): Promise<Credentials | null> {
  const { data: row, error } = await db
    .from("integrations")
    .select(COLUMNS)
    .eq("company_id", companyId)
    .eq("provider", provider)
    .maybeSingle<IntegrationRow>()
  if (error) throw new IntegrationError("provider_error", "Não foi possível carregar a integração.")
  if (!row || row.status === "desconectado") return null

  const { data: secret } = await db
    .from("integration_secrets")
    .select("ciphertext")
    .eq("integration_id", row.id)
    .maybeSingle<{ ciphertext: string }>()
  if (!secret) return null

  let secrets: Record<string, string>
  try {
    secrets = decryptJson(secret.ciphertext)
  } catch {
    throw new IntegrationError("not_configured", "Não foi possível ler as credenciais salvas. Reconecte a integração.")
  }
  return { integrationId: row.id, secrets, config: stringConfig(row.config) }
}

export async function saveConnection(
  companyId: string,
  provider: ProviderId,
  input: { secrets: Record<string, string>; config: Record<string, string>; accountLabel: string | null; primarySecret: string },
  db: SupabaseClient = createAdminClient(),
): Promise<void> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from("integrations")
    .upsert(
      {
        company_id: companyId,
        provider,
        status: "conectado",
        config: input.config,
        account_label: input.accountLabel,
        display_name: getProvider(provider)?.name ?? provider,
        connected_at: now,
        last_tested_at: now,
        last_error_code: null,
        last_error_message: null,
      },
      { onConflict: "company_id,provider" },
    )
    .select("id")
    .single<{ id: string }>()
  if (error || !data) throw new IntegrationError("provider_error", "Não foi possível salvar a integração.")

  const { error: secretError } = await db.from("integration_secrets").upsert(
    {
      integration_id: data.id,
      company_id: companyId,
      ciphertext: encryptJson(input.secrets),
      hint: secretHint(input.primarySecret),
      updated_at: now,
    },
    { onConflict: "integration_id" },
  )
  if (secretError) throw new IntegrationError("provider_error", "Não foi possível salvar as credenciais.")
}

export async function updateConfig(
  companyId: string,
  provider: ProviderId,
  patch: Record<string, string>,
  db: SupabaseClient = createAdminClient(),
): Promise<void> {
  const { data } = await db.from("integrations").select("config").eq("company_id", companyId).eq("provider", provider).maybeSingle<{ config: Record<string, unknown> | null }>()
  const { error } = await db
    .from("integrations")
    .update({ config: { ...(data?.config ?? {}), ...patch } })
    .eq("company_id", companyId)
    .eq("provider", provider)
  if (error) throw new IntegrationError("provider_error", "Não foi possível salvar a configuração.")
}

export async function markStatus(
  companyId: string,
  provider: ProviderId,
  result: { ok: true } | { ok: false; code: string; message: string },
  db: SupabaseClient = createAdminClient(),
): Promise<void> {
  const now = new Date().toISOString()
  const patch = result.ok
    ? { status: "conectado", last_tested_at: now, last_error_code: null, last_error_message: null }
    : { status: "erro", last_tested_at: now, last_error_code: result.code, last_error_message: result.message.slice(0, 300) }
  await db.from("integrations").update(patch).eq("company_id", companyId).eq("provider", provider).neq("status", "desconectado")
}

export async function disconnect(companyId: string, provider: ProviderId, db: SupabaseClient = createAdminClient()): Promise<void> {
  const { data } = await db.from("integrations").select("id").eq("company_id", companyId).eq("provider", provider).maybeSingle<{ id: string }>()
  if (!data) return
  await db.from("integration_secrets").delete().eq("integration_id", data.id)
  const { error } = await db
    .from("integrations")
    .update({ status: "desconectado", config: {}, account_label: null, last_error_code: null, last_error_message: null })
    .eq("id", data.id)
  if (error) throw new IntegrationError("provider_error", "Não foi possível desconectar a integração.")
}

export { hintFor }
