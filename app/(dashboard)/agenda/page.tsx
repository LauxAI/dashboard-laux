import { AgendaTabs } from "@/components/agenda/agenda-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { getAppointments } from "@/lib/data/queries"

export default async function AgendaPage() {
  const { data: appointments, error } = await getAppointments()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda"
        description="Compromissos marcados e regras de disponibilidade usadas pelo Agente de Agendamento"
      />
      {error ? <ErrorState description={error} /> : <AgendaTabs appointments={appointments} />}
    </div>
  )
}
