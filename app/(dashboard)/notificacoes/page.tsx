import type { ComponentType } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { getNotifications } from "@/lib/data/queries"
import { formatRelativeTime } from "@/lib/format"
import { MarkAllReadButton } from "./mark-all-read-button"
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

export default async function NotificacoesPage() {
  const notifications = await getNotifications()
  const naoLidas = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notificações"
        description={`Você tem ${naoLidas} notificações não lidas`}
        actions={<MarkAllReadButton disabled={naoLidas === 0} />}
      />

      {notifications.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BellIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma notificação ainda</EmptyTitle>
            <EmptyDescription>Você será avisado aqui sobre novos leads, conversas e agendamentos.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((notification) => {
            const Icon = tipoIcon[notification.type] ?? BellIcon
            return (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-4 rounded-lg border border-border p-4",
                  notification.read ? "bg-card" : "bg-accent",
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{notification.title}</p>
                    {!notification.read && <span className="size-1.5 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(notification.created_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
