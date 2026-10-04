import { Bot, PlusIcon } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PendingActionButton } from "@/components/shared/pending-action-button"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getAgents } from "@/lib/data/queries"
import { agentTones, channelLabel, labelFrom } from "@/lib/domain/catalogs"
import { formatNumber, formatRelativeTime } from "@/lib/format"

export default async function AgentesPage() {
  const { data: agents, error } = await getAgents()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agentes de IA"
        description="Assistentes que atendem, qualificam e agendam pelos seus canais"
        actions={
          <PendingActionButton action="Criar agente">
            <PlusIcon data-icon="inline-start" />
            Novo agente
          </PendingActionButton>
        }
      />

      {error ? (
        <ErrorState description={error} />
      ) : agents.length === 0 ? (
        <EmptyState icon={Bot} title="Nenhum agente configurado" description="Crie um agente para começar a automatizar o atendimento." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <CardTitle className="truncate">{agent.name}</CardTitle>
                  <CardDescription className="line-clamp-2 text-pretty">
                    {agent.objective ?? agent.description ?? "Sem objetivo definido"}
                  </CardDescription>
                </div>
                <StatusBadge kind="agent" status={agent.status} />
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap gap-1">
                  {agent.channels.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Nenhum canal</span>
                  ) : (
                    agent.channels.map((channel) => (
                      <Badge key={channel} variant="secondary" className="font-normal">
                        {channelLabel(channel)}
                      </Badge>
                    ))
                  )}
                </div>
                {agent.tone && (
                  <p className="text-sm text-muted-foreground">Tom: {labelFrom(agentTones, agent.tone)}</p>
                )}
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>{formatNumber(agent.conversationsCount)} conversas</span>
                <span>{agent.lastActivityAt ? formatRelativeTime(agent.lastActivityAt) : "Sem atividade"}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
