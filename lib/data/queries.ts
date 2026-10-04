import { createClient } from "@/lib/supabase/server"
import { normalizeRole } from "@/lib/domain/catalogs"
import type {
  Activity,
  AIAgent,
  Appointment,
  Automation,
  Client,
  Company,
  Conversation,
  Integration,
  Lead,
  Membership,
  Message,
  Notification,
  PlanUsage,
  TeamMember,
  User,
} from "@/lib/domain/types"
import {
  toActivity,
  toAgent,
  toAppointment,
  toAutomation,
  toClient,
  toCompany,
  toConversation,
  toIntegration,
  toLead,
  toMessage,
  toNotification,
  toTeamMember,
  type Row,
} from "./adapters"
import { isMissingResource, ok, toResult, type QueryResult } from "./result"

/**
 * Leituras do servidor. O isolamento por empresa é garantido pelo RLS do
 * Supabase; aqui apenas lemos e convertemos para entidades de domínio.
 */

type ListOptions = { orderBy?: string; ascending?: boolean; limit?: number }

async function listRows<T>(
  table: string,
  map: (row: Row) => T,
  errorMessage: string,
  { orderBy = "created_at", ascending = false, limit }: ListOptions = {},
): Promise<QueryResult<T[]>> {
  const supabase = await createClient()
  let query = supabase.from(table).select("*").order(orderBy, { ascending })
  if (limit) query = query.limit(limit)
  const response = await query
  return toResult(response as { data: Row[] | null; error: { code?: string } | null }, (rows) => rows.map(map), [], errorMessage)
}

async function getRowById<T>(table: string, id: string, map: (row: Row) => T, errorMessage: string) {
  const supabase = await createClient()
  const response = await supabase.from(table).select("*").eq("id", id).maybeSingle()
  return toResult<Row, T | null>(response as { data: Row | null; error: { code?: string } | null }, map, null, errorMessage)
}

export async function getCompany(): Promise<Company | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("companies").select("*").maybeSingle()
  if (error || !data) return null
  return toCompany(data as Row)
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
  const profile = (data ?? {}) as Row
  return {
    id: user.id,
    email: (profile.email as string | null) ?? user.email ?? null,
    fullName: (profile.full_name as string | null) ?? null,
    phone: (profile.phone as string | null) ?? null,
  }
}

export async function getCurrentMembership(): Promise<Membership | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .maybeSingle()
  if (!data) return null
  return { companyId: data.company_id, role: normalizeRole(data.role), rawRole: data.role ?? "member" }
}

export const getLeads = () => listRows<Lead>("leads", toLead, "Não foi possível carregar os leads.")
export const getLead = (id: string) => getRowById<Lead>("leads", id, toLead, "Não foi possível carregar o lead.")

export const getClients = () => listRows<Client>("clients", toClient, "Não foi possível carregar os clientes.")
export const getClientById = (id: string) =>
  getRowById<Client>("clients", id, toClient, "Não foi possível carregar o cliente.")

export const getConversations = () =>
  listRows<Conversation>("conversations", toConversation, "Não foi possível carregar as conversas.", {
    orderBy: "updated_at",
  })

export async function getMessages(conversationId: string): Promise<QueryResult<Message[]>> {
  const supabase = await createClient()
  const response = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
  return toResult(response as { data: Row[] | null; error: { code?: string } | null }, (rows) => rows.map(toMessage), [], "Não foi possível carregar as mensagens.")
}

export const getAutomations = () =>
  listRows<Automation>("automations", toAutomation, "Não foi possível carregar as automações.")

export const getAgents = () => listRows<AIAgent>("ai_agents", toAgent, "Não foi possível carregar os agentes.")
export const getAgent = (id: string) =>
  getRowById<AIAgent>("ai_agents", id, toAgent, "Não foi possível carregar o agente.")

export const getAppointments = () =>
  listRows<Appointment>("appointments", toAppointment, "Não foi possível carregar a agenda.", {
    orderBy: "scheduled_at",
    ascending: true,
  })

export const getNotifications = () =>
  listRows<Notification>("notifications", toNotification, "Não foi possível carregar as notificações.")

export const getActivities = (limit = 10) =>
  listRows<Activity>("activities", toActivity, "Não foi possível carregar as atividades.", { limit })

export async function getIntegrations(): Promise<QueryResult<Integration[]>> {
  const supabase = await createClient()
  const response = await supabase.from("integrations").select("*")
  return toResult(response as { data: Row[] | null; error: { code?: string } | null }, (rows) => rows.map(toIntegration), [], "Não foi possível carregar as integrações.")
}

export async function getTeamMembers(): Promise<QueryResult<TeamMember[]>> {
  const supabase = await createClient()
  const { data: members, error } = await supabase
    .from("company_members")
    .select("*")
    .order("created_at", { ascending: true })

  if (error) {
    if (isMissingResource(error)) return { data: [], error: null, unavailable: true }
    return { data: [], error: "Não foi possível carregar a equipe." }
  }
  if (!members || members.length === 0) return ok([])

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in(
      "id",
      members.map((m) => m.user_id),
    )

  return ok(members.map((member) => toTeamMember(member as Row, profiles?.find((p) => p.id === member.user_id) as Row)))
}

/** Contagens reais de uso. Os limites do plano vêm do billing (ainda não conectado). */
export async function getPlanUsage(): Promise<PlanUsage> {
  const supabase = await createClient()
  const count = async (table: string) => {
    const { count: total } = await supabase.from(table).select("*", { count: "exact", head: true })
    return total ?? 0
  }
  const [conversations, agents, automations, members] = await Promise.all([
    count("conversations"),
    count("ai_agents"),
    count("automations"),
    count("company_members"),
  ])
  return { conversations, agents, automations, members }
}
