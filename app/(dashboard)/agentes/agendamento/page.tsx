import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { SchedulingAgentForm } from "@/components/agents/scheduling-agent-form"
import { PageHeader } from "@/components/shared/page-header"
import { getCompany, getSchedulingAgentSettings } from "@/lib/data/queries"

export const metadata = { title: "Agente de Agendamento" }

export default async function SchedulingAgentPage() {
  const [company, settings] = await Promise.all([getCompany(), getSchedulingAgentSettings()])

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
        title="Agente de Agendamento"
        description={
          company?.name
            ? `Defina como o agente agenda clientes para ${company.name}`
            : "Defina como o agente agenda os seus clientes"
        }
      />
      <SchedulingAgentForm initialConfig={settings?.config} />
    </div>
  )
}
