import Link from "next/link"
import { ArrowRight, Bot, MessagesSquare, Users, Workflow } from "lucide-react"
import { FunnelChart, type FunnelPoint } from "@/components/dashboard/funnel-chart"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { WeeklyActivityChart, type WeeklyActivityPoint } from "@/components/dashboard/weekly-activity-chart"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getActivities, getAgents, getAutomations, getConversations, getLeads } from "@/lib/data/queries"
import { leadStatuses } from "@/lib/domain/catalogs"
import { formatRelativeTime } from "@/lib/format"

const FUNNEL_STAGES = ["novo", "contatado", "qualificado", "demonstracao", "negociacao", "cliente"] as const
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function countInRange(items: { createdAt: string }[], start: Date, end: Date) {
  return items.filter((item) => {
    const created = new Date(item.createdAt)
    return created >= start && created < end
  }).length
}

export default async function DashboardPage() {
  const [leadsResult, conversationsResult, agentsResult, automationsResult, activitiesResult] = await Promise.all([
    getLeads(),
    getConversations(),
    getAgents(),
    getAutomations(),
    getActivities(),
  ])

  const leads = leadsResult.data
  const conversations = conversationsResult.data
  const agents = agentsResult.data
  const automations = automationsResult.data

  const activeConversations = conversations.filter((c) => c.status !== "resolvida").length
  const activeAgents = agents.filter((a) => a.status === "ativo").length
  const runningAutomations = automations.filter((a) => a.status === "ativa").length

  const funnelData: FunnelPoint[] = FUNNEL_STAGES.map((status) => ({
    etapa: leadStatuses[status].label,
    valor: leads.filter((lead) => lead.status === status).length,
  })).filter((point) => point.valor > 0)

  const now = new Date()
  const weeklyData: WeeklyActivityPoint[] = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now)
    day.setDate(now.getDate() - (6 - index))
    day.setHours(0, 0, 0, 0)
    const nextDay = new Date(day)
    nextDay.setDate(day.getDate() + 1)
    return {
      dia: WEEKDAY_LABELS[day.getDay()],
      conversas: countInRange(conversations, day, nextDay),
      leads: countInRange(leads, day, nextDay),
      conversoes: countInRange(
        leads.filter((lead) => lead.status === "cliente"),
        day,
        nextDay,
      ),
    }
  })
  const hasWeeklyActivity = weeklyData.some((d) => d.conversas > 0 || d.leads > 0)
  const recentLeads = leads.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Visão geral do atendimento e das vendas da sua empresa" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Conversas em aberto" value={String(activeConversations)} icon={MessagesSquare} />
        <StatCard label="Leads recebidos" value={String(leads.length)} icon={Users} />
        <StatCard label="Agentes de IA ativos" value={`${activeAgents} de ${agents.length}`} icon={Bot} />
        <StatCard label="Automações ativas" value={`${runningAutomations} de ${automations.length}`} icon={Workflow} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyActivityChart data={hasWeeklyActivity ? weeklyData : []} />
        <FunnelChart data={funnelData} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Leads recentes</CardTitle>
              <CardDescription>Os últimos leads recebidos pelos seus canais</CardDescription>
            </div>
            <Button variant="ghost" size="sm" render={<Link href="/leads" />} nativeButton={false}>
              Ver todos
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {recentLeads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum lead ainda"
                description="Os leads recebidos aparecerão aqui."
                className="border-0"
              />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {recentLeads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">{lead.name}</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(lead.createdAt)}</span>
                    </div>
                    <StatusBadge kind="lead" status={lead.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <RecentActivity activities={activitiesResult.data} />
      </div>
    </div>
  )
}
