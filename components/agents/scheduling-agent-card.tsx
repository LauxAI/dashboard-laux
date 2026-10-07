"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { CalendarClock, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { setSchedulingAgentStatus } from "@/app/(dashboard)/agentes/agendamento/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import type { SchedulingAgentStatus } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

export function SchedulingAgentCard({ initialStatus = "inativo" }: { initialStatus?: SchedulingAgentStatus }) {
  const [active, setActive] = useState(initialStatus === "ativo")
  const [isPending, startTransition] = useTransition()

  const handleToggle = (checked: boolean) => {
    setActive(checked)
    startTransition(async () => {
      const result = await setSchedulingAgentStatus(checked ? "ativo" : "inativo")
      if ("error" in result) {
        setActive(!checked)
        toast.error(result.error)
      } else {
        toast.success(checked ? "Agente de Agendamento ativado." : "Agente de Agendamento desativado.")
      }
    })
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <CalendarClock className="size-5" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">Agente de Agendamento</CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  "font-normal",
                  active ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 rounded-full", active ? "bg-primary" : "bg-muted-foreground")}
                />
                {active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <CardDescription className="text-pretty leading-relaxed">
              Gerencia horários e compromissos.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-x-6 gap-y-2 text-sm text-muted-foreground sm:grid-cols-3">
          <li>Usa o horário de funcionamento da Agenda</li>
          <li>Oferece os serviços cadastrados</li>
          <li>Respeita intervalos e datas bloqueadas</li>
        </ul>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Switch
            id="scheduling-agent-active"
            checked={active}
            onCheckedChange={handleToggle}
            disabled={isPending}
            aria-describedby="scheduling-agent-active-hint"
          />
          <div className="flex flex-col">
            <label htmlFor="scheduling-agent-active" className="text-sm font-medium text-foreground">
              {active ? "Desativar agente" : "Ativar agente"}
            </label>
            <span id="scheduling-agent-active-hint" className="text-xs text-muted-foreground">
              O status é salvo ao alternar
            </span>
          </div>
        </div>
        <Button render={<Link href="/agentes/agendamento" />} nativeButton={false}>
          <Settings2 data-icon="inline-start" />
          Configurar
        </Button>
      </CardFooter>
    </Card>
  )
}
