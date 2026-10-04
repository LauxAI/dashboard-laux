import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { getClients } from "@/lib/data/queries"
import { ClientsTable } from "./clients-table"

export default async function ClientesPage() {
  const { data: clients, error } = await getClients()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clientes" description="Sua base de clientes em um só lugar" />
      {error ? <ErrorState description={error} /> : <ClientsTable clients={clients} />}
    </div>
  )
}
