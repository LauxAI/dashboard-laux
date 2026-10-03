import { ChannelChart } from "@/components/dashboard/channel-chart"
import { FunnelChart } from "@/components/dashboard/funnel-chart"
import { WeeklyActivityChart } from "@/components/dashboard/weekly-activity-chart"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { getAnalytics } from "@/lib/data/queries"
import { MessageSquareIcon, TargetIcon, TrendingUpIcon, UsersIcon } from "lucide-react"

export default async function AnalyticsPage() {
  const analytics = await getAnalytics()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Métricas de atendimento, conversão e desempenho dos agentes de IA"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Taxa de conversão"
          value={`${analytics.conversionRate.toFixed(1)}%`}
          icon={TrendingUpIcon}
        />
        <StatCard
          label="Total de leads"
          value={analytics.totalLeads.toString()}
          icon={UsersIcon}
        />
        <StatCard
          label="Conversas resolvidas"
          value={`${analytics.resolvedRate.toFixed(1)}%`}
          icon={MessageSquareIcon}
        />
        <StatCard
          label="Leads qualificados"
          value={analytics.qualifiedLeads.toString()}
          icon={TargetIcon}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyActivityChart data={analytics.weekly} />
        <FunnelChart data={analytics.funnel} />
      </div>

      <ChannelChart leads={analytics.leads} />
    </div>
  )
}
