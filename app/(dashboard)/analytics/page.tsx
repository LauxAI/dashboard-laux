import { MessageSquareIcon, TargetIcon, TrendingUpIcon, UsersIcon } from "lucide-react"
import { ChannelChart } from "@/components/dashboard/channel-chart"
import { FunnelChart, type FunnelPoint } from "@/components/dashboard/funnel-chart"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { ErrorState } from "@/components/states/states"
import { getConversations, getLeads } from "@/lib/data/queries"
import { leadStatuses } from "@/lib/domain/catalogs"
import { formatCurrencyBRL, formatNumber, formatPercent } from "@/lib/format"

export default async function AnalyticsPage() {
  const [leadsResult, conversationsResult] = await Promise.all([getLeads(), getConversations()])
  const leads = leadsResult.data
  const conversations = conversationsResult.data

  const converted = leads.filter((lead) => lead.status === "cliente")
  const conversionRate = leads.length > 0 ? (converted.length / leads.length) * 100 : 0
  const pipelineValue = leads
    .filter((lead) => lead.status !== "perdido" && lead.status !== "cliente")
    .reduce((sum, lead) => sum + (lead.value ?? 0), 0)

  const funnelData: FunnelPoint[] = Object.entries(leadStatuses)
    .map(([status, { label }]) => ({ etapa: label, valor: leads.filter((lead) => lead.status === status).length }))
    .filter((point) => point.valor > 0)

  const error = leadsResult.error ?? conversationsResult.error

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" description="Métricas de atendimento, conversão e pipeline" />
      {error && <ErrorState description={error} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Taxa de conversão" value={formatPercent(conversionRate)} icon={TrendingUpIcon} />
        <StatCard label="Total de leads" value={formatNumber(leads.length)} icon={UsersIcon} />
        <StatCard label="Conversas" value={formatNumber(conversations.length)} icon={MessageSquareIcon} />
        <StatCard label="Pipeline em aberto" value={formatCurrencyBRL(pipelineValue)} icon={TargetIcon} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelChart data={funnelData} />
        <ChannelChart leads={leads} />
      </div>
    </div>
  )
}
