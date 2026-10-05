import { AgendaTabs } from "@/components/agenda/agenda-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { getAppointments } from "@/lib/data/queries"
import type { AvailabilityConfig } from "@/lib/domain/types"
import { loadAvailabilityConfig } from "@/lib/scheduling/agenda-config"
import { getAccountAccess } from "@/lib/supabase/account-access"
import { createClient } from "@/lib/supabase/server"

async function getAvailabilityConfig(): Promise<{ data: AvailabilityConfig | null; error: string | null }> {
  const supabase = await createClient()
  const access = await getAccountAccess(supabase)
  if (access.status !== "active") return { data: null, error: "Não foi possível identificar sua empresa." }
  try {
    return { data: await loadAvailabilityConfig(supabase, access.companyId), error: null }
  } catch {
    return { data: null, error: "Não foi possível carregar a disponibilidade da agenda." }
  }
}

export default async function AgendaPage() {
  const [{ data: appointments, error }, availability] = await Promise.all([getAppointments(), getAvailabilityConfig()])
  const pageError = error ?? availability.error

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda"
        description="Compromissos marcados e regras de disponibilidade usadas pelo Agente de Agendamento"
      />
      {pageError || !availability.data ? (
        <ErrorState description={pageError ?? "Não foi possível carregar a agenda."} />
      ) : (
        <AgendaTabs appointments={appointments} availability={availability.data} />
      )}
    </div>
  )
}
