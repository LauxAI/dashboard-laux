import { Bot, MessageCircle } from "lucide-react"
import { DisconnectWhatsAppButton } from "@/components/whatsapp/disconnect-whatsapp-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { aiAgentCatalog } from "@/lib/domain/catalogs"
import type { AIAgentSettings, AIAgentType } from "@/lib/domain/types"
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/connection-view"
import { cn } from "@/lib/utils"

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
})

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date)
}

const statusPresentation = {
  active: { label: "Conectado", dot: "bg-primary" },
  inactive: { label: "Inativo", dot: "bg-chart-4" },
  disconnected: { label: "Desconectado", dot: "bg-muted-foreground/50" },
} as const

const AGENT_TYPES: AIAgentType[] = ["atendimento", "vendas", "suporte"]

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{value}</dd>
    </div>
  )
}

export function WhatsAppConnectionPanel({
  connection,
  agents,
}: {
  connection: SafeWhatsAppConnection
  agents: Partial<Record<AIAgentType, AIAgentSettings>>
}) {
  const presentation = statusPresentation[connection.status]
  const isActive = connection.status === "active"

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <MessageCircle className="size-5" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{connection.display_phone_number ?? "Número do WhatsApp Business"}</CardTitle>
              <Badge variant="outline" className="gap-1.5 font-normal" data-testid="whatsapp-status">
                <span aria-hidden="true" className={cn("size-1.5 rounded-full", presentation.dot)} />
                {presentation.label}
              </Badge>
            </div>
            <CardDescription>
              {isActive
                ? "As mensagens recebidas neste número são atendidas pelos agentes ativos da sua empresa."
                : "Este número não está recebendo mensagens no momento."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Número" value={connection.display_phone_number ?? "—"} />
            <Detail label="Nome da empresa" value={connection.business_name ?? "—"} />
            <Detail label="WABA ID" value={connection.waba_id ?? "—"} />
            <Detail label="Phone number ID" value={connection.phone_number_id} />
            <Detail label="Conectado em" value={formatDate(connection.connected_at)} />
            <Detail label="Última atualização" value={formatDate(connection.updated_at)} />
          </dl>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <DisconnectWhatsAppButton connectionId={connection.id} />
        </CardFooter>
      </Card>

      <section aria-labelledby="whatsapp-agents" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="whatsapp-agents" className="text-base font-semibold text-foreground">
            Agentes disponíveis
          </h2>
          <p className="text-sm text-muted-foreground">
            Somente agentes ativos respondem às conversas. Ative ou configure os agentes em Agentes de IA.
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-3">
          {AGENT_TYPES.map((type) => {
            const catalog = aiAgentCatalog[type]
            const active = agents[type]?.status === "ativo"
            return (
              <li key={type}>
                <Card size="sm" className="h-full">
                  <CardHeader className="flex flex-row items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                      <Bot className="size-4" aria-hidden="true" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="text-sm">{catalog.name}</CardTitle>
                      <Badge
                        variant="outline"
                        className={cn(
                          "w-fit gap-1.5 font-normal",
                          active ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground",
                        )}
                      >
                        {active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
