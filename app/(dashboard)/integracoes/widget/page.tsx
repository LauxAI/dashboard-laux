import { headers } from "next/headers"
import { WidgetForm } from "@/components/integrations/widget-form"
import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { getSessionContext } from "@/lib/automations/session"
import { getOrCreateWidget } from "@/lib/integrations/widget"

export const metadata = { title: "Widget do site" }

export default async function WidgetPage() {
  const context = await getSessionContext()
  if (context.error !== undefined) return <ErrorState description={context.error} />

  const requestHeaders = await headers()
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? ""
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https"

  try {
    const widget = await getOrCreateWidget(context.companyId)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Widget do site" description="Chat com o seu agente de IA para incorporar no site da empresa" />
        <WidgetForm baseUrl={`${protocol}://${host}`} publicKey={widget.publicKey} initial={widget} />
      </div>
    )
  } catch {
    return <ErrorState description="Não foi possível carregar o widget." />
  }
}
