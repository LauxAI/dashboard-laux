import "server-only"
import { createClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

export type SessionContext =
  | { error: string }
  | { error?: undefined; supabase: Supabase; userId: string; companyId: string }

/** O company_id vem sempre da sessão (RPC current_client_company_id), nunca do cliente. */
export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sessão expirada. Entre novamente." }

  const { data: companyId, error } = await supabase.rpc("current_client_company_id")
  if (error || !companyId) return { error: "Sua conta não está vinculada a uma empresa ativa." }

  return { supabase, userId: user.id, companyId: companyId as string }
}
