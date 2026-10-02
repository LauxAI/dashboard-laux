import { ChannelChart } from "@/components/dashboard/channel-chart"
import { FunnelChart } from "@/components/dashboard/funnel-chart"
import { WeeklyActivityChart } from "@/components/dashboard/weekly-activity-chart"
import { DemoBanner } from "@/components/shared/demo-banner"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { MessageSquareIcon, TargetIcon, TimerIcon, TrendingUpIcon } from "lucide-react"

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Métricas de atendimento, conversão e desempenho dos agentes de IA"
      />

      <DemoBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Taxa de conversão"
          value="11,4%"
          icon={TrendingUpIcon}
          trend={{ value: "+2,1pp esta semana", direction: "up" }}
        />
        <StatCard
          label="Tempo médio de resposta"
          value="38s"
          icon={TimerIcon}
          trend={{ value: "-6s esta semana", direction: "up" }}
        />
        <StatCard
          label="Conversas resolvidas pela IA"
          value="82%"
          icon={MessageSquareIcon}
          trend={{ value: "+4pp esta semana", direction: "up" }}
        />
        <StatCard
          label="Leads qualificados"
          value="176"
          icon={TargetIcon}
          trend={{ value: "+8% esta semana", direction: "up" }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyActivityChart />
        <FunnelChart />
      </div>

      <ChannelChart />
    </div>
  )
}
