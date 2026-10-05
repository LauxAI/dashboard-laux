import { AgentList } from "@/components/agents/agent-list"
import { SchedulingAgentCard } from "@/components/agents/scheduling-agent-card"
import { UpcomingAgents } from "@/components/agents/upcoming-agents"
import { PageHeader } from "@/components/shared/page-header"
import { ErrorState } from "@/components/states/states"
import { getAgents, getCompany } from "@/lib/data/queries"

export default async function AgentesPage() {
  const [company, { data: agents, error }] = await Promise.all([getCompany(), getAgents()])

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
        <SchedulingAgentCard />
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

      <UpcomingAgents />
    </div>
  )
}
