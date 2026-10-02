import type { ComponentType } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { DemoBanner } from "@/components/shared/demo-banner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { demoNotifications } from "@/lib/demo-data"
import {
  BellIcon,
  CalendarIcon,
  MessageSquareIcon,
  PlugIcon,
  UserPlusIcon,
  ZapIcon,
} from "lucide-react"

const tipoIcon: Record<string, ComponentType<{ className?: string }>> = {
  lead: UserPlusIcon,
  agendamento: CalendarIcon,
  automacao: ZapIcon,
  integracao: PlugIcon,
  conversa: MessageSquareIcon,
}

export default function NotificacoesPage() {
  const naoLidas = demoNotifications.filter((n) => !n.lida).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notificações"
        description={`Você tem ${naoLidas} notificações não lidas`}
        actions={<Button variant="outline">Marcar todas como lidas</Button>}
      />

      <DemoBanner />

      <div className="flex flex-col gap-2">
        {demoNotifications.map((notification) => {
          const Icon = tipoIcon[notification.tipo] ?? BellIcon
          return (
            <div
              key={notification.id}
              className={cn(
                "flex items-start gap-4 rounded-lg border border-border p-4",
                notification.lida ? "bg-card" : "bg-accent",
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-4" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{notification.titulo}</p>
                  {!notification.lida && <span className="size-1.5 rounded-full bg-primary" />}
                </div>
                <p className="text-sm text-muted-foreground">{notification.descricao}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{notification.horario}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
