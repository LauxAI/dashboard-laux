import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PageHeader } from "@/components/shared/page-header"
import { AgentStatusBadge } from "@/components/shared/status-badge"
import { getAiAgents } from "@/lib/data/queries"
import { BotIcon, PlusIcon } from "lucide-react"

export default async function AgentesPage() {
  const agents = await getAiAgents()

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

      {agents.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BotIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum agente configurado</EmptyTitle>
            <EmptyDescription>Crie um agente de IA para atender seus clientes automaticamente.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BotIcon className="size-5" />
                    </div>
                    <div className="flex flex-col">
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <span className="text-xs text-muted-foreground">{agent.channel ?? "Canal não definido"}</span>
                    </div>
                  </div>
                  <AgentStatusBadge status={agent.status as "ativo" | "pausado" | "configuracao"} />
                </div>
                <CardDescription className="pt-2">{agent.description ?? "Sem descrição"}</CardDescription>
              </CardHeader>
              <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{agent.conversations_count.toLocaleString("pt-BR")} conversas atendidas</span>
                <Button variant="ghost" size="sm">
                  Configurar
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
