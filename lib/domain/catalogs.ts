/**
 * Catálogos de produto: opções, rótulos e configurações estáticas da plataforma.
 * Nada aqui é dado de cliente — são as definições que a UI usa para renderizar
 * formulários, filtros e badges. O DEV pode mover estes catálogos para o banco
 * sem alterar as telas.
 */
import type { LucideIcon } from "lucide-react"
import {
  Blocks,
  Bot,
  Camera,
  Clock,
  Contact,
  Cpu,
  Database,
  FileText,
  Filter,
  Globe,
  ListTodo,
  MessageCircle,
  MessageSquarePlus,
  MessagesSquare,
  PenLine,
  Send,
  SlidersHorizontal,
  Sparkles,
  Tag,
  UserPlus,
  UserRoundCog,
  UserCheck,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react"
import type {
  AIAgentTone,
  AIAgentType,
  SchedulingAgentBehavior,
  WeekdayKey,
  AgentTone,
  AutomationActionType,
  AutomationConditionField,
  AutomationConditionOperator,
  AutomationTriggerType,
  IntegrationCategory,
  NotificationCategory,
  TeamRole,
} from "./types"

export type Option<T extends string = string> = { value: T; label: string }

export type StatusTone = "primary" | "neutral" | "muted" | "warning" | "danger" | "info"

export type StatusConfig = Record<string, { label: string; tone: StatusTone }>

export const leadStatuses: StatusConfig = {
  novo: { label: "Novo", tone: "info" },
  contatado: { label: "Contatado", tone: "neutral" },
  qualificado: { label: "Qualificado", tone: "neutral" },
  demonstracao: { label: "Demonstração", tone: "warning" },
  negociacao: { label: "Em negociação", tone: "warning" },
  cliente: { label: "Cliente", tone: "primary" },
  perdido: { label: "Perdido", tone: "danger" },
}

export const clientStatuses: StatusConfig = {
  ativo: { label: "Ativo", tone: "primary" },
  inativo: { label: "Inativo", tone: "muted" },
  arquivado: { label: "Arquivado", tone: "muted" },
}

export const conversationStatuses: StatusConfig = {
  aberta: { label: "Aberta", tone: "info" },
  pendente: { label: "Pendente", tone: "warning" },
  em_atendimento: { label: "Em atendimento", tone: "neutral" },
  resolvida: { label: "Resolvida", tone: "muted" },
  fechada: { label: "Fechada", tone: "muted" },
}

export const conversationPriorities: StatusConfig = {
  baixa: { label: "Baixa", tone: "muted" },
  media: { label: "Média", tone: "neutral" },
  alta: { label: "Alta", tone: "warning" },
  urgente: { label: "Urgente", tone: "danger" },
}

export const automationStatuses: StatusConfig = {
  ativa: { label: "Ativa", tone: "primary" },
  pausada: { label: "Pausada", tone: "muted" },
  erro: { label: "Erro", tone: "danger" },
  rascunho: { label: "Rascunho", tone: "warning" },
}

export const agentStatuses: StatusConfig = {
  ativo: { label: "Ativo", tone: "primary" },
  pausado: { label: "Pausado", tone: "muted" },
  configuracao: { label: "Em configuração", tone: "warning" },
}

export const appointmentStatuses: StatusConfig = {
  confirmado: { label: "Confirmado", tone: "primary" },
  pendente: { label: "Pendente", tone: "warning" },
  cancelado: { label: "Cancelado", tone: "danger" },
  concluido: { label: "Concluído", tone: "muted" },
}

export const integrationStatuses: StatusConfig = {
  conectado: { label: "Conectado", tone: "primary" },
  desconectado: { label: "Desconectado", tone: "muted" },
  configuracao_necessaria: { label: "Configuração necessária", tone: "warning" },
  erro: { label: "Erro", tone: "danger" },
}

export const teamStatuses: StatusConfig = {
  ativo: { label: "Ativo", tone: "primary" },
  pendente: { label: "Convite pendente", tone: "warning" },
  inativo: { label: "Inativo", tone: "muted" },
}

export const channels: Record<string, { label: string; icon: LucideIcon }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  instagram: { label: "Instagram", icon: Camera },
  messenger: { label: "Messenger", icon: MessagesSquare },
  website: { label: "Site / Chat", icon: Globe },
  outro: { label: "Outro canal", icon: MessagesSquare },
}

export const leadSources: Option[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "website", label: "Site" },
  { value: "formulario", label: "Formulário" },
  { value: "indicacao", label: "Indicação" },
  { value: "manual", label: "Cadastro manual" },
  { value: "outro", label: "Outro" },
]

export const companySegments: Option[] = [
  { value: "imobiliario", label: "Imobiliário" },
  { value: "juridico", label: "Jurídico" },
  { value: "saude", label: "Saúde" },
  { value: "educacao", label: "Educação" },
  { value: "varejo", label: "Varejo" },
  { value: "servicos", label: "Serviços" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "consultoria", label: "Consultoria" },
  { value: "outro", label: "Outro" },
]

export const planNames: Record<string, string> = {
  trial: "Teste gratuito",
  starter: "Starter",
  profissional: "Profissional",
  enterprise: "Enterprise",
}

/* ---------------------------------- Equipe --------------------------------- */

export const teamRoles: Record<TeamRole, { label: string; description: string }> = {
  administrador: {
    label: "Administrador",
    description: "Acesso total, incluindo faturamento, equipe e integrações.",
  },
  gestor: {
    label: "Gestor",
    description: "Gerencia operação, automações e agentes. Sem acesso ao faturamento.",
  },
  operador: {
    label: "Operador",
    description: "Atende conversas e gerencia leads, clientes e agenda.",
  },
  visualizacao: {
    label: "Visualização",
    description: "Somente leitura em dashboards, relatórios e registros.",
  },
}

export const permissionAreas = [
  { key: "operacao", label: "Conversas, leads e clientes" },
  { key: "automacoes", label: "Automações e agentes IA" },
  { key: "analytics", label: "Analytics e relatórios" },
  { key: "integracoes", label: "Integrações" },
  { key: "equipe", label: "Equipe e permissões" },
  { key: "faturamento", label: "Plano e faturamento" },
] as const

export type PermissionLevel = "total" | "editar" | "ler" | "nenhum"

export const permissionMatrix: Record<TeamRole, Record<(typeof permissionAreas)[number]["key"], PermissionLevel>> = {
  administrador: {
    operacao: "total",
    automacoes: "total",
    analytics: "total",
    integracoes: "total",
    equipe: "total",
    faturamento: "total",
  },
  gestor: {
    operacao: "total",
    automacoes: "editar",
    analytics: "ler",
    integracoes: "ler",
    equipe: "ler",
    faturamento: "nenhum",
  },
  operador: {
    operacao: "editar",
    automacoes: "ler",
    analytics: "ler",
    integracoes: "nenhum",
    equipe: "nenhum",
    faturamento: "nenhum",
  },
  visualizacao: {
    operacao: "ler",
    automacoes: "ler",
    analytics: "ler",
    integracoes: "nenhum",
    equipe: "nenhum",
    faturamento: "nenhum",
  },
}

/** Mapeia os papéis brutos do banco para os papéis de produto. */
export function normalizeRole(rawRole: string | null | undefined): TeamRole {
  switch (rawRole) {
    case "owner":
    case "admin":
    case "administrador":
      return "administrador"
    case "manager":
    case "gestor":
      return "gestor"
    case "viewer":
    case "visualizacao":
      return "visualizacao"
    default:
      return "operador"
  }
}

/* -------------------------------- Automações ------------------------------- */

export const automationTriggers: Record<
  AutomationTriggerType,
  { label: string; description: string; icon: LucideIcon }
> = {
  novo_lead: { label: "Novo lead", description: "Quando um lead é criado em qualquer canal.", icon: UserPlus },
  nova_conversa: {
    label: "Nova conversa",
    description: "Quando uma conversa é iniciada por um contato.",
    icon: MessageSquarePlus,
  },
  mensagem_recebida: {
    label: "Mensagem recebida",
    description: "A cada nova mensagem recebida de um contato.",
    icon: MessageCircle,
  },
  cliente_criado: { label: "Cliente criado", description: "Quando um lead é convertido em cliente.", icon: UserCheck },
  formulario_enviado: {
    label: "Formulário enviado",
    description: "Quando um formulário do site é preenchido.",
    icon: FileText,
  },
  evento_personalizado: {
    label: "Evento personalizado",
    description: "Disparado por um evento externo via API ou webhook.",
    icon: Zap,
  },
}

export const automationConditionFields: Record<AutomationConditionField, { label: string; icon: LucideIcon }> = {
  origem: { label: "Origem", icon: Filter },
  status: { label: "Status", icon: SlidersHorizontal },
  tag: { label: "Tag", icon: Tag },
  horario: { label: "Horário", icon: Clock },
  campo_personalizado: { label: "Campo personalizado", icon: Database },
}

export const automationConditionOperators: Option<AutomationConditionOperator>[] = [
  { value: "igual", label: "é igual a" },
  { value: "diferente", label: "é diferente de" },
  { value: "contem", label: "contém" },
  { value: "entre", label: "está entre" },
]

export const automationActions: Record<
  AutomationActionType,
  { label: string; description: string; icon: LucideIcon; configLabel: string; placeholder: string }
> = {
  enviar_mensagem: {
    label: "Enviar mensagem",
    description: "Envia uma mensagem pelo canal do contato.",
    icon: Send,
    configLabel: "Mensagem",
    placeholder: "Olá! Recebemos seu contato...",
  },
  adicionar_tag: {
    label: "Adicionar tag",
    description: "Adiciona uma tag ao lead, cliente ou conversa.",
    icon: Tag,
    configLabel: "Tag",
    placeholder: "ex.: interessado",
  },
  atualizar_campo: {
    label: "Atualizar campo",
    description: "Altera o valor de um campo do registro.",
    icon: PenLine,
    configLabel: "Campo e valor",
    placeholder: "status = qualificado",
  },
  atribuir_responsavel: {
    label: "Atribuir responsável",
    description: "Define um membro da equipe como responsável.",
    icon: UserRoundCog,
    configLabel: "Responsável",
    placeholder: "Selecionado quando a equipe estiver conectada",
  },
  criar_tarefa: {
    label: "Criar tarefa",
    description: "Cria uma tarefa de acompanhamento.",
    icon: ListTodo,
    configLabel: "Título da tarefa",
    placeholder: "Retornar contato",
  },
  chamar_webhook: {
    label: "Chamar webhook",
    description: "Envia os dados do evento para uma URL externa (n8n, Make...).",
    icon: Webhook,
    configLabel: "URL do webhook",
    placeholder: "https://",
  },
  executar_agente: {
    label: "Executar agente IA",
    description: "Encaminha o contato para um agente de IA.",
    icon: Bot,
    configLabel: "Agente",
    placeholder: "Selecionado quando houver agentes",
  },
}

/* -------------------------------- Agentes IA ------------------------------- */

export const agentTones: Option<AgentTone>[] = [
  { value: "formal", label: "Formal" },
  { value: "consultivo", label: "Consultivo" },
  { value: "amigavel", label: "Amigável" },
  { value: "objetivo", label: "Objetivo" },
]

export const weekDays: Option<string>[] = [
  { value: "1", label: "Seg" },
  { value: "2", label: "Ter" },
  { value: "3", label: "Qua" },
  { value: "4", label: "Qui" },
  { value: "5", label: "Sex" },
  { value: "6", label: "Sáb" },
  { value: "0", label: "Dom" },
]

/* --------------------------- Agente de Agendamento -------------------------- */

export const schedulingBehaviorOptions: {
  key: keyof SchedulingAgentBehavior
  label: string
  description: string
  group: "agenda" | "dados"
}[] = [
  {
    key: "offerAvailableSlots",
    label: "Oferecer horários disponíveis",
    description: "O agente sugere horários livres com base no horário de funcionamento e nos serviços.",
    group: "agenda",
  },
  {
    key: "allowConfirmation",
    label: "Confirmar agendamentos",
    description: "O agente pode confirmar o horário escolhido diretamente com o cliente.",
    group: "agenda",
  },
  {
    key: "allowCancellation",
    label: "Permitir cancelamento",
    description: "O cliente pode cancelar um agendamento existente pela conversa.",
    group: "agenda",
  },
  {
    key: "allowRescheduling",
    label: "Permitir reagendamento",
    description: "O cliente pode mover um agendamento para outro horário disponível.",
    group: "agenda",
  },
  { key: "askName", label: "Solicitar nome", description: "Pedir o nome completo antes de agendar.", group: "dados" },
  { key: "askPhone", label: "Solicitar telefone", description: "Pedir um telefone de contato.", group: "dados" },
  { key: "askEmail", label: "Solicitar e-mail", description: "Pedir um e-mail para enviar a confirmação.", group: "dados" },
]

export const businessWeekdays: { key: WeekdayKey; label: string; short: string }[] = [
  { key: "segunda", label: "Segunda-feira", short: "Seg" },
  { key: "terca", label: "Terça-feira", short: "Ter" },
  { key: "quarta", label: "Quarta-feira", short: "Qua" },
  { key: "quinta", label: "Quinta-feira", short: "Qui" },
  { key: "sexta", label: "Sexta-feira", short: "Sex" },
  { key: "sabado", label: "Sábado", short: "Sáb" },
  { key: "domingo", label: "Domingo", short: "Dom" },
]

export const appointmentBufferOptions: Option<string>[] = [
  { value: "0", label: "Sem intervalo" },
  { value: "5", label: "5 minutos" },
  { value: "10", label: "10 minutos" },
  { value: "15", label: "15 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "60", label: "60 minutos" },
]

export const serviceDurationOptions: Option<string>[] = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 h" },
  { value: "90", label: "1 h 30 min" },
  { value: "120", label: "2 h" },
]

export const aiAgentCatalog: Record<
  AIAgentType,
  { name: string; description: string; icon: LucideIcon; highlights: string[] }
> = {
  atendimento: {
    name: "Agente de Atendimento",
    description: "Responde dúvidas frequentes e direciona o cliente para a equipe certa.",
    icon: MessagesSquare,
    highlights: ["Responde com a sua base de conhecimento", "Segue as regras e o tom definidos", "Transfere para a equipe quando precisar"],
  },
  vendas: {
    name: "Agente de Vendas",
    description: "Qualifica leads e conduz o contato até a proposta.",
    icon: Zap,
    highlights: ["Apresenta apenas os seus produtos e serviços", "Qualifica o interesse do contato", "Trata objeções com a sua abordagem"],
  },
  suporte: {
    name: "Agente de Suporte",
    description: "Resolve solicitações de suporte e abre chamados quando necessário.",
    icon: UserRoundCog,
    highlights: ["Segue os procedimentos cadastrados", "Guia o cliente passo a passo", "Encaminha o que não conseguir resolver"],
  },
}

export const aiAgentTones: Option<AIAgentTone>[] = [
  { value: "profissional", label: "Profissional" },
  { value: "amigavel", label: "Amigável" },
  { value: "direto", label: "Direto" },
  { value: "personalizado", label: "Personalizado" },
]

/* ------------------------------- Integrações ------------------------------- */

export type IntegrationField = {
  key: string
  label: string
  placeholder?: string
  type?: "text" | "password" | "url"
}

export type IntegrationDefinition = {
  provider: string
  name: string
  description: string
  category: IntegrationCategory
  icon: LucideIcon
  available: boolean
  fields: IntegrationField[]
}

export const integrationCategories: Record<IntegrationCategory, { label: string; description: string }> = {
  comunicacao: { label: "Comunicação", description: "Canais por onde seus contatos conversam com a empresa." },
  automacao: { label: "Automação", description: "Ferramentas de orquestração e envio de eventos." },
  ia: { label: "Inteligência Artificial", description: "Provedores de modelos usados pelos agentes." },
  crm: { label: "CRM", description: "Sincronização com sistemas de gestão de clientes." },
}

export const integrationCatalog: IntegrationDefinition[] = [
  {
    provider: "whatsapp",
    name: "WhatsApp",
    description: "Receba e responda mensagens do WhatsApp Business.",
    category: "comunicacao",
    icon: MessageCircle,
    available: true,
    fields: [
      { key: "phone", label: "Número do WhatsApp Business", placeholder: "+55 11 90000-0000" },
      { key: "accountId", label: "ID da conta (WABA)" },
      { key: "token", label: "Token de acesso", type: "password" },
    ],
  },
  {
    provider: "instagram",
    name: "Instagram",
    description: "Atenda mensagens diretas e comentários do Instagram.",
    category: "comunicacao",
    icon: Camera,
    available: true,
    fields: [{ key: "account", label: "Conta profissional", placeholder: "@suaempresa" }],
  },
  {
    provider: "messenger",
    name: "Messenger",
    description: "Converse com contatos da sua página no Facebook.",
    category: "comunicacao",
    icon: MessagesSquare,
    available: true,
    fields: [{ key: "page", label: "Página do Facebook" }],
  },
  {
    provider: "website",
    name: "Website",
    description: "Widget de chat para o site da sua empresa.",
    category: "comunicacao",
    icon: Globe,
    available: true,
    fields: [{ key: "domain", label: "Domínio do site", placeholder: "www.suaempresa.com.br", type: "url" }],
  },
  {
    provider: "n8n",
    name: "n8n",
    description: "Conecte fluxos de automação hospedados no n8n.",
    category: "automacao",
    icon: Workflow,
    available: true,
    fields: [
      { key: "baseUrl", label: "URL da instância", placeholder: "https://", type: "url" },
      { key: "apiKey", label: "Chave de API", type: "password" },
    ],
  },
  {
    provider: "make",
    name: "Make",
    description: "Integre cenários do Make à sua operação.",
    category: "automacao",
    icon: Blocks,
    available: true,
    fields: [{ key: "webhookUrl", label: "URL do webhook", placeholder: "https://hook.make.com/...", type: "url" }],
  },
  {
    provider: "webhooks",
    name: "Webhooks",
    description: "Envie eventos da plataforma para qualquer sistema.",
    category: "automacao",
    icon: Webhook,
    available: true,
    fields: [
      { key: "url", label: "URL de destino", placeholder: "https://", type: "url" },
      { key: "secret", label: "Segredo de assinatura", type: "password" },
    ],
  },
  {
    provider: "openai",
    name: "OpenAI",
    description: "Modelos de linguagem para os agentes de IA.",
    category: "ia",
    icon: Sparkles,
    available: true,
    fields: [{ key: "apiKey", label: "Chave de API", type: "password" }],
  },
  {
    provider: "outros_ia",
    name: "Outros provedores",
    description: "Suporte a provedores adicionais de IA.",
    category: "ia",
    icon: Cpu,
    available: false,
    fields: [],
  },
  {
    provider: "crm",
    name: "CRMs externos",
    description: "Sincronização de leads e clientes com CRMs de mercado.",
    category: "crm",
    icon: Contact,
    available: false,
    fields: [],
  },
]

/* ------------------------------ Notificações ------------------------------- */

export const notificationCategories: Record<NotificationCategory, { label: string }> = {
  sistema: { label: "Sistema" },
  automacoes: { label: "Automações" },
  integracoes: { label: "Integrações" },
  equipe: { label: "Equipe" },
  seguranca: { label: "Segurança" },
}

export function notificationCategoryFromType(type: string | null | undefined): NotificationCategory {
  switch (type) {
    case "automacao":
    case "automacoes":
      return "automacoes"
    case "integracao":
    case "integracoes":
      return "integracoes"
    case "equipe":
    case "membro":
      return "equipe"
    case "seguranca":
    case "login":
      return "seguranca"
    default:
      return "sistema"
  }
}

/* --------------------------------- Helpers --------------------------------- */

export function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function labelFrom(options: Option[], value: string | null | undefined): string {
  if (!value) return "—"
  return options.find((o) => o.value === value)?.label ?? humanize(value)
}

export function channelLabel(channel: string | null | undefined): string {
  if (!channel) return "—"
  return channels[channel]?.label ?? humanize(channel)
}
