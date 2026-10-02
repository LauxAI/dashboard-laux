import { Bot, MessagesSquare, Users, Workflow } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { WeeklyActivityChart } from "@/components/dashboard/weekly-activity-chart"
import { FunnelChart } from "@/components/dashboard/funnel-chart"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { LeadStatusBadge } from "@/components/shared/status-badge"
import { demoLeads } from "@/lib/demo-data"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const recentLeads = demoLeads.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral do atendimento e das vendas da sua empresa"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Conversas ativas"
          value="358"
          trend={{ value: "+12% esta semana", direction: "up" }}
          icon={MessagesSquare}
        />
        <StatCard
          label="Leads qualificados"
          value="176"
          trend={{ value: "+8% esta semana", direction: "up" }}
          icon={Users}
        />
        <StatCard label="Agentes de IA ativos" value="3" trend={{ value: "de 4 configurados", direction: "up" }} icon={Bot} />
        <StatCard
          label="Automações em execução"
          value="5"
          trend={{ value: "98% de sucesso", direction: "up" }}
          icon={Workflow}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyActivityChart />
        <FunnelChart />
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
            {recentLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between gap-4 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium leading-none text-foreground">{lead.nome}</p>
                  <p className="text-sm text-muted-foreground">{lead.empresa}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden text-xs text-muted-foreground sm:inline">{lead.ultimaInteracao}</span>
                  <LeadStatusBadge status={lead.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <RecentActivity />
      </div>
    </div>
  )
}
