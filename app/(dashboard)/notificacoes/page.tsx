import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { getNotifications } from "@/lib/data/queries"
import { MarkAllReadButton } from "./mark-all-read-button"
import { NotificationsList } from "./notifications-list"

export default async function NotificacoesPage() {
  const { data: notifications, error } = await getNotifications()
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notificações"
        description={unread > 0 ? `${unread} não lida${unread > 1 ? "s" : ""}` : "Nenhuma notificação pendente"}
        actions={<MarkAllReadButton disabled={unread === 0} />}
      />
      {error ? <ErrorState description={error} /> : <NotificationsList notifications={notifications} />}
    </div>
  )
}
