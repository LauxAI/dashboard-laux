import "server-only"
import { IntegrationError, requestJson } from "../http"
import type { ProviderId } from "../registry"

export type CrmContact = { name: string; email?: string | null; phone?: string | null; company?: string | null }
export type CrmRemoteContact = CrmContact & { externalId: string }

export type CrmOps = {
  verify(credentials: Record<string, string>): Promise<{ accountLabel: string; config: Record<string, string> }>
  /** Procura um contato existente por e-mail (evita duplicados). */
  findByEmail(credentials: Record<string, string>, email: string): Promise<string | null>
  createContact(credentials: Record<string, string>, contact: CrmContact): Promise<string>
  updateContact(credentials: Record<string, string>, externalId: string, contact: CrmContact): Promise<void>
  listContacts(credentials: Record<string, string>, limit: number): Promise<CrmRemoteContact[]>
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null)
const idOf = (value: unknown): string | null => (typeof value === "string" || typeof value === "number" ? String(value) : null)
const bearer = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" })

function splitName(name: string): { firstname: string; lastname: string } {
  const [first, ...rest] = name.trim().split(/\s+/)
  return { firstname: first ?? "", lastname: rest.join(" ") }
}

// --- HubSpot -----------------------------------------------------------------

const HUBSPOT = "https://api.hubapi.com"
const HUBSPOT_PROPS = "firstname,lastname,email,phone,company"

type HubSpotContact = { id?: unknown; properties?: Record<string, unknown> }

function hubspotProps(contact: CrmContact): Record<string, string> {
  const { firstname, lastname } = splitName(contact.name)
  const properties: Record<string, string> = { firstname, lastname }
  if (contact.email) properties.email = contact.email
  if (contact.phone) properties.phone = contact.phone
  if (contact.company) properties.company = contact.company
  return properties
}

const hubspot: CrmOps = {
  async verify(credentials) {
    await requestJson(`${HUBSPOT}/crm/v3/objects/contacts?limit=1`, { headers: bearer(credentials.accessToken) })
    let label = "Conta HubSpot"
    try {
      const { data } = await requestJson<{ portalId?: unknown }>(`${HUBSPOT}/account-info/v3/details`, { headers: bearer(credentials.accessToken) })
      if (data?.portalId) label = `Portal ${String(data.portalId)}`
    } catch {
      // O escopo de informações da conta é opcional.
    }
    return { accountLabel: label, config: {} }
  },
  async findByEmail(credentials, email) {
    const { data } = await requestJson<{ results?: HubSpotContact[] }>(`${HUBSPOT}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: bearer(credentials.accessToken),
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }], limit: 1 }),
    })
    return idOf(data?.results?.[0]?.id)
  },
  async createContact(credentials, contact) {
    const { data } = await requestJson<HubSpotContact>(`${HUBSPOT}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: bearer(credentials.accessToken),
      body: JSON.stringify({ properties: { ...hubspotProps(contact), lifecyclestage: "lead" } }),
    })
    const id = idOf(data?.id)
    if (!id) throw new IntegrationError("bad_response")
    return id
  },
  async updateContact(credentials, externalId, contact) {
    await requestJson(`${HUBSPOT}/crm/v3/objects/contacts/${encodeURIComponent(externalId)}`, {
      method: "PATCH",
      headers: bearer(credentials.accessToken),
      body: JSON.stringify({ properties: hubspotProps(contact) }),
    })
  },
  async listContacts(credentials, limit) {
    const { data } = await requestJson<{ results?: HubSpotContact[] }>(
      `${HUBSPOT}/crm/v3/objects/contacts?limit=${Math.min(limit, 100)}&properties=${HUBSPOT_PROPS}`,
      { headers: bearer(credentials.accessToken) },
    )
    return (data?.results ?? []).flatMap((item) => {
      const externalId = idOf(item.id)
      const p = item.properties ?? {}
      const name = [text(p.firstname), text(p.lastname)].filter(Boolean).join(" ") || text(p.email) || text(p.phone)
      return externalId && name ? [{ externalId, name, email: text(p.email), phone: text(p.phone), company: text(p.company) }] : []
    })
  },
}

// --- Pipedrive ---------------------------------------------------------------

function pipedriveBase(credentials: Record<string, string>): string {
  const domain = credentials.companyDomain?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\.pipedrive\.com.*$/, "")
  if (!domain || !/^[a-z0-9-]{1,63}$/.test(domain)) throw new IntegrationError("not_configured", "Domínio do Pipedrive inválido.")
  return `https://${domain}.pipedrive.com/api`
}
const pipedriveHeaders = (credentials: Record<string, string>) => ({ "x-api-token": credentials.apiToken, "Content-Type": "application/json" })

type PipedrivePerson = { id?: unknown; name?: unknown; emails?: { value?: unknown }[]; phones?: { value?: unknown }[] }

function pipedriveBody(contact: CrmContact) {
  return {
    name: contact.name,
    ...(contact.email ? { emails: [{ value: contact.email, primary: true, label: "work" }] } : {}),
    ...(contact.phone ? { phones: [{ value: contact.phone, primary: true, label: "mobile" }] } : {}),
  }
}

const pipedrive: CrmOps = {
  async verify(credentials) {
    const { data } = await requestJson<{ data?: { name?: unknown; company_name?: unknown } }>(`${pipedriveBase(credentials)}/v1/users/me`, {
      headers: pipedriveHeaders(credentials),
    })
    const company = text(data?.data?.company_name)
    return { accountLabel: company ?? text(data?.data?.name) ?? "Conta Pipedrive", config: { companyDomain: credentials.companyDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\.pipedrive\.com.*$/, "") } }
  },
  async findByEmail(credentials, email) {
    const { data } = await requestJson<{ data?: { items?: { item?: { id?: unknown } }[] } }>(
      `${pipedriveBase(credentials)}/v2/persons/search?term=${encodeURIComponent(email)}&fields=email&exact_match=true&limit=1`,
      { headers: pipedriveHeaders(credentials) },
    )
    return idOf(data?.data?.items?.[0]?.item?.id)
  },
  async createContact(credentials, contact) {
    const { data } = await requestJson<{ data?: { id?: unknown } }>(`${pipedriveBase(credentials)}/v2/persons`, {
      method: "POST",
      headers: pipedriveHeaders(credentials),
      body: JSON.stringify(pipedriveBody(contact)),
    })
    const id = idOf(data?.data?.id)
    if (!id) throw new IntegrationError("bad_response")
    return id
  },
  async updateContact(credentials, externalId, contact) {
    await requestJson(`${pipedriveBase(credentials)}/v2/persons/${encodeURIComponent(externalId)}`, {
      method: "PATCH",
      headers: pipedriveHeaders(credentials),
      body: JSON.stringify(pipedriveBody(contact)),
    })
  },
  async listContacts(credentials, limit) {
    const { data } = await requestJson<{ data?: PipedrivePerson[] }>(`${pipedriveBase(credentials)}/v2/persons?limit=${Math.min(limit, 500)}`, {
      headers: pipedriveHeaders(credentials),
    })
    return (data?.data ?? []).flatMap((item) => {
      const externalId = idOf(item.id)
      const name = text(item.name)
      return externalId && name ? [{ externalId, name, email: text(item.emails?.[0]?.value), phone: text(item.phones?.[0]?.value) }] : []
    })
  },
}

// --- RD Station CRM ----------------------------------------------------------

const RD = "https://crm.rdstation.com/api/v1"
const rdUrl = (path: string, credentials: Record<string, string>, extra = "") =>
  `${RD}${path}?token=${encodeURIComponent(credentials.apiToken)}${extra}`

type RdContact = { id?: unknown; _id?: unknown; name?: unknown; emails?: { email?: unknown }[]; phones?: { phone?: unknown }[] }

function rdBody(contact: CrmContact) {
  return {
    contact: {
      name: contact.name,
      ...(contact.email ? { emails: [{ email: contact.email }] } : {}),
      ...(contact.phone ? { phones: [{ phone: contact.phone, type: "cellphone" }] } : {}),
    },
  }
}

const rdstation: CrmOps = {
  async verify(credentials) {
    await requestJson(rdUrl("/contacts", credentials, "&limit=1"))
    return { accountLabel: "Conta RD Station CRM", config: {} }
  },
  async findByEmail(credentials, email) {
    const { data } = await requestJson<{ contacts?: RdContact[] }>(rdUrl("/contacts", credentials, `&limit=1&email=${encodeURIComponent(email)}`))
    return idOf(data?.contacts?.[0]?.id ?? data?.contacts?.[0]?._id)
  },
  async createContact(credentials, contact) {
    const { data } = await requestJson<RdContact>(rdUrl("/contacts", credentials), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rdBody(contact)),
    })
    const id = idOf(data?.id ?? data?._id)
    if (!id) throw new IntegrationError("bad_response")
    return id
  },
  async updateContact(credentials, externalId, contact) {
    await requestJson(rdUrl(`/contacts/${encodeURIComponent(externalId)}`, credentials), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rdBody(contact)),
    })
  },
  async listContacts(credentials, limit) {
    const { data } = await requestJson<{ contacts?: RdContact[] }>(rdUrl("/contacts", credentials, `&limit=${Math.min(limit, 200)}`))
    return (data?.contacts ?? []).flatMap((item) => {
      const externalId = idOf(item.id ?? item._id)
      const name = text(item.name)
      return externalId && name ? [{ externalId, name, email: text(item.emails?.[0]?.email), phone: text(item.phones?.[0]?.phone) }] : []
    })
  },
}

export const crmConnectors: Partial<Record<ProviderId, CrmOps>> = { hubspot, pipedrive, rdstation }
