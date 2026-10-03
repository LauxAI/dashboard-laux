import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PageHeader } from "@/components/shared/page-header"
import { AutomationStatusBadge } from "@/components/shared/status-badge"
import { getAutomations } from "@/lib/data/queries"
import { PlusIcon, WorkflowIcon } from "lucide-react"

export default async function AutomacoesPage() {
  const automations = await getAutomations()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Automações"
        description="Fluxos automáticos que atendem, qualificam e dão seguimento aos seus leads"
        actions={
          <Button>
            <PlusIcon data-icon="inline-start" />
            Nova automação
          </Button>
        }
      />

      {automations.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WorkflowIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma automação ainda</EmptyTitle>
            <EmptyDescription>Crie fluxos automáticos para atender e qualificar seus leads.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {automations.map((automation) => (
            <Card key={automation.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{automation.name}</CardTitle>
                  <Switch defaultChecked={automation.status === "ativa"} />
                </div>
                <CardDescription>{automation.description ?? "Sem descrição"}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <AutomationStatusBadge status={automation.status as "ativa" | "pausada" | "erro" | "rascunho"} />
              </CardContent>
              <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{automation.executions_count.toLocaleString("pt-BR")} execuções</span>
                <span>{automation.trigger ?? "Sem gatilho definido"}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
