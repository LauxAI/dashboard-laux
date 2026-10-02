import { PageHeader } from "@/components/shared/page-header"
import { DemoBanner } from "@/components/shared/demo-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { CheckIcon } from "lucide-react"

const usage = [
  { label: "Conversas atendidas pela IA", used: 2480, limit: 5000 },
  { label: "Agentes de IA ativos", used: 3, limit: 4 },
  { label: "Automações", used: 5, limit: 10 },
]

const invoices = [
  { id: "f1", periodo: "Setembro 2026", valor: "R$ 497,00", status: "Pago" },
  { id: "f2", periodo: "Agosto 2026", valor: "R$ 497,00", status: "Pago" },
  { id: "f3", periodo: "Julho 2026", valor: "R$ 497,00", status: "Pago" },
]

export default function PlanoPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plano e Faturamento" description="Gerencie sua assinatura e acompanhe o uso da plataforma" />
      <DemoBanner />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Plano Profissional</CardTitle>
              <CardDescription>Renovação automática em 15/10/2026</CardDescription>
            </div>
            <Badge className="bg-primary text-primary-foreground">Ativo</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-semibold text-foreground">R$ 497</span>
            <span className="text-muted-foreground">/mês</span>
          </div>
          <Separator />
          <div className="flex flex-col gap-4">
            {usage.map((item) => (
              <div key={item.label} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.used} / {item.limit}
                  </span>
                </div>
                <Progress value={(item.used / item.limit) * 100} />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["4 agentes de IA", "WhatsApp + Instagram", "Automações ilimitadas", "Suporte prioritário"].map(
              (feature) => (
                <li key={feature} className="flex items-center gap-1.5">
                  <CheckIcon className="size-4 text-primary" />
                  {feature}
                </li>
              ),
            )}
          </ul>
          <Button variant="outline">Alterar plano</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de faturas</CardTitle>
          <CardDescription>Últimas cobranças da sua assinatura</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 p-0">
          {invoices.map((invoice, index) => (
            <div key={invoice.id}>
              {index > 0 && <Separator />}
              <div className="flex items-center justify-between px-6 py-4">
                <span className="text-foreground">{invoice.periodo}</span>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{invoice.valor}</span>
                  <Badge variant="secondary">{invoice.status}</Badge>
                  <Button variant="ghost" size="sm">
                    Baixar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
