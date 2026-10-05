import type { SupabaseClient } from "@supabase/supabase-js"

export const INACTIVE_ACCOUNT_REASON = "conta-inativa"

export const INACTIVE_ACCOUNT_MESSAGE = "Sua conta está inativa ou não possui mais acesso ao LAUXAI."

export type AccountAccess = { status: "active"; companyId: string } | { status: "blocked" } | { status: "error" }

/**
 * Resolves whether the authenticated user owns an active client account.
 *
 * RLS on `client_accounts` only lets admins read rows, so the lookup goes
 * through the existing `current_client_company_id()` SECURITY DEFINER function.
 * It is scoped to `auth.uid()` and returns a company id only when the user's
 * account has status `ativo`; anything else (missing, pendente, suspenso,
 * expirado, cancelado) comes back as null.
 */
export async function getAccountAccess(supabase: SupabaseClient): Promise<AccountAccess> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return { status: "blocked" }

  const { data: companyId, error } = await supabase.rpc("current_client_company_id")

  if (error) return { status: "error" }
  if (typeof companyId !== "string" || companyId.length === 0) return { status: "blocked" }

  return { status: "active", companyId }
}
