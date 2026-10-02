import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { DemoBanner } from "@/components/shared/demo-banner"
import { PageHeader } from "@/components/shared/page-header"
import { IntegrationStatusBadge } from "@/components/shared/status-badge"
import { demoIntegrations } from "@/lib/demo-data"
import { PlugIcon } from "lucide-react"

const actionLabel: Record<string, string> = {
  conectado: "Gerenciar",
  nao_conectado: "Conectar",
  configuracao_necessaria: "Configurar",
  erro: "Corrigir",
}

export default function IntegracoesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrações"
        description="Conecte os canais e serviços que alimentam a operação da sua empresa"
      />

      <DemoBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {demoIntegrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <PlugIcon className="size-5" />
                </div>
                <IntegrationStatusBadge status={integration.status} />
              </div>
              <CardTitle className="pt-2 text-base">{integration.nome}</CardTitle>
              <CardDescription>{integration.descricao}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant={integration.status === "conectado" ? "outline" : "default"} className="w-full">
                {actionLabel[integration.status]}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
