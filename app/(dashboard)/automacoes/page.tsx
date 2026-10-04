import { PlusIcon, Workflow } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PendingActionButton } from "@/components/shared/pending-action-button"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState, ErrorState } from "@/components/states/states"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getAutomations } from "@/lib/data/queries"
import { automationActions, automationTriggers } from "@/lib/domain/catalogs"
import type { Automation } from "@/lib/domain/types"
import { formatNumber, formatRelativeTime } from "@/lib/format"

function triggerText(automation: Automation) {
  if (automation.trigger) return automationTriggers[automation.trigger.type]?.label ?? automation.trigger.type
  return automation.triggerLabel ?? "Gatilho não definido"
}

export default async function AutomacoesPage() {
  const { data: automations, error } = await getAutomations()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Automações"
        description="Fluxos que reagem a eventos e executam ações automaticamente"
        actions={
          <PendingActionButton action="Criar automação">
            <PlusIcon data-icon="inline-start" />
            Nova automação
          </PendingActionButton>
        }
      />

      {error ? (
        <ErrorState description={error} />
      ) : automations.length === 0 ? (
        <EmptyState icon={Workflow} title="Nenhuma automação" description="Crie um fluxo para responder a novos leads e conversas." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {automations.map((automation) => (
            <Card key={automation.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <CardTitle className="truncate">{automation.name}</CardTitle>
                  <CardDescription className="line-clamp-2 text-pretty">
                    {automation.description ?? "Sem descrição"}
                  </CardDescription>
                </div>
                <StatusBadge kind="automation" status={automation.status} />
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Quando: </span>
                  <span className="text-foreground">{triggerText(automation)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Então: </span>
                  <span className="text-foreground">
                    {automation.actions.length === 0
                      ? "Nenhuma ação"
                      : automation.actions.map((action) => automationActions[action.type]?.label ?? action.type).join(", ")}
                  </span>
                </p>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>{formatNumber(automation.executionsCount)} execuções</span>
                <span>{automation.lastRunAt ? formatRelativeTime(automation.lastRunAt) : "Nunca executada"}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
