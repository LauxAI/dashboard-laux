import type { SupabaseClient } from "@supabase/supabase-js"

export const INACTIVE_ACCOUNT_REASON = "conta-inativa"

export const INACTIVE_ACCOUNT_MESSAGE = "Sua conta está inativa ou não possui mais acesso ao LAUXAI."

export const ADMIN_ACCOUNT_REASON = "conta-administrativa"

export const ADMIN_ACCOUNT_MESSAGE =
  "Esta é uma conta administrativa. Acesse pelo Painel Administrativo do LAUXAI."

export type AccountAccess =
  | { status: "active"; companyId: string }
  | { status: "admin" }
  | { status: "blocked" }
  | { status: "error" }

/**
 * Resolves what the authenticated user may access in the client dashboard.
 *
 * Both lookups go through existing SECURITY DEFINER functions scoped to
 * `auth.uid()`, because RLS on `client_accounts` / `admin_profiles` only lets
 * admins read rows:
 * - `current_client_company_id()` returns a company id only for a client
 *   account with status `ativo`.
 * - `is_active_admin()` is true only when the caller's own `admin_profiles`
 *   row has status `ativo`.
 *
 * An active client account always wins. An active admin without one gets
 * `admin`: callers must keep them out of the client dashboard, but must not
 * treat them as an inactive account or revoke their session, since the admin
 * dashboard authenticates separately.
 */
export async function getAccountAccess(supabase: SupabaseClient): Promise<AccountAccess> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return { status: "blocked" }

  const [clientResult, adminResult] = await Promise.all([
    supabase.rpc("current_client_company_id"),
    supabase.rpc("is_active_admin"),
  ])

  if (clientResult.error) return { status: "error" }

  const companyId = clientResult.data
  if (typeof companyId === "string" && companyId.length > 0) {
    return { status: "active", companyId }
  }

  if (adminResult.error) return { status: "error" }
  if (adminResult.data === true) return { status: "admin" }

  return { status: "blocked" }
}
