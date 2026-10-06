"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Settings2 } from "lucide-react"
import { toast } from "sonner"
import { setAIAgentStatus } from "@/app/(dashboard)/agentes/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { aiAgentCatalog } from "@/lib/domain/catalogs"
import type { AIAgentStatus, AIAgentType } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

export function AIAgentCard({ type, initialStatus = "inativo" }: { type: AIAgentType; initialStatus?: AIAgentStatus }) {
  const catalog = aiAgentCatalog[type]
  const [active, setActive] = useState(initialStatus === "ativo")
  const [isPending, startTransition] = useTransition()
  const switchId = `ai-agent-${type}-active`

  const handleToggle = (checked: boolean) => {
    setActive(checked)
    startTransition(async () => {
      const result = await setAIAgentStatus(type, checked ? "ativo" : "inativo")
      if ("error" in result) {
        setActive(!checked)
        toast.error(result.error)
      } else {
        toast.success(checked ? `${catalog.name} ativado.` : `${catalog.name} desativado.`)
      }
    })
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <catalog.icon className="size-5" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{catalog.name}</CardTitle>
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
            <CardDescription className="text-pretty leading-relaxed">{catalog.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {catalog.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Switch id={switchId} checked={active} onCheckedChange={handleToggle} disabled={isPending} />
          <label htmlFor={switchId} className="text-sm font-medium text-foreground">
            {active ? "Desativar agente" : "Ativar agente"}
          </label>
        </div>
        <Button render={<Link href={`/agentes/${type}`} />} nativeButton={false}>
          <Settings2 data-icon="inline-start" />
          Configurar
        </Button>
      </CardFooter>
    </Card>
  )
}
