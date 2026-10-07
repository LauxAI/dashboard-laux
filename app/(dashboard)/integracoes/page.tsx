import Link from "next/link"
import { ArrowRight, Globe, MessageCircle, Webhook } from "lucide-react"
import { ProviderCard } from "@/components/integrations/provider-card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { ErrorState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getSessionContext } from "@/lib/automations/session"
import { categoryDefinitions, providers, type IntegrationCategoryId, type IntegrationView } from "@/lib/integrations/registry"
import { listIntegrationViews } from "@/lib/integrations/store"
import { listConnectionsForCurrentCompany } from "@/lib/whatsapp/connections"

async function hasActiveWhatsAppConnection() {
  try {
    return (await listConnectionsForCurrentCompany()).some((connection) => connection.status === "active")
  } catch {
    return false
  }
}

async function loadViews(): Promise<{ views: IntegrationView[]; error: string | null }> {
  const context = await getSessionContext()
  if (context.error !== undefined) return { views: [], error: context.error }
  try {
    return { views: await listIntegrationViews(context.companyId), error: null }
  } catch {
    return { views: [], error: "Não foi possível carregar as integrações." }
  }
}

type LinkCardProps = {
  title: string
  description: string
  href: string
  cta: string
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  status?: string
}

function LinkCard({ title, description, href, cta, icon: Icon, status }: LinkCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
          <Icon className="size-5" aria-hidden={true} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="text-pretty">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1" />
      <CardFooter className="flex items-center justify-between gap-2">
        {status ? <StatusBadge kind="integration" status={status} /> : <span />}
        <Button variant="outline" size="sm" render={<Link href={href} />} nativeButton={false}>
          {cta}
          <ArrowRight aria-hidden="true" />
        </Button>
      </CardFooter>
    </Card>
  )
}

export default async function IntegracoesPage() {
  const [{ views, error }, whatsappConnected] = await Promise.all([loadViews(), hasActiveWhatsAppConnection()])
  const viewByProvider = new Map(views.map((view) => [view.provider, view]))
  const categories = Object.keys(categoryDefinitions) as IntegrationCategoryId[]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Integrações" description="Conecte canais, ferramentas, CRMs e provedores de IA à sua operação" />
      {error && <ErrorState description={error} />}

      <section aria-labelledby="cat-canais" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="cat-canais" className="text-base font-semibold text-foreground">
            Canais e eventos
          </h2>
          <p className="text-sm text-muted-foreground">Onde seus clientes falam com você e como outros sistemas recebem eventos.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LinkCard
            title="WhatsApp"
            description="Receba e responda mensagens do WhatsApp Business."
            href="/whatsapp"
            cta={whatsappConnected ? "Gerenciar" : "Conectar"}
            icon={MessageCircle}
            status={whatsappConnected ? "conectado" : "desconectado"}
          />
          <LinkCard
            title="Widget do site"
            description="Chat para o site da sua empresa, com o seu agente de IA."
            href="/integracoes/widget"
            cta="Configurar"
            icon={Globe}
          />
          <LinkCard
            title="Webhooks"
            description="Receba eventos da LAUXAI em qualquer sistema, com assinatura de segurança."
            href="/integracoes/webhooks"
            cta="Configurar"
            icon={Webhook}
          />
        </div>
      </section>

      {categories.map((category) => (
        <section key={category} aria-labelledby={`cat-${category}`} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={`cat-${category}`} className="text-base font-semibold text-foreground">
              {categoryDefinitions[category].label}
            </h2>
            <p className="text-sm text-muted-foreground">{categoryDefinitions[category].description}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {providers
              .filter((provider) => provider.category === category)
              .map((provider) => (
                <ProviderCard key={provider.id} definition={provider} view={viewByProvider.get(provider.id) ?? null} />
              ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="cat-breve" className="flex flex-col gap-3">
        <h2 id="cat-breve" className="text-base font-semibold text-foreground">
          Em breve
        </h2>
        <div className="flex flex-wrap gap-2">
          {["Instagram", "Messenger"].map((name) => (
            <Badge key={name} variant="secondary" className="font-normal">
              {name}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  )
}
