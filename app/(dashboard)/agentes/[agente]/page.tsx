import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { AIAgentForm } from "@/components/agents/ai-agent-form"
import { PageHeader } from "@/components/shared/page-header"
import { getAIAgentSettings, getCompany } from "@/lib/data/queries"
import { isAIAgentType } from "@/lib/domain/ai-agents"
import { aiAgentCatalog } from "@/lib/domain/catalogs"
import { defaultAIAgentConfig } from "@/lib/domain/ai-agents"

export async function generateMetadata({ params }: { params: Promise<{ agente: string }> }) {
  const { agente } = await params
  return { title: isAIAgentType(agente) ? aiAgentCatalog[agente].name : "Agente de IA" }
}

export default async function AIAgentPage({ params }: { params: Promise<{ agente: string }> }) {
  const { agente } = await params
  if (!isAIAgentType(agente)) notFound()

  const [company, allSettings] = await Promise.all([getCompany(), getAIAgentSettings()])
  const settings = allSettings[agente]
  const catalog = aiAgentCatalog[agente]

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
        title={catalog.name}
        description={
          company?.name
            ? `Defina como o agente atua pela ${company.name}`
            : "Defina como o agente atua pela sua empresa"
        }
      />
      <AIAgentForm type={agente} initialConfig={settings?.config ?? defaultAIAgentConfig} />
    </div>
  )
}
