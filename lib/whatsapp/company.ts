import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { findConnectionByPhoneNumberId } from "./connections"

export type ResolvedWhatsAppCompany = {
  company_id: string
  connection_id: string
  phone_number_id: string
  waba_id: string | null
  display_phone_number: string | null
  status: "active"
}

/**
 * Resolve phone_number_id -> empresa, sempre no servidor com acesso privilegiado.
 * O company_id nunca vem do payload nem do frontend. Retorna somente os dados mínimos
 * (nunca o access_token) e null quando não existe conexão ativa.
 */
export async function resolveWhatsAppCompany(
  phoneNumberId: string,
  db?: SupabaseClient,
): Promise<ResolvedWhatsAppCompany | null> {
  const connection = await findConnectionByPhoneNumberId(phoneNumberId, db)
  if (!connection || connection.status !== "active") return null

  return {
    company_id: connection.company_id,
    connection_id: connection.id,
    phone_number_id: connection.phone_number_id,
    waba_id: connection.waba_id,
    display_phone_number: connection.display_phone_number,
    status: "active",
  }
}
