import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  agentStatuses,
  appointmentStatuses,
  automationStatuses,
  clientStatuses,
  conversationPriorities,
  conversationStatuses,
  humanize,
  integrationStatuses,
  leadStatuses,
  teamStatuses,
  type StatusConfig,
  type StatusTone,
} from "@/lib/domain/catalogs"

const configs = {
  lead: leadStatuses,
  client: clientStatuses,
  conversation: conversationStatuses,
  priority: conversationPriorities,
  automation: automationStatuses,
  agent: agentStatuses,
  appointment: appointmentStatuses,
  integration: integrationStatuses,
  team: teamStatuses,
} satisfies Record<string, StatusConfig>

export type StatusKind = keyof typeof configs

const toneDot: Record<StatusTone, string> = {
  primary: "bg-primary",
  info: "bg-chart-2",
  neutral: "bg-foreground/60",
  muted: "bg-muted-foreground/50",
  warning: "bg-chart-4",
  danger: "bg-destructive",
}

/** Badge de status tolerante: valores desconhecidos viram um rótulo legível em vez de quebrar. */
export function StatusBadge({
  kind,
  status,
  className,
}: {
  kind: StatusKind
  status: string | null | undefined
  className?: string
}) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>
  const config = configs[kind][status] ?? { label: humanize(status), tone: "neutral" as StatusTone }
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", toneDot[config.tone])} />
      {config.label}
    </Badge>
  )
}
