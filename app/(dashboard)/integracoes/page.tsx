import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/page-header"
import { IntegrationStatusBadge } from "@/components/shared/status-badge"
import { getIntegrations } from "@/lib/data/queries"
import { PlugIcon } from "lucide-react"

const actionLabel: Record<string, string> = {
  conectado: "Gerenciar",
  nao_conectado: "Conectar",
  nao_configurado: "Configurar",
  configuracao_necessaria: "Configurar",
  erro: "Corrigir",
}

const providerInfo: Record<string, { name: string; description: string }> = {
  whatsapp: { name: "WhatsApp", description: "Receba e responda mensagens dos seus clientes no WhatsApp" },
  instagram: { name: "Instagram", description: "Conecte sua conta para atender direct messages" },
  google_calendar: { name: "Google Agenda", description: "Sincronize agendamentos automaticamente" },
  n8n: { name: "n8n", description: "Conecte fluxos de automação externos" },
  ia_provider: { name: "Provedor de IA", description: "Configure o modelo de IA usado pelos seus agentes" },
  webhooks: { name: "Webhooks", description: "Envie eventos da sua operação para outros sistemas" },
}

export default async function IntegracoesPage() {
  const integrations = await getIntegrations()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrações"
        description="Conecte os canais e serviços que alimentam a operação da sua empresa"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => {
          const info = providerInfo[integration.provider] ?? {
            name: integration.provider,
            description: "Integração disponível para sua operação",
          }
          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <PlugIcon className="size-5" />
                  </div>
                  <IntegrationStatusBadge
                    status={integration.status as "conectado" | "nao_conectado" | "configuracao_necessaria" | "erro"}
                  />
                </div>
                <CardTitle className="pt-2 text-base">{info.name}</CardTitle>
                <CardDescription>{info.description}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant={integration.status === "conectado" ? "outline" : "default"} className="w-full">
                  {actionLabel[integration.status] ?? "Configurar"}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
