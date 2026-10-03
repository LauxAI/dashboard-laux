import { createClient } from "@/lib/supabase/server"

export type Company = {
  id: string
  name: string
  plan: string
  created_at: string
  segmento: string | null
  site: string | null
  cnpj: string | null
  endereco: string | null
  cidade: string | null
}

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
}

export type Lead = {
  id: string
  name: string
  email: string | null
  phone: string | null
  source: string | null
  status: string
  value: number | null
  notes: string | null
  created_at: string
}

export type Client = {
  id: string
  name: string
  email: string | null
  phone: string | null
  company_name: string | null
  status: string
  created_at: string
}

export type Conversation = {
  id: string
  contact_name: string
  channel: string
  status: string
  last_message: string | null
  unread_count: number
  updated_at: string
  created_at: string
}

export type Message = {
  id: string
  conversation_id: string
  sender: string
  content: string
  created_at: string
}

export type Automation = {
  id: string
  name: string
  description: string | null
  trigger: string | null
  status: string
  executions_count: number
  created_at: string
}

export type AiAgent = {
  id: string
  name: string
  description: string | null
  channel: string | null
  status: string
  conversations_count: number
  created_at: string
}

export type Appointment = {
  id: string
  title: string
  client_name: string | null
  scheduled_at: string
  status: string
  created_at: string
}

export type NotificationRow = {
  id: string
  title: string
  message: string | null
  type: string
  read: boolean
  created_at: string
}

export type Activity = {
  id: string
  type: string
  description: string
  created_at: string
}

export type Integration = {
  id: string
  provider: string
  status: string
  connected_at: string | null
}

export type TeamMember = {
  user_id: string
  role: string
  created_at: string
  full_name: string | null
  email: string | null
}

/** Returns the authenticated user's company, or null if unauthenticated/unprovisioned. */
export async function getCompany(): Promise<Company | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, plan, created_at, segmento, site, cnpj, endereco, cidade")
    .maybeSingle()
  if (error || !data) return null
  return data
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase.from("profiles").select("id, email, full_name").eq("id", user.id).maybeSingle()
  if (error || !data) return null
  return data
}

export async function getDashboardCounts() {
  const supabase = await createClient()
  const [leads, conversations, clients, appointments] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("conversations").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("appointments").select("*", { count: "exact", head: true }),
  ])
  return {
    leads: leads.count ?? 0,
    conversations: conversations.count ?? 0,
    clients: clients.count ?? 0,
    appointments: appointments.count ?? 0,
  }
}

export async function getLeads(): Promise<Lead[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false })
  return data ?? []
}

export async function getClients(): Promise<Client[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false })
  return data ?? []
}

export async function getConversations(): Promise<Conversation[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("conversations").select("*").order("updated_at", { ascending: false })
  return data ?? []
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
  return data ?? []
}

export async function getAutomations(): Promise<Automation[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("automations").select("*").order("created_at", { ascending: false })
  return data ?? []
}

export async function getAiAgents(): Promise<AiAgent[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("ai_agents").select("*").order("created_at", { ascending: false })
  return data ?? []
}

export async function getAppointments(): Promise<Appointment[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("appointments").select("*").order("scheduled_at", { ascending: true })
  return data ?? []
}

export async function getNotifications(): Promise<NotificationRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false })
  return data ?? []
}

export async function getActivities(): Promise<Activity[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10)
  return data ?? []
}

export async function getIntegrations(): Promise<Integration[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("integrations").select("id, provider, status, connected_at")
  return data ?? []
}

const leadFunnelStages = [
  { status: "novo", label: "Novo" },
  { status: "contatado", label: "Contatado" },
  { status: "qualificado", label: "Qualificado" },
  { status: "negociacao", label: "Em negociação" },
  { status: "cliente", label: "Cliente" },
] as const

export async function getAnalytics() {
  const supabase = await createClient()
  const [{ data: leads }, { data: conversations }] = await Promise.all([
    supabase.from("leads").select("status, created_at"),
    supabase.from("conversations").select("channel, status, created_at"),
  ])

  const leadList = leads ?? []
  const conversationList = conversations ?? []

  const totalLeads = leadList.length
  const wonLeads = leadList.filter((l) => l.status === "cliente").length
  const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0

  const resolvedConversations = conversationList.filter((c) => c.status === "resolvida").length
  const resolvedRate = conversationList.length > 0 ? (resolvedConversations / conversationList.length) * 100 : 0

  const qualifiedLeads = leadList.filter((l) =>
    ["qualificado", "negociacao", "cliente"].includes(l.status),
  ).length

  const funnel = leadFunnelStages.map(({ status, label }) => ({
    etapa: label,
    valor: leadList.filter((l) => l.status === status).length,
  }))

  const weekDayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  const now = new Date()
  const isSameDay = (isoDate: string, day: Date) => {
    const created = new Date(isoDate)
    return (
      created.getFullYear() === day.getFullYear() &&
      created.getMonth() === day.getMonth() &&
      created.getDate() === day.getDate()
    )
  }
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now)
    day.setDate(now.getDate() - (6 - i))
    return {
      dia: weekDayLabels[day.getDay()],
      conversas: conversationList.filter((c) => isSameDay(c.created_at, day)).length,
      leads: leadList.filter((l) => isSameDay(l.created_at, day)).length,
      conversoes: leadList.filter((l) => l.status === "cliente" && isSameDay(l.created_at, day)).length,
    }
  })

  return {
    totalLeads,
    conversionRate,
    resolvedRate,
    qualifiedLeads,
    funnel,
    leads: leadList,
    weekly,
  }
}

const planLimits: Record<string, { conversations: number; agents: number; automations: number }> = {
  trial: { conversations: 200, agents: 1, automations: 2 },
  profissional: { conversations: 5000, agents: 4, automations: 10 },
  enterprise: { conversations: 50000, agents: 20, automations: 100 },
}

export async function getPlanUsage() {
  const supabase = await createClient()
  const company = await getCompany()
  const plan = company?.plan ?? "trial"
  const limits = planLimits[plan] ?? planLimits.trial

  const [{ count: conversations }, { count: agents }, { count: automations }] = await Promise.all([
    supabase.from("conversations").select("*", { count: "exact", head: true }),
    supabase.from("ai_agents").select("*", { count: "exact", head: true }),
    supabase.from("automations").select("*", { count: "exact", head: true }),
  ])

  return {
    plan,
    limits,
    usage: {
      conversations: conversations ?? 0,
      agents: agents ?? 0,
      automations: automations ?? 0,
    },
  }
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient()
  const { data: members } = await supabase
    .from("company_members")
    .select("user_id, role, created_at")
    .order("created_at", { ascending: true })

  if (!members || members.length === 0) return []

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in(
      "id",
      members.map((m) => m.user_id),
    )

  return members.map((member) => {
    const profile = profiles?.find((p) => p.id === member.user_id)
    return {
      user_id: member.user_id,
      role: member.role,
      created_at: member.created_at,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    }
  })
}
