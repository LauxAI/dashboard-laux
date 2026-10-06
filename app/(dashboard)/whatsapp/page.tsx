import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { ConnectWhatsAppCard } from "@/components/whatsapp/connect-whatsapp-card"
import { WhatsAppConnectionPanel } from "@/components/whatsapp/whatsapp-connection-panel"
import { getAIAgentSettings } from "@/lib/data/queries"
import { pickCurrentConnection, type SafeWhatsAppConnection } from "@/lib/whatsapp/connection-view"
import { listConnectionsForCurrentCompany } from "@/lib/whatsapp/connections"

export const dynamic = "force-dynamic"

async function loadConnection(): Promise<{ connection: SafeWhatsAppConnection | null; error: string | null }> {
  try {
    return { connection: pickCurrentConnection(await listConnectionsForCurrentCompany()), error: null }
  } catch {
    return { connection: null, error: "Não foi possível carregar a conexão do WhatsApp." }
  }
}

export default async function WhatsAppPage() {
  const [{ connection, error }, agents] = await Promise.all([loadConnection(), getAIAgentSettings()])
  const hasConnection = connection !== null && connection.status !== "disconnected"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="WhatsApp"
        description="Gerencie a conexão do WhatsApp Business que alimenta os agentes da sua empresa"
      />
      {error ? (
        <ErrorState description={error} />
      ) : hasConnection ? (
        <WhatsAppConnectionPanel connection={connection} agents={agents} />
      ) : (
        <ConnectWhatsAppCard previousNumber={connection?.display_phone_number} />
      )}
    </div>
  )
}
