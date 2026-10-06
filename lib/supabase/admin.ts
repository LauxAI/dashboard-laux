import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Cliente Supabase com a service role key (ignora RLS). Uso restrito a código de
 * servidor sem sessão de usuário, como webhooks. Nunca importar em Client Components.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error("supabase_admin_not_configured")

  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
