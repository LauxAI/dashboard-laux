"use client"

import { useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import { CalendarDays } from "lucide-react"
import { toast } from "sonner"
import { saveSchedulingAgentConfig } from "@/app/(dashboard)/agentes/agendamento/actions"
import { SectionCard } from "@/components/shared/section-card"
import { SettingToggle } from "@/components/shared/setting-toggle"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { schedulingBehaviorOptions } from "@/lib/domain/catalogs"
import { defaultSchedulingAgentConfig } from "@/lib/domain/scheduling-agent"
import type { SchedulingAgentConfig } from "@/lib/domain/types"

export function SchedulingAgentForm({
  initialConfig = defaultSchedulingAgentConfig,
}: {
  initialConfig?: SchedulingAgentConfig
}) {
  const [config, setConfig] = useState(initialConfig)
  const [isPending, startTransition] = useTransition()

  const update = <K extends keyof SchedulingAgentConfig>(key: K, value: SchedulingAgentConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }))

  const setBehavior = (key: keyof SchedulingAgentConfig["behavior"], value: boolean) =>
    setConfig((current) => ({ ...current, behavior: { ...current.behavior, [key]: value } }))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveSchedulingAgentConfig(config)
      if ("error" in result) toast.error(result.error)
      else toast.success("Configurações do agente salvas.")
    })
  }

  const agendaOptions = schedulingBehaviorOptions.filter((option) => option.group === "agenda")
  const dataOptions = schedulingBehaviorOptions.filter((option) => option.group === "dados")

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <SectionCard title="Identidade" description="Especialista interno usado pelo Atendimento. Ele não conversa diretamente com o cliente.">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="agent-name">Nome do agente</FieldLabel>
            <Input
              id="agent-name"
              value={config.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Ex.: Assistente de agendamentos"
              maxLength={80}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="agent-description">Descrição</FieldLabel>
            <Textarea
              id="agent-description"
              value={config.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Resumo interno do que este agente faz"
              rows={3}
              maxLength={500}
            />
          </Field>
        </FieldGroup>
      </SectionCard>

      <SectionCard
        title="Comportamento"
        description="O que o agente pode fazer durante a conversa"
        contentClassName="flex flex-col"
      >
        <div className="flex flex-col divide-y divide-border">
          {agendaOptions.map((option) => (
            <SettingToggle
              key={option.key}
              label={option.label}
              description={option.description}
              checked={config.behavior[option.key]}
              onCheckedChange={(checked) => setBehavior(option.key, checked)}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-1 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Dados do cliente</h3>
          <p className="text-sm text-muted-foreground">Informações solicitadas antes de concluir o agendamento.</p>
        </div>
        <div className="flex flex-col divide-y divide-border">
          {dataOptions.map((option) => (
            <SettingToggle
              key={option.key}
              label={option.label}
              description={option.description}
              checked={config.behavior[option.key]}
              onCheckedChange={(checked) => setBehavior(option.key, checked)}
            />
          ))}
        </div>
      </SectionCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" render={<Link href="/agenda" />} nativeButton={false}>
          <CalendarDays data-icon="inline-start" />
          Configurar horários e serviços
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </form>
  )
}
