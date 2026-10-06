import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import type { WebhookEventRow } from "./processor"

/**
 * Insere eventos em whatsapp_webhook_events ignorando duplicados (dedupe_key único)
 * e devolve somente as chaves realmente inseridas, ou seja, os eventos inéditos.
 */
export async function insertWebhookEvents(rows: WebhookEventRow[]): Promise<Set<string>> {
  if (rows.length === 0) return new Set()

  const { data, error } = await createAdminClient()
    .from("whatsapp_webhook_events")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("dedupe_key")

  if (error) throw new Error(`insert_failed:${error.code ?? "unknown"}`)
  return new Set((data ?? []).map((row) => row.dedupe_key as string))
}
