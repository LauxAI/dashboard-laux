import Link from "next/link"
import { Workflow } from "lucide-react"
import { AutomationCard } from "@/components/automations/automation-card"
import { NewAutomationButton } from "@/components/automations/new-automation-button"
import { RunHistory } from "@/components/automations/run-history"
import { TemplateLibrary } from "@/components/automations/template-library"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorState } from "@/components/states/states"
import { listAutomations, listRuns } from "@/lib/automations/queries"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const tabs = [
  { key: "minhas", label: "Minhas automações" },
  { key: "biblioteca", label: "Biblioteca" },
  { key: "historico", label: "Histórico" },
] as const

type TabKey = (typeof tabs)[number]["key"]

async function MyAutomations() {
  const { data, error } = await listAutomations()
  if (error !== null) return <ErrorState description={error} />
  if (data.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="Nenhuma automação"
        description="Comece por um modelo da biblioteca ou crie um fluxo do zero."
      />
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((automation) => (
        <AutomationCard key={automation.id} automation={automation} />
      ))}
    </div>
  )
}

async function History() {
  const { data, error } = await listRuns({ limit: 30 })
  if (error !== null) return <ErrorState description={error} />
  if (data.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="Nenhuma execução"
        description="As execuções aparecem aqui quando uma automação ativa for disparada."
      />
    )
  }
  return <RunHistory runs={data} />
}

export default async function AutomacoesPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams
  const active: TabKey = tabs.some((tab) => tab.key === aba) ? (aba as TabKey) : "minhas"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Automações"
        description="Fluxos que reagem a eventos e executam ações automaticamente"
        actions={<NewAutomationButton />}
      />

      <nav aria-label="Seções de automações" className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "minhas" ? "/automacoes" : `/automacoes?aba=${tab.key}`}
            aria-current={tab.key === active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab.key === active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {active === "minhas" ? <MyAutomations /> : active === "biblioteca" ? <TemplateLibrary /> : <History />}
    </div>
  )
}
