"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { deleteAutomation, setAutomationStatus } from "@/app/(dashboard)/automacoes/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { categoryLabels, getTrigger } from "@/lib/automations/catalog"
import { automationStatusLabels } from "@/lib/automations/labels"
import type { AutomationListItem } from "@/lib/automations/types"
import { formatNumber, formatRelativeTime } from "@/lib/format"

export function AutomationCard({ automation }: { automation: AutomationListItem }) {
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isActive = automation.status === "active"
  const trigger = getTrigger(automation.triggerType)

  const handleToggle = (next: boolean) => {
    startTransition(async () => {
      try {
        const result = await setAutomationStatus(automation.id, next ? "active" : "paused")
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        toast.success(next ? "Automação ativada." : "Automação pausada.")
        result.warnings?.forEach((warning) => toast.warning(warning))
      } catch {
        toast.error("Não foi possível alterar o status. Tente novamente.")
      }
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const result = await deleteAutomation(automation.id)
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        setConfirmOpen(false)
        toast.success("Automação excluída.")
      } catch {
        toast.error("Não foi possível excluir a automação.")
      }
    })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="truncate">
            <Link href={`/automacoes/${automation.id}`} className="hover:underline">
              {automation.name}
            </Link>
          </CardTitle>
          <CardDescription className="line-clamp-2 text-pretty">
            {automation.description ?? "Sem descrição"}
          </CardDescription>
        </div>
        <Switch
          checked={isActive}
          disabled={isPending}
          onCheckedChange={handleToggle}
          aria-label={`${isActive ? "Pausar" : "Ativar"} ${automation.name}`}
        />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-normal">
            {automationStatusLabels[automation.status]}
          </Badge>
          {automation.category ? (
            <Badge variant="outline" className="font-normal">
              {categoryLabels[automation.category]}
            </Badge>
          ) : null}
        </div>
        <p>
          <span className="text-muted-foreground">Quando: </span>
          {trigger?.label ?? "Gatilho não definido"}
        </p>
        <p className="text-muted-foreground">{automation.stepsCount} etapas</p>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {formatNumber(automation.executionsCount)} execuções
          {automation.errorsCount > 0 ? ` · ${formatNumber(automation.errorsCount)} com erro` : ""}
        </span>
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline">
            {automation.lastRunAt ? formatRelativeTime(automation.lastRunAt) : "Nunca executada"}
          </span>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger
              render={
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Excluir ${automation.name}`}>
                  <Trash2Icon />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
                <AlertDialogDescription>
                  A automação &quot;{automation.name}&quot; e o histórico dela serão removidos. Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                  {isPending ? "Excluindo..." : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardFooter>
    </Card>
  )
}
