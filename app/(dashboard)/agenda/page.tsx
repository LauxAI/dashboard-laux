import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DemoBanner } from "@/components/shared/demo-banner"
import { PageHeader } from "@/components/shared/page-header"
import { AppointmentStatusBadge } from "@/components/shared/status-badge"
import { demoAppointments } from "@/lib/demo-data"
import { ClockIcon, PlusIcon } from "lucide-react"

export default function AgendaPage() {
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

      <DemoBanner />

      <Card className="divide-y divide-border p-0">
        {demoAppointments.map((appointment) => (
          <div
            key={appointment.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center rounded-lg border border-border px-3 py-2 text-center">
                <span className="text-xs text-muted-foreground">{appointment.data.slice(0, 5)}</span>
                <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                  <ClockIcon className="size-3" />
                  {appointment.horario}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{appointment.titulo}</span>
                <span className="text-xs text-muted-foreground">
                  {appointment.cliente} · Responsável: {appointment.responsavel}
                </span>
              </div>
            </div>
            <AppointmentStatusBadge status={appointment.status} />
          </div>
        ))}
      </Card>
    </div>
  )
}
