import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { agentTones, channelLabel, labelFrom } from "@/lib/domain/catalogs"
import type { AIAgent } from "@/lib/domain/types"
import { formatNumber, formatRelativeTime } from "@/lib/format"

export function AgentList({ agents }: { agents: AIAgent[] }) {
  return (
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
            {agent.tone && <p className="text-sm text-muted-foreground">Tom: {labelFrom(agentTones, agent.tone)}</p>}
          </CardContent>
          <CardFooter className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{formatNumber(agent.conversationsCount)} conversas</span>
            <span>{agent.lastActivityAt ? formatRelativeTime(agent.lastActivityAt) : "Sem atividade"}</span>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
