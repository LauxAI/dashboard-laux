import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  AgentStatus,
  AppointmentStatus,
  AutomationStatus,
  ConversationStatus,
  IntegrationStatus,
  LeadStatus,
  TeamMember,
} from "@/lib/types"

const dotClasses = "size-1.5 rounded-full"

function DotBadge({
  label,
  colorClass,
}: {
  label: string
  colorClass: string
}) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className={cn(dotClasses, colorClass)} />
      {label}
    </Badge>
  )
}

const leadStatusMap: Record<LeadStatus, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-muted-foreground" },
  contatado: { label: "Contatado", color: "bg-chart-2" },
  qualificado: { label: "Qualificado", color: "bg-chart-3" },
  demonstracao: { label: "Demonstração", color: "bg-chart-4" },
  negociacao: { label: "Em negociação", color: "bg-chart-5" },
  cliente: { label: "Cliente", color: "bg-primary" },
  perdido: { label: "Perdido", color: "bg-destructive" },
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const config = leadStatusMap[status]
  return <DotBadge label={config.label} colorClass={config.color} />
}

const conversationStatusMap: Record<ConversationStatus, { label: string; color: string }> = {
  nao_lida: { label: "Não lida", color: "bg-chart-5" },
  em_atendimento: { label: "Em atendimento", color: "bg-chart-2" },
  ia: { label: "Com a IA", color: "bg-primary" },
  humano: { label: "Com humano", color: "bg-chart-3" },
  resolvida: { label: "Resolvida", color: "bg-muted-foreground" },
}

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  const config = conversationStatusMap[status]
  return <DotBadge label={config.label} colorClass={config.color} />
}

const automationStatusMap: Record<AutomationStatus, { label: string; color: string }> = {
  ativa: { label: "Ativa", color: "bg-primary" },
  pausada: { label: "Pausada", color: "bg-muted-foreground" },
  erro: { label: "Erro", color: "bg-destructive" },
  rascunho: { label: "Rascunho", color: "bg-chart-4" },
}

export function AutomationStatusBadge({ status }: { status: AutomationStatus }) {
  const config = automationStatusMap[status]
  return <DotBadge label={config.label} colorClass={config.color} />
}

const agentStatusMap: Record<AgentStatus, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-primary" },
  pausado: { label: "Pausado", color: "bg-muted-foreground" },
  configuracao: { label: "Em configuração", color: "bg-chart-4" },
}

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const config = agentStatusMap[status]
  return <DotBadge label={config.label} colorClass={config.color} />
}

const appointmentStatusMap: Record<AppointmentStatus, { label: string; color: string }> = {
  confirmado: { label: "Confirmado", color: "bg-primary" },
  pendente: { label: "Pendente", color: "bg-chart-4" },
  cancelado: { label: "Cancelado", color: "bg-destructive" },
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const config = appointmentStatusMap[status]
  return <DotBadge label={config.label} colorClass={config.color} />
}

const integrationStatusMap: Record<IntegrationStatus, { label: string; color: string }> = {
  conectado: { label: "Conectado", color: "bg-primary" },
  nao_conectado: { label: "Não conectado", color: "bg-muted-foreground" },
  configuracao_necessaria: { label: "Configuração necessária", color: "bg-chart-4" },
  erro: { label: "Erro", color: "bg-destructive" },
}

export function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  const config = integrationStatusMap[status]
  return <DotBadge label={config.label} colorClass={config.color} />
}

const teamStatusMap: Record<TeamMember["status"], { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-primary" },
  pendente: { label: "Convite pendente", color: "bg-chart-4" },
  inativo: { label: "Inativo", color: "bg-muted-foreground" },
}

export function TeamStatusBadge({ status }: { status: TeamMember["status"] }) {
  const config = teamStatusMap[status]
  return <DotBadge label={config.label} colorClass={config.color} />
}
