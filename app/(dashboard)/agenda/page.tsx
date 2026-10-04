import { CalendarDays } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState, ErrorState } from "@/components/states/states"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAppointments } from "@/lib/data/queries"
import type { Appointment } from "@/lib/domain/types"
import { formatDateBRL, formatTimeBRL } from "@/lib/format"

function groupByDay(appointments: Appointment[]) {
  const groups = new Map<string, Appointment[]>()
  for (const appointment of appointments) {
    const key = formatDateBRL(appointment.startsAt)
    groups.set(key, [...(groups.get(key) ?? []), appointment])
  }
  return [...groups.entries()]
}

export default async function AgendaPage() {
  const { data: appointments, error } = await getAppointments()
  const sorted = [...appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Agenda" description="Reuniões e compromissos marcados com seus contatos" />

      {error ? (
        <ErrorState description={error} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum compromisso"
          description="Agendamentos feitos pela equipe ou pelos agentes de IA aparecerão aqui."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groupByDay(sorted).map(([day, items]) => (
            <Card key={day}>
              <CardHeader>
                <CardTitle className="text-base">{day}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y divide-border">
                  {items.map((appointment) => (
                    <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-4">
                        <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                          {formatTimeBRL(appointment.startsAt)}
                          {appointment.endsAt ? ` – ${formatTimeBRL(appointment.endsAt)}` : ""}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{appointment.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {[appointment.clientName, appointment.ownerName].filter(Boolean).join(" · ") || "Sem participantes"}
                          </span>
                        </div>
                      </div>
                      <StatusBadge kind="appointment" status={appointment.status} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
