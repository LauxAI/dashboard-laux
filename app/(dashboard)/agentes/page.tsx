import { AgentList } from "@/components/agents/agent-list"
import { AIAgentCard } from "@/components/agents/ai-agent-card"
import { SchedulingAgentCard } from "@/components/agents/scheduling-agent-card"
import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { getAgents, getAIAgentSettings, getCompany, getSchedulingAgentSettings } from "@/lib/data/queries"
import { aiAgentTypes } from "@/lib/domain/ai-agents"

export default async function AgentesPage() {
  const [company, { data: agents, error }, schedulingSettings, aiSettings] = await Promise.all([
    getCompany(),
    getAgents(),
    getSchedulingAgentSettings(),
    getAIAgentSettings(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Agentes de IA"
        description={
          company?.name
            ? `Agentes disponíveis para ${company.name}`
            : "Assistentes que atendem, qualificam e agendam pelos seus canais"
        }
      />

      <section aria-labelledby="available-agents-title" className="flex flex-col gap-3">
        <h2 id="available-agents-title" className="text-base font-semibold text-foreground">
          Disponíveis
        </h2>
        <div className="flex flex-col gap-4">
          <SchedulingAgentCard initialStatus={schedulingSettings?.status} />
          {aiAgentTypes.map((type) => (
            <AIAgentCard key={type} type={type} initialStatus={aiSettings[type]?.status} />
          ))}
        </div>
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
