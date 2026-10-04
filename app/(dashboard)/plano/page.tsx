import { ReceiptIcon } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PendingActionButton } from "@/components/shared/pending-action-button"
import { EmptyState } from "@/components/states/empty-state"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getPlanUsage } from "@/lib/data/queries"
import { formatNumber } from "@/lib/format"

export default async function PlanoPage() {
  const usage = await getPlanUsage()

  const usageItems = [
    { label: "Conversas", value: usage.conversations },
    { label: "Agentes de IA", value: usage.agents },
    { label: "Automações", value: usage.automations },
    { label: "Membros da equipe", value: usage.members },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plano e Faturamento" description="Acompanhe o uso da plataforma e sua assinatura" />

      <Card>
        <CardHeader>
          <CardTitle>Uso atual</CardTitle>
          <CardDescription className="text-pretty">
            Os limites do plano aparecem aqui quando o faturamento estiver conectado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {usageItems.map((item) => (
              <div key={item.label} className="flex flex-col gap-1 rounded-md border border-border p-4">
                <dt className="text-sm text-muted-foreground">{item.label}</dt>
                <dd className="text-2xl font-semibold tabular-nums text-foreground">{formatNumber(item.value)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
        <CardFooter className="justify-end">
          <PendingActionButton action="Alterar plano" variant="outline">
            Alterar plano
          </PendingActionButton>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de faturas</CardTitle>
          <CardDescription>Últimas cobranças da sua assinatura</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={ReceiptIcon}
            title="Nenhuma fatura disponível"
            description="As faturas aparecerão aqui assim que o faturamento estiver conectado."
          />
        </CardContent>
      </Card>
    </div>
  )
}
