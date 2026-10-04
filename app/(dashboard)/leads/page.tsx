import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { getLeads } from "@/lib/data/queries"
import { LeadsTable } from "./leads-table"

export default async function LeadsPage() {
  const { data: leads, error } = await getLeads()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Leads" description="Acompanhe e gerencie os leads recebidos pelos seus canais" />
      {error ? <ErrorState description={error} /> : <LeadsTable leads={leads} />}
    </div>
  )
}
