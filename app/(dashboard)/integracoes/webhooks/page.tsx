import { headers } from "next/headers"
import { WebhooksManager } from "@/components/integrations/webhooks-manager"
import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { getSessionContext } from "@/lib/automations/session"
import { isEncryptionConfigured } from "@/lib/integrations/crypto"
import { getInboundView } from "@/lib/integrations/inbound"
import { listDeliveries, listEndpoints, webhookEvents } from "@/lib/integrations/webhooks"

export const metadata = { title: "Webhooks" }

export default async function WebhooksPage() {
  const context = await getSessionContext()
  if (context.error !== undefined) return <ErrorState description={context.error} />

  const requestHeaders = await headers()
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? ""
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https"

  try {
    const [endpoints, deliveries, inbound] = await Promise.all([
      listEndpoints(context.companyId),
      listDeliveries(context.companyId),
      getInboundView(context.companyId),
    ])
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Webhooks" description="Envie eventos da LAUXAI para outros sistemas e receba leads de fora" />
        <WebhooksManager
          baseUrl={`${protocol}://${host}`}
          endpoints={endpoints}
          deliveries={deliveries}
          inbound={inbound}
          eventOptions={webhookEvents.map((event) => ({ value: event.value, label: event.label }))}
          encryptionReady={isEncryptionConfigured()}
        />
      </div>
    )
  } catch {
    return <ErrorState description="Não foi possível carregar os webhooks." />
  }
}
