/**
 * Adapters: convertem linhas do banco (snake_case, colunas opcionais) em
 * entidades de domínio. Toda leitura é defensiva — colunas que ainda não
 * existem no schema viram `null`/`[]`, nunca quebram a tela.
 */
import { normalizeRole, notificationCategoryFromType } from "@/lib/domain/catalogs"
import type {
  Activity,
  AIAgent,
  Appointment,
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationTrigger,
  Client,
  Company,
  Conversation,
  ConversationPriority,
  Integration,
  IntegrationStatus,
  Lead,
  Message,
  Notification,
  TeamMember,
} from "@/lib/domain/types"

export type Row = Record<string, unknown>

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null)
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
  return null
}
const bool = (v: unknown): boolean => v === true || v === "true"
const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])
const date = (v: unknown, fallback = new Date(0).toISOString()): string => str(v) ?? fallback
const arrayOf = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

export function toCompany(row: Row): Company {
  return {
    id: String(row.id),
    name: str(row.name) ?? "Minha empresa",
    plan: str(row.plan),
    segment: str(row.segmento) ?? str(row.segment),
    website: str(row.site) ?? str(row.website),
    taxId: str(row.cnpj),
    address: str(row.endereco),
    city: str(row.cidade),
    description: str(row.descricao) ?? str(row.description),
    phone: str(row.telefone) ?? str(row.phone),
    email: str(row.email),
    logoUrl: str(row.logo_url),
    createdAt: str(row.created_at),
  }
}

export function toLead(row: Row): Lead {
  const createdAt = date(row.created_at)
  return {
    id: String(row.id),
    name: str(row.name) ?? "Sem nome",
    email: str(row.email),
    phone: str(row.phone),
    source: str(row.source),
    status: str(row.status) ?? "novo",
    value: num(row.value),
    notes: str(row.notes),
    tags: strArray(row.tags),
    ownerName: str(row.owner_name),
    createdAt,
    updatedAt: date(row.updated_at, createdAt),
  }
}

export function toClient(row: Row): Client {
  return {
    id: String(row.id),
    name: str(row.name) ?? "Sem nome",
    email: str(row.email),
    phone: str(row.phone),
    companyName: str(row.company_name),
    status: str(row.status) ?? "ativo",
    source: str(row.source),
    tags: strArray(row.tags),
    ownerName: str(row.owner_name),
    notes: str(row.notes),
    createdAt: date(row.created_at),
  }
}

export function toConversation(row: Row): Conversation {
  const createdAt = date(row.created_at)
  return {
    id: String(row.id),
    contactName: str(row.contact_name) ?? "Contato",
    channel: str(row.channel) ?? "outro",
    status: str(row.status) ?? "aberta",
    priority: (str(row.priority) as ConversationPriority | null) ?? null,
    assigneeName: str(row.assignee_name),
    lastMessage: str(row.last_message),
    unreadCount: num(row.unread_count) ?? 0,
    tags: strArray(row.tags),
    leadId: str(row.lead_id),
    clientId: str(row.client_id),
    createdAt,
    updatedAt: date(row.updated_at, createdAt),
  }
}

export function toMessage(row: Row): Message {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    sender: str(row.sender) ?? "cliente",
    content: str(row.content) ?? "",
    createdAt: date(row.created_at),
  }
}

export function toAutomation(row: Row): Automation {
  const triggerValue = row.trigger
  const structuredTrigger =
    triggerValue && typeof triggerValue === "object" ? (triggerValue as AutomationTrigger) : null
  return {
    id: String(row.id),
    name: str(row.name) ?? "Automação sem nome",
    description: str(row.description),
    status: str(row.status) ?? "rascunho",
    trigger: structuredTrigger,
    triggerLabel: str(triggerValue),
    conditions: arrayOf<AutomationCondition>(row.conditions),
    actions: arrayOf<AutomationAction>(row.actions),
    executionsCount: num(row.executions_count) ?? 0,
    lastRunAt: str(row.last_run_at),
    createdAt: date(row.created_at),
  }
}

export function toAgent(row: Row): AIAgent {
  const channels = strArray(row.channels)
  const legacyChannel = str(row.channel)
  return {
    id: String(row.id),
    name: str(row.name) ?? "Agente sem nome",
    description: str(row.description),
    objective: str(row.objective),
    instructions: str(row.instructions),
    personality: str(row.personality),
    tone: (str(row.tone) as AIAgent["tone"]) ?? null,
    rules: strArray(row.rules),
    knowledge: str(row.knowledge),
    channels: channels.length > 0 ? channels : legacyChannel ? [legacyChannel] : [],
    schedule: null,
    status: str(row.status) ?? "configuracao",
    conversationsCount: num(row.conversations_count) ?? 0,
    lastActivityAt: str(row.last_activity_at),
    createdAt: date(row.created_at),
  }
}

export function toAppointment(row: Row): Appointment {
  const createdAt = date(row.created_at)
  return {
    id: String(row.id),
    title: str(row.title) ?? "Agendamento",
    clientName: str(row.client_name),
    ownerName: str(row.owner_name),
    startsAt: date(row.scheduled_at ?? row.starts_at, createdAt),
    endsAt: str(row.ends_at),
    status: str(row.status) ?? "pendente",
    notes: str(row.notes),
    createdAt,
  }
}

export function toNotification(row: Row): Notification {
  const type = str(row.type) ?? "sistema"
  return {
    id: String(row.id),
    title: str(row.title) ?? "Notificação",
    message: str(row.message),
    type,
    category: notificationCategoryFromType(type),
    read: bool(row.read),
    createdAt: date(row.created_at),
  }
}

export function toActivity(row: Row): Activity {
  return {
    id: String(row.id),
    type: str(row.type) ?? "sistema",
    description: str(row.description) ?? "",
    createdAt: date(row.created_at),
  }
}

const integrationStatusMap: Record<string, IntegrationStatus> = {
  conectado: "conectado",
  connected: "conectado",
  ativo: "conectado",
  erro: "erro",
  error: "erro",
  pendente: "configuracao_necessaria",
  configuracao_necessaria: "configuracao_necessaria",
}

export function toIntegration(row: Row): Integration {
  return {
    id: str(row.id),
    provider: str(row.provider) ?? "desconhecido",
    status: integrationStatusMap[str(row.status) ?? ""] ?? "desconectado",
    connectedAt: str(row.connected_at),
  }
}

export function toTeamMember(member: Row, profile: Row | undefined): TeamMember {
  const rawRole = str(member.role) ?? "member"
  return {
    userId: String(member.user_id),
    fullName: str(profile?.full_name),
    email: str(profile?.email),
    role: normalizeRole(rawRole),
    rawRole,
    status: "ativo",
    joinedAt: str(member.created_at),
    lastSeenAt: str(member.last_seen_at),
  }
}
