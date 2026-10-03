import { Bot, MessagesSquare, Users, Workflow } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { WeeklyActivityChart, type WeeklyActivityPoint } from "@/components/dashboard/weekly-activity-chart"
import { FunnelChart, type FunnelPoint } from "@/components/dashboard/funnel-chart"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { LeadStatusBadge } from "@/components/shared/status-badge"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getLeads, getConversations, getAiAgents, getAutomations, getActivities } from "@/lib/data/queries"

const FUNNEL_STAGES: { status: string; label: string }[] = [
  { status: "novo", label: "Novo" },
  { status: "contatado", label: "Contatado" },
  { status: "qualificado", label: "Qualificado" },
  { status: "demonstracao", label: "Demonstração" },
  { status: "negociacao", label: "Em negociação" },
  { status: "cliente", label: "Cliente" },
]

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export default async function DashboardPage() {
  const [leads, conversations, aiAgents, automations, activities] = await Promise.all([
    getLeads(),
    getConversations(),
    getAiAgents(),
    getAutomations(),
    getActivities(),
  ])

  const recentLeads = leads.slice(0, 5)
  const activeConversations = conversations.filter((c) => c.status !== "fechada").length
  const activeAgents = aiAgents.filter((a) => a.status === "ativo").length
  const runningAutomations = automations.filter((a) => a.status === "ativa").length

  const funnelData: FunnelPoint[] = FUNNEL_STAGES.map(({ status, label }) => ({
    etapa: label,
    valor: leads.filter((lead) => lead.status === status).length,
  })).filter((point) => point.valor > 0)

  const now = new Date()
  const weeklyData: WeeklyActivityPoint[] = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now)
    day.setDate(now.getDate() - (6 - index))
    day.setHours(0, 0, 0, 0)
    const nextDay = new Date(day)
    nextDay.setDate(day.getDate() + 1)

    const leadsCount = leads.filter((l) => {
      const created = new Date(l.created_at)
      return created >= day && created < nextDay
    }).length
    const conversationsCount = conversations.filter((c) => {
      const created = new Date(c.created_at)
      return created >= day && created < nextDay
    }).length

    return {
      dia: WEEKDAY_LABELS[day.getDay()],
      conversas: conversationsCount,
      leads: leadsCount,
      conversoes: 0,
    }
  })
  const hasWeeklyActivity = weeklyData.some((d) => d.conversas > 0 || d.leads > 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral do atendimento e das vendas da sua empresa"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Conversas ativas" value={String(activeConversations)} icon={MessagesSquare} />
        <StatCard label="Leads recebidos" value={String(leads.length)} icon={Users} />
        <StatCard
          label="Agentes de IA ativos"
          value={String(activeAgents)}
          trend={{ value: `de ${aiAgents.length} configurados`, direction: "up" }}
          icon={Bot}
        />
        <StatCard label="Automações em execução" value={String(runningAutomations)} icon={Workflow} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyActivityChart data={hasWeeklyActivity ? weeklyData : []} />
        <FunnelChart data={funnelData} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
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
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum lead ainda</EmptyTitle>
                  <EmptyDescription>Os leads recebidos pelos seus canais aparecem aqui.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between gap-4 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium leading-none text-foreground">{lead.name}</p>
                    <p className="text-sm text-muted-foreground">{lead.source || "Origem não informada"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <LeadStatusBadge status={lead.status} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <RecentActivity activities={activities} />
      </div>
    </div>
  )
}
