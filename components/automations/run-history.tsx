"use client"

import { useState, useTransition } from "react"
import { ChevronDownIcon } from "lucide-react"
import { loadRunSteps } from "@/app/(dashboard)/automacoes/actions"
import { Badge } from "@/components/ui/badge"
import { getTrigger } from "@/lib/automations/catalog"
import { runStatusLabels, runStepStatusLabels } from "@/lib/automations/labels"
import type { AutomationRunItem, AutomationRunStepItem } from "@/lib/automations/types"
import { formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

function RunRow({ run, showAutomationName }: { run: AutomationRunItem; showAutomationName: boolean }) {
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState<AutomationRunStepItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (!next || steps !== null) return
    startTransition(async () => {
      try {
        const result = await loadRunSteps(run.id)
        if (result.error !== null) {
          setError(result.error)
          return
        }
        setError(null)
        setSteps(result.data)
      } catch {
        setError("Não foi possível carregar as etapas.")
      }
    })
  }

  return (
    <li className="flex flex-col rounded-lg border bg-card">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium text-foreground">
            {showAutomationName ? run.automationName : (getTrigger(run.triggerType)?.label ?? run.triggerType)}
          </span>
          <span className="text-xs text-muted-foreground">
            {showAutomationName ? `${getTrigger(run.triggerType)?.label ?? run.triggerType} · ` : ""}
            {formatRelativeTime(run.startedAt)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={run.status === "failed" ? "destructive" : "outline"} className="font-normal">
            {runStatusLabels[run.status]}
          </Badge>
          <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t p-4 text-sm">
          {run.errorMessage ? <p className="text-destructive">{run.errorMessage}</p> : null}
          {isPending ? <p className="text-muted-foreground">Carregando etapas...</p> : null}
          {error ? <p className="text-destructive">{error}</p> : null}
          {steps?.length === 0 ? <p className="text-muted-foreground">Nenhuma etapa registrada.</p> : null}
          {steps?.map((step) => (
            <div key={step.id} className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-foreground">{step.label}</span>
                {step.errorMessage ? <span className="text-xs text-destructive">{step.errorMessage}</span> : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{runStepStatusLabels[step.status]}</span>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  )
}

export function RunHistory({
  runs,
  showAutomationName = true,
}: {
  runs: AutomationRunItem[]
  showAutomationName?: boolean
}) {
  return (
    <ul className="flex flex-col gap-3">
      {runs.map((run) => (
        <RunRow key={run.id} run={run} showAutomationName={showAutomationName} />
      ))}
    </ul>
  )
}
