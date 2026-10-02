export type LeadStatus =
  | "novo"
  | "contatado"
  | "qualificado"
  | "demonstracao"
  | "negociacao"
  | "cliente"
  | "perdido"

export interface Lead {
  id: string
  nome: string
  empresa: string
  whatsapp: string
  email: string
  origem: string
  status: LeadStatus
  responsavel: string
  ultimaInteracao: string
  data: string
}

export type ConversationStatus = "nao_lida" | "em_atendimento" | "ia" | "humano" | "resolvida"
export type ConversationChannel = "whatsapp" | "instagram"
export type MessageSender = "cliente" | "ia" | "humano"

export interface ConversationMessage {
  id: string
  sender: MessageSender
  text: string
  time: string
}

export interface Conversation {
  id: string
  nome: string
  canal: ConversationChannel
  ultimaMensagem: string
  horario: string
  status: ConversationStatus
  responsavel: string
  naoLidas: number
  messages: ConversationMessage[]
}

export interface Contact {
  id: string
  nome: string
  empresa: string
  whatsapp: string
  email: string
  tags: string[]
  origem: string
  ultimoContato: string
}

export type AutomationStatus = "ativa" | "pausada" | "erro" | "rascunho"

export interface Automation {
  id: string
  nome: string
  descricao: string
  status: AutomationStatus
  ultimaExecucao: string
  execucoes: number
  taxaSucesso: number
}

export type AgentStatus = "ativo" | "pausado" | "configuracao"

export interface Agent {
  id: string
  nome: string
  status: AgentStatus
  canal: string
  objetivo: string
  modelo: string
  ultimaAtividade: string
}

export type AppointmentStatus = "confirmado" | "pendente" | "cancelado"

export interface Appointment {
  id: string
  titulo: string
  cliente: string
  responsavel: string
  data: string
  horario: string
  status: AppointmentStatus
}

export type IntegrationStatus = "conectado" | "nao_conectado" | "configuracao_necessaria" | "erro"

export interface Integration {
  id: string
  nome: string
  descricao: string
  status: IntegrationStatus
}

export interface NotificationItem {
  id: string
  titulo: string
  descricao: string
  horario: string
  lida: boolean
  tipo: "lead" | "agendamento" | "automacao" | "integracao" | "sistema" | "conversa"
}

export interface TeamMember {
  id: string
  nome: string
  email: string
  cargo: "administrador" | "gestor" | "atendente"
  status: "ativo" | "pendente" | "inativo"
}
