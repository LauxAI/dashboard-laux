import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { getPlanUsage } from "@/lib/data/queries"
import { CheckIcon, ReceiptIcon } from "lucide-react"

const planLabels: Record<string, string> = {
  trial: "Teste gratuito",
  profissional: "Profissional",
  enterprise: "Enterprise",
}

export default async function PlanoPage() {
  const { plan, limits, usage } = await getPlanUsage()

  const usageItems = [
    { label: "Conversas atendidas pela IA", used: usage.conversations, limit: limits.conversations },
    { label: "Agentes de IA ativos", used: usage.agents, limit: limits.agents },
    { label: "Automações", used: usage.automations, limit: limits.automations },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plano e Faturamento" description="Gerencie sua assinatura e acompanhe o uso da plataforma" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Plano {planLabels[plan] ?? plan}</CardTitle>
              <CardDescription>Uso atual da sua plataforma</CardDescription>
            </div>
            <Badge className="bg-primary text-primary-foreground">Ativo</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Separator />
          <div className="flex flex-col gap-4">
            {usageItems.map((item) => (
              <div key={item.label} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.used} / {item.limit}
                  </span>
                </div>
                <Progress value={Math.min((item.used / item.limit) * 100, 100)} />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["Agentes de IA", "WhatsApp + Instagram", "Automações", "Suporte"].map((feature) => (
              <li key={feature} className="flex items-center gap-1.5">
                <CheckIcon className="size-4 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
          <Button variant="outline">Alterar plano</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de faturas</CardTitle>
          <CardDescription>Últimas cobranças da sua assinatura</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma fatura ainda</EmptyTitle>
              <EmptyDescription>Conecte um meio de pagamento para começar a gerar faturas.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}
