import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { DemoBanner } from "@/components/shared/demo-banner"
import { PageHeader } from "@/components/shared/page-header"
import { AutomationStatusBadge } from "@/components/shared/status-badge"
import { demoAutomations } from "@/lib/demo-data"
import { PlusIcon } from "lucide-react"

export default function AutomacoesPage() {
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

      <DemoBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {demoAutomations.map((automation) => (
          <Card key={automation.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{automation.nome}</CardTitle>
                <Switch defaultChecked={automation.status === "ativa"} />
              </div>
              <CardDescription>{automation.descricao}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <AutomationStatusBadge status={automation.status} />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Taxa de sucesso</span>
                  <span className="font-medium text-foreground">{automation.taxaSucesso}%</span>
                </div>
                <Progress value={automation.taxaSucesso} />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{automation.execucoes.toLocaleString("pt-BR")} execuções</span>
              <span>Última: {automation.ultimaExecucao}</span>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
