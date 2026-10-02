import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { DemoBanner } from "@/components/shared/demo-banner"
import { PageHeader } from "@/components/shared/page-header"
import { AgentStatusBadge } from "@/components/shared/status-badge"
import { demoAgents } from "@/lib/demo-data"
import { BotIcon, PlusIcon } from "lucide-react"

export default function AgentesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agentes IA"
        description="Agentes de inteligência artificial responsáveis pelo atendimento da sua empresa"
        actions={
          <Button>
            <PlusIcon data-icon="inline-start" />
            Novo agente
          </Button>
        }
      />

      <DemoBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {demoAgents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BotIcon className="size-5" />
                  </div>
                  <div className="flex flex-col">
                    <CardTitle className="text-base">{agent.nome}</CardTitle>
                    <span className="text-xs text-muted-foreground">{agent.canal}</span>
                  </div>
                </div>
                <AgentStatusBadge status={agent.status} />
              </div>
              <CardDescription className="pt-2">{agent.objetivo}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Modelo</span>
                <span className="font-medium text-foreground">{agent.modelo}</span>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Última atividade: {agent.ultimaAtividade}</span>
              <Button variant="ghost" size="sm">
                Configurar
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
