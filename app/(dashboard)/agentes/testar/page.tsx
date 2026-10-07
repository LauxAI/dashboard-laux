import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { AgentTestChat } from "@/components/agents/agent-test-chat"
import { SpecialistStatusList } from "@/components/agents/specialist-status-list"
import { PageHeader } from "@/components/shared/page-header"
import { loadSpecialistState, type SpecialistStatus } from "@/lib/ai/specialist-status"
import { getAIAgentSettings, getCompany } from "@/lib/data/queries"
import { validateAIAgentConfig } from "@/lib/domain/ai-agents"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Testar agente" }

export default async function TestAgentPage() {
  const [company, allSettings] = await Promise.all([getCompany(), getAIAgentSettings()])
  const settings = allSettings.atendimento
  const canTest = Boolean(settings) && validateAIAgentConfig("atendimento", settings!.config) === null

  let statuses: SpecialistStatus[] = []
  if (settings && company) {
    const supabase = await createClient()
    try {
      statuses = (await loadSpecialistState(supabase, company.id, settings.config.specialists)).statuses
    } catch {
      statuses = []
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/agentes"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Agentes de IA
      </Link>
      <PageHeader
        title="Testar agente"
        description="Simule uma conversa real e veja como o Atendimento utiliza seus especialistas."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <AgentTestChat canTest={canTest} agentName={settings?.config.name || "o Atendimento"} />
        <div className="xl:sticky xl:top-6">
          {settings ? (
            <SpecialistStatusList statuses={statuses} />
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Salve a configuração do Atendimento para ver os especialistas disponíveis.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
