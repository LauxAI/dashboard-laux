/**
 * Contratos de domínio do LAUXAI CORE Client Dashboard.
 *
 * As telas consomem somente estes tipos. A camada `lib/data` converte as linhas
 * do banco para estas entidades (via `adapters.ts`), então trocar a origem dos
 * dados não exige reconstruir a UI.
 *
 * Multi-tenancy: toda entidade pertence a uma `Company`. O isolamento real é
 * responsabilidade do Supabase/RLS — o frontend não filtra por empresa.
 */

export type ID = string
export type ISODateString = string

export interface Company {
  id: ID
  name: string
  plan: string | null
  segment: string | null
  website: string | null
  taxId: string | null
  address: string | null
  city: string | null
  description: string | null
  phone: string | null
  email: string | null
  logoUrl: string | null
  createdAt: ISODateString | null
}

export interface User {
  id: ID
  email: string | null
  fullName: string | null
  phone: string | null
}

export type TeamRole = "administrador" | "gestor" | "operador" | "visualizacao"
export type TeamMemberStatus = "ativo" | "pendente" | "inativo"

export interface TeamMember {
  userId: ID
  fullName: string | null
  email: string | null
  role: TeamRole
  /** Valor bruto vindo do banco (ex.: owner, admin, member). */
  rawRole: string
  status: TeamMemberStatus
  joinedAt: ISODateString | null
  lastSeenAt: ISODateString | null
}

export interface Membership {
  companyId: ID
  role: TeamRole
  rawRole: string
}

export type LeadStatus =
  | "novo"
  | "contatado"
  | "qualificado"
  | "demonstracao"
  | "negociacao"
  | "cliente"
  | "perdido"

export interface Lead {
  id: ID
  name: string
  email: string | null
  phone: string | null
  source: string | null
  status: LeadStatus | string
  value: number | null
  notes: string | null
  tags: string[]
  ownerName: string | null
  createdAt: ISODateString
  updatedAt: ISODateString
}

export type ClientStatus = "ativo" | "inativo" | "arquivado"

export interface Client {
  id: ID
  name: string
  email: string | null
  phone: string | null
  companyName: string | null
  status: ClientStatus | string
  source: string | null
  tags: string[]
  ownerName: string | null
  notes: string | null
  createdAt: ISODateString
}

export type ChannelKey = "whatsapp" | "instagram" | "messenger" | "website" | "outro"
export type ConversationStatus = "aberta" | "pendente" | "em_atendimento" | "resolvida"
export type ConversationPriority = "baixa" | "media" | "alta" | "urgente"

export interface Conversation {
  id: ID
  contactName: string
  channel: ChannelKey | string
  status: ConversationStatus | string
  priority: ConversationPriority | null
  assigneeName: string | null
  lastMessage: string | null
  unreadCount: number
  tags: string[]
  leadId: ID | null
  clientId: ID | null
  createdAt: ISODateString
  updatedAt: ISODateString
}

export type MessageSender = "cliente" | "equipe" | "ia" | "sistema"

export interface Message {
  id: ID
  conversationId: ID
  sender: MessageSender | string
  content: string
  createdAt: ISODateString
}

export type AutomationStatus = "ativa" | "pausada" | "erro" | "rascunho"

export type AutomationTriggerType =
  | "novo_lead"
  | "nova_conversa"
  | "mensagem_recebida"
  | "cliente_criado"
  | "formulario_enviado"
  | "evento_personalizado"

export interface AutomationTrigger {
  type: AutomationTriggerType
  config: Record<string, string>
}

export type AutomationConditionField = "origem" | "status" | "tag" | "horario" | "campo_personalizado"
export type AutomationConditionOperator = "igual" | "diferente" | "contem" | "entre"

export interface AutomationCondition {
  id: ID
  field: AutomationConditionField
  operator: AutomationConditionOperator
  value: string
}

export type AutomationActionType =
  | "enviar_mensagem"
  | "adicionar_tag"
  | "atualizar_campo"
  | "atribuir_responsavel"
  | "criar_tarefa"
  | "chamar_webhook"
  | "executar_agente"

export interface AutomationAction {
  id: ID
  type: AutomationActionType
  config: Record<string, string>
}

export interface Automation {
  id: ID
  name: string
  description: string | null
  status: AutomationStatus | string
  /** Gatilho estruturado, quando o backend fornecer. */
  trigger: AutomationTrigger | null
  /** Texto livre legado da coluna `trigger`. */
  triggerLabel: string | null
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  executionsCount: number
  lastRunAt: ISODateString | null
  createdAt: ISODateString
}

export type AgentStatus = "ativo" | "pausado" | "configuracao"
export type AgentTone = "formal" | "consultivo" | "amigavel" | "objetivo"

export interface AgentSchedule {
  alwaysOn: boolean
  start: string | null
  end: string | null
  days: number[]
}

export interface AIAgent {
  id: ID
  name: string
  description: string | null
  objective: string | null
  instructions: string | null
  personality: string | null
  tone: AgentTone | null
  rules: string[]
  knowledge: string | null
  channels: string[]
  schedule: AgentSchedule | null
  status: AgentStatus | string
  conversationsCount: number
  lastActivityAt: ISODateString | null
  createdAt: ISODateString
}

export type AppointmentStatus = "confirmado" | "pendente" | "cancelado" | "concluido"

export interface Appointment {
  id: ID
  title: string
  clientName: string | null
  ownerName: string | null
  startsAt: ISODateString
  endsAt: ISODateString | null
  status: AppointmentStatus | string
  notes: string | null
  createdAt: ISODateString
}

/* ---------------------------------------------------------------------------
 * Agente de Agendamento e disponibilidade da agenda.
 *
 * Ainda sem tabelas no Supabase: as telas usam estes contratos em estado local.
 * Quando a persistência existir, a camada `lib/data` deverá ler/gravar estas
 * entidades (sempre escopadas por `company_id` via RLS), e o agente de IA
 * consumirá a mesma configuração por uma rota server-side (Dashboard → API →
 * Gemini → Agenda/Supabase). Nenhuma chave de IA trafega pelo navegador.
 * ------------------------------------------------------------------------- */

export type SchedulingTone = "profissional" | "amigavel" | "direto" | "personalizado"

export interface SchedulingAgentBehavior {
  offerAvailableSlots: boolean
  allowConfirmation: boolean
  allowCancellation: boolean
  allowRescheduling: boolean
  askName: boolean
  askPhone: boolean
  askEmail: boolean
}

export interface SchedulingAgentConfig {
  name: string
  description: string
  greeting: string
  tone: SchedulingTone
  customTone: string
  behavior: SchedulingAgentBehavior
}

export type SchedulingAgentStatus = "ativo" | "inativo"

/** Linha de `scheduling_agent_settings` (uma por empresa). */
export interface SchedulingAgentSettings {
  status: SchedulingAgentStatus
  config: SchedulingAgentConfig
  updatedAt: string | null
}

export type WeekdayKey = "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | "domingo"

export interface BusinessHoursDay {
  day: WeekdayKey
  enabled: boolean
  /** "HH:mm" ou vazio quando ainda não configurado. */
  start: string
  end: string
}

export type AppointmentBufferMinutes = 0 | 5 | 10 | 15 | 30 | 60

export interface BookableService {
  id: ID
  name: string
  description: string | null
  durationMinutes: number
  price: number | null
  active: boolean
}

export interface BlockedDate {
  id: ID
  /** "YYYY-MM-DD" */
  date: string
  reason: string | null
}

export type NotificationCategory = "sistema" | "automacoes" | "integracoes" | "equipe" | "seguranca"

export interface Notification {
  id: ID
  title: string
  message: string | null
  type: string
  category: NotificationCategory
  read: boolean
  createdAt: ISODateString
}

export type IntegrationStatus = "conectado" | "desconectado" | "erro" | "configuracao_necessaria"
export type IntegrationCategory = "comunicacao" | "automacao" | "ia" | "crm"

export interface Integration {
  id: ID | null
  provider: string
  status: IntegrationStatus
  connectedAt: ISODateString | null
}

export interface PlanLimits {
  conversations: number | null
  agents: number | null
  automations: number | null
  members: number | null
}

export interface PlanUsage {
  conversations: number
  agents: number
  automations: number
  members: number
}

export interface Plan {
  key: string | null
  name: string | null
  status: "ativo" | "trial" | "inadimplente" | "cancelado" | null
  billingCycle: "mensal" | "anual" | null
  renewsAt: ISODateString | null
  /** Limites vêm do sistema de billing. `null` = ainda não informado. */
  limits: PlanLimits | null
}

export interface Invoice {
  id: ID
  number: string
  amount: number
  currency: string
  status: "paga" | "pendente" | "vencida"
  issuedAt: ISODateString
  url: string | null
}

export interface Activity {
  id: ID
  type: string
  description: string
  createdAt: ISODateString
}
