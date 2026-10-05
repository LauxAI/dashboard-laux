"use server"

import { revalidatePath } from "next/cache"
import type { AvailabilityConfig } from "@/lib/domain/types"
import { saveAvailabilityConfig } from "@/lib/scheduling/agenda-config"
import { parseAvailabilityConfig } from "@/lib/scheduling/agenda-validation"
import { getAccountAccess } from "@/lib/supabase/account-access"
import { createClient } from "@/lib/supabase/server"

export type SaveAgendaResult = { ok: true; config: AvailabilityConfig } | { ok: false; error: string }

export async function saveAgendaConfigAction(input: unknown): Promise<SaveAgendaResult> {
  const supabase = await createClient()
  const access = await getAccountAccess(supabase)
  if (access.status !== "active") {
    return { ok: false, error: "Sua sessão expirou ou a conta não tem acesso. Entre novamente." }
  }

  const parsed = parseAvailabilityConfig(input)
  if (!parsed.ok) return parsed

  try {
    await saveAvailabilityConfig(supabase, access.companyId, parsed.config)
  } catch {
    return { ok: false, error: "Não foi possível salvar a disponibilidade. Tente novamente." }
  }

  revalidatePath("/agenda")
  return { ok: true, config: parsed.config }
}
