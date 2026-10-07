import Link from "next/link"
import { FlaskConical } from "lucide-react"
import { AgentList } from "@/components/agents/agent-list"
import { AIAgentCard } from "@/components/agents/ai-agent-card"
import { SchedulingAgentCard } from "@/components/agents/scheduling-agent-card"
import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAgents, getAIAgentSettings, getSchedulingAgentSettings } from "@/lib/data/queries"

export default async function AgentesPage() {
  const [{ data: agents, error }, schedulingSettings, aiSettings] = await Promise.all([
    getAgents(),
    getSchedulingAgentSettings(),
    getAIAgentSettings(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Agentes de IA"
        description="Configure o Atendimento e os especialistas que trabalham juntos para automatizar suas conversas."
      />

      <section aria-labelledby="main-agent-title" className="flex flex-col gap-3">
        <h2 id="main-agent-title" className="text-base font-semibold text-foreground">
          Agente principal
        </h2>
        <AIAgentCard type="atendimento" initialStatus={aiSettings.atendimento?.status} />
      </section>

      <section aria-labelledby="specialists-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="specialists-title" className="text-base font-semibold text-foreground">
            Especialistas
          </h2>
          <p className="text-sm text-muted-foreground">
            O Atendimento aciona os especialistas habilitados quando a conversa precisa deles.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <SchedulingAgentCard initialStatus={schedulingSettings?.status} />
          <AIAgentCard type="vendas" initialStatus={aiSettings.vendas?.status} />
          <AIAgentCard type="suporte" initialStatus={aiSettings.suporte?.status} />
        </div>
      </section>

      <section aria-labelledby="test-title" className="flex flex-col gap-3">
        <h2 id="test-title" className="text-base font-semibold text-foreground">
          Teste de agente
        </h2>
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <FlaskConical className="size-5" aria-hidden="true" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle className="text-lg">Teste integrado</CardTitle>
                <CardDescription className="text-pretty leading-relaxed">
                  Simule uma conversa real e veja como o Atendimento utiliza seus especialistas.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/agentes/testar" />} nativeButton={false}>
              <FlaskConical data-icon="inline-start" />
              Testar agente
            </Button>
          </CardContent>
        </Card>
      </section>

      {error ? (
        <ErrorState description={error} />
      ) : agents.length > 0 ? (
        <section aria-labelledby="registered-agents-title" className="flex flex-col gap-3">
          <h2 id="registered-agents-title" className="text-base font-semibold text-foreground">
            Agentes cadastrados
          </h2>
          <AgentList agents={agents} />
        </section>
      ) : null}
    </div>
  )
}
