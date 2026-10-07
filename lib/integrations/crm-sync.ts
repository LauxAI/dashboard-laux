import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { crmConnectors, type CrmContact } from "./connectors/crm"
import { IntegrationError } from "./http"
import { crmProviderIds, type ProviderId } from "./registry"
import { requireCredentials, tracked, type ServiceResult } from "./service"
import { getCredentials } from "./store"

type EntityType = "lead" | "client"

const IMPORT_LIMIT = 100

function table(entityType: EntityType) {
  return entityType === "lead" ? "leads" : "clients"
}

function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "")
  return digits.length >= 8 ? digits : null
}

async function loadContact(db: SupabaseClient, companyId: string, entityType: EntityType, entityId: string): Promise<CrmContact | null> {
  const { data } = await db.from(table(entityType)).select("*").eq("company_id", companyId).eq("id", entityId).maybeSingle<Record<string, unknown>>()
  if (!data || typeof data.name !== "string") return null
  const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)
  return { name: data.name, email: str(data.email), phone: str(data.phone), company: str(data.company_name) }
}

/** Envia (cria ou atualiza) um lead/cliente da LAUXAI para um CRM conectado. */
export async function pushEntityToCrm(
  companyId: string,
  provider: ProviderId,
  entityType: EntityType,
  entityId: string,
  db: SupabaseClient = createAdminClient(),
): Promise<ServiceResult<{ externalId: string; created: boolean }>> {
  const ops = crmConnectors[provider]
  if (!ops) return { ok: false, error: "CRM não suportado.", code: "not_supported" }

  return tracked(companyId, provider, `push_${entityType}`, async () => {
    const credentials = await requireCredentials(companyId, provider)
    const contact = await loadContact(db, companyId, entityType, entityId)
    if (!contact) throw new IntegrationError("not_found", "O registro não foi encontrado.")

    const { data: link } = await db
      .from("crm_sync_links")
      .select("external_id")
      .eq("company_id", companyId)
      .eq("provider", provider)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle<{ external_id: string }>()

    let externalId = link?.external_id ?? null
    let created = false
    if (externalId) {
      await ops.updateContact(credentials, externalId, contact)
    } else {
      if (contact.email) externalId = await ops.findByEmail(credentials, contact.email).catch(() => null)
      if (externalId) {
        await ops.updateContact(credentials, externalId, contact)
      } else {
        externalId = await ops.createContact(credentials, contact)
        created = true
      }
    }
    await db.from("crm_sync_links").upsert(
      { company_id: companyId, provider, entity_type: entityType, entity_id: entityId, external_id: externalId, last_synced_at: new Date().toISOString() },
      { onConflict: "company_id,provider,entity_type,entity_id" },
    )
    return { externalId, created }
  })
}

/** CRMs conectados da empresa (para sincronização automática). */
export async function connectedCrms(companyId: string, db?: SupabaseClient): Promise<ProviderId[]> {
  const connected: ProviderId[] = []
  for (const provider of crmProviderIds) {
    try {
      if (await getCredentials(companyId, provider, db)) connected.push(provider)
    } catch {
      // Conexão ilegível: ignorada aqui, aparece como erro na tela de integrações.
    }
  }
  return connected
}

/** Dispara o envio para todos os CRMs conectados; falhas ficam no log, nunca interrompem o fluxo. */
export async function syncEntityToAllCrms(companyId: string, entityType: EntityType, entityId: string, db?: SupabaseClient): Promise<void> {
  const client = db ?? createAdminClient()
  const providers = await connectedCrms(companyId, client)
  await Promise.all(providers.map((provider) => pushEntityToCrm(companyId, provider, entityType, entityId, client)))
}

export type ImportSummary = { imported: number; skipped: number; total: number }

/** Importa contatos do CRM como leads, ignorando os que já existem (telefone ou e-mail). */
export async function importContactsFromCrm(
  companyId: string,
  provider: ProviderId,
  db: SupabaseClient = createAdminClient(),
): Promise<ServiceResult<ImportSummary>> {
  const ops = crmConnectors[provider]
  if (!ops) return { ok: false, error: "CRM não suportado.", code: "not_supported" }

  return tracked(companyId, provider, "import_contacts", async () => {
    const credentials = await requireCredentials(companyId, provider)
    const remote = await ops.listContacts(credentials, IMPORT_LIMIT)

    const [leads, clients, links] = await Promise.all([
      db.from("leads").select("phone, email").eq("company_id", companyId),
      db.from("clients").select("phone, email").eq("company_id", companyId),
      db.from("crm_sync_links").select("external_id").eq("company_id", companyId).eq("provider", provider),
    ])
    const phones = new Set<string>()
    const emails = new Set<string>()
    for (const row of [...(leads.data ?? []), ...(clients.data ?? [])]) {
      const phone = normalizePhone(row.phone as string | null)
      if (phone) phones.add(phone)
      if (typeof row.email === "string" && row.email) emails.add(row.email.toLowerCase())
    }
    const known = new Set((links.data ?? []).map((row) => row.external_id as string))

    let imported = 0
    let skipped = 0
    for (const contact of remote) {
      const phone = normalizePhone(contact.phone)
      const email = contact.email?.toLowerCase() ?? null
      if (known.has(contact.externalId) || (phone && phones.has(phone)) || (email && emails.has(email))) {
        skipped += 1
        continue
      }
      const inserted = await db
        .from("leads")
        .insert({
          company_id: companyId,
          name: contact.name.slice(0, 120),
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          source: `crm_${provider}`,
          status: "novo",
        })
        .select("id")
        .single<{ id: string }>()
      if (inserted.error || !inserted.data) {
        skipped += 1
        continue
      }
      if (phone) phones.add(phone)
      if (email) emails.add(email)
      await db.from("crm_sync_links").upsert(
        { company_id: companyId, provider, entity_type: "lead", entity_id: inserted.data.id, external_id: contact.externalId },
        { onConflict: "company_id,provider,entity_type,entity_id" },
      )
      imported += 1
    }
    return { imported, skipped, total: remote.length }
  })
}
