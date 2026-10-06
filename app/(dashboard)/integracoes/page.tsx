import Link from "next/link"
import { PageHeader } from "@/components/shared/page-header"
import { PendingActionButton } from "@/components/shared/pending-action-button"
import { StatusBadge } from "@/components/shared/status-badge"
import { ErrorState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getIntegrations } from "@/lib/data/queries"
import { integrationCatalog, integrationCategories } from "@/lib/domain/catalogs"
import type { IntegrationCategory } from "@/lib/domain/types"
import { listConnectionsForCurrentCompany } from "@/lib/whatsapp/connections"

async function hasActiveWhatsAppConnection() {
  try {
    return (await listConnectionsForCurrentCompany()).some((connection) => connection.status === "active")
  } catch {
    return false
  }
}

export default async function IntegracoesPage() {
  const { data: integrations, error } = await getIntegrations()
  const statusByProvider = new Map(integrations.map((integration) => [integration.provider, integration.status]))
  const categories = Object.keys(integrationCategories) as IntegrationCategory[]
  const whatsappConnected = await hasActiveWhatsAppConnection()

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Integrações" description="Conecte canais, ferramentas e provedores de IA à sua operação" />
      {error && <ErrorState description={error} />}

      {categories.map((category) => {
        const items = integrationCatalog.filter((item) => item.category === category)
        if (items.length === 0) return null
        return (
          <section key={category} aria-labelledby={`cat-${category}`} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id={`cat-${category}`} className="text-base font-semibold text-foreground">
                {integrationCategories[category].label}
              </h2>
              <p className="text-sm text-muted-foreground">{integrationCategories[category].description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const Icon = item.icon
                const status =
                  item.provider === "whatsapp"
                    ? whatsappConnected
                      ? "conectado"
                      : "desconectado"
                    : (statusByProvider.get(item.provider) ?? "desconectado")
                return (
                  <Card key={item.provider} className="flex flex-col">
                    <CardHeader className="flex flex-row items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                        <Icon className="size-5" aria-hidden="true" />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <CardDescription className="text-pretty">{item.description}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1" />
                    <CardFooter className="flex items-center justify-between gap-2">
                      {item.available ? (
                        <StatusBadge kind="integration" status={status} />
                      ) : (
                        <Badge variant="secondary" className="font-normal">
                          Em breve
                        </Badge>
                      )}
                      {item.available && item.provider === "whatsapp" && (
                        <Button variant="outline" size="sm" render={<Link href="/whatsapp" />} nativeButton={false}>
                          {status === "conectado" ? "Gerenciar" : "Conectar"}
                        </Button>
                      )}
                      {item.available && item.provider !== "whatsapp" && (
                        <PendingActionButton
                          action={`${status === "conectado" ? "Gerenciar" : "Conectar"} ${item.name}`}
                          variant="outline"
                          size="sm"
                        >
                          {status === "conectado" ? "Gerenciar" : "Conectar"}
                        </PendingActionButton>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
