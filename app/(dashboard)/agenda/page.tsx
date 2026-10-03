import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PageHeader } from "@/components/shared/page-header"
import { AppointmentStatusBadge } from "@/components/shared/status-badge"
import { getAppointments } from "@/lib/data/queries"
import { CalendarIcon, ClockIcon, PlusIcon } from "lucide-react"

export default async function AgendaPage() {
  const appointments = await getAppointments()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda"
        description="Compromissos e agendamentos feitos pela sua equipe e pelos agentes de IA"
        actions={
          <Button>
            <PlusIcon data-icon="inline-start" />
            Novo agendamento
          </Button>
        }
      />

      {appointments.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum agendamento ainda</EmptyTitle>
            <EmptyDescription>Os compromissos da sua equipe e dos agentes de IA aparecem aqui.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="divide-y divide-border p-0">
          {appointments.map((appointment) => {
            const scheduledAt = new Date(appointment.scheduled_at)
            return (
              <div
                key={appointment.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center rounded-lg border border-border px-3 py-2 text-center">
                    <span className="text-xs text-muted-foreground">
                      {scheduledAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                      <ClockIcon className="size-3" />
                      {scheduledAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{appointment.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {appointment.client_name ?? "Sem cliente vinculado"}
                    </span>
                  </div>
                </div>
                <AppointmentStatusBadge status={appointment.status as "confirmado" | "pendente" | "cancelado"} />
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
