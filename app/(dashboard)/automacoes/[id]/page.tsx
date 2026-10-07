import { notFound } from "next/navigation"
import { AutomationBuilder } from "@/components/automations/automation-builder"
import { RunHistory } from "@/components/automations/run-history"
import { ErrorState } from "@/components/states/states"
import { getAutomation, getReadiness, isUuid, listRuns } from "@/lib/automations/queries"

export const dynamic = "force-dynamic"

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const [automation, readiness, runs] = await Promise.all([
    getAutomation(id),
    getReadiness(),
    listRuns({ automationId: id, limit: 10 }),
  ])

  if (automation.error !== null) return <ErrorState description={automation.error} />
  if (!automation.data) notFound()

  return (
    <div className="flex flex-col gap-8">
      <AutomationBuilder automation={automation.data} readiness={readiness} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Últimas execuções</h2>
        {runs.error !== null ? (
          <p className="text-sm text-destructive">{runs.error}</p>
        ) : runs.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta automação ainda não foi executada.</p>
        ) : (
          <RunHistory runs={runs.data} showAutomationName={false} />
        )}
      </section>
    </div>
  )
}
