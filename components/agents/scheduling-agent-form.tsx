"use client"

import { useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import { CalendarDays } from "lucide-react"
import { toast } from "sonner"
import { saveSchedulingAgentConfig } from "@/app/(dashboard)/agentes/agendamento/actions"
import { OptionSelect } from "@/components/shared/option-select"
import { SectionCard } from "@/components/shared/section-card"
import { SettingToggle } from "@/components/shared/setting-toggle"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { schedulingBehaviorOptions, schedulingTones } from "@/lib/domain/catalogs"
import { defaultSchedulingAgentConfig } from "@/lib/domain/scheduling-agent"
import type { SchedulingAgentConfig, SchedulingTone } from "@/lib/domain/types"

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
      <SectionCard title="Identidade" description="Como o agente se apresenta aos seus clientes">
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
          <Field>
            <FieldLabel htmlFor="agent-greeting">Mensagem inicial</FieldLabel>
            <Textarea
              id="agent-greeting"
              value={config.greeting}
              onChange={(event) => update("greeting", event.target.value)}
              placeholder="Ex.: Olá! Posso ajudar você a marcar um horário."
              rows={3}
              maxLength={500}
            />
            <FieldDescription>Primeira mensagem enviada quando o cliente inicia a conversa.</FieldDescription>
          </Field>
        </FieldGroup>
      </SectionCard>

      <SectionCard title="Tom de voz" description="O estilo de linguagem usado nas respostas">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="agent-tone">Tom</FieldLabel>
            <OptionSelect
              name="tone"
              value={config.tone}
              onValueChange={(value) => update("tone", (value || "profissional") as SchedulingTone)}
              options={schedulingTones}
              ariaLabel="Tom de voz"
              className="sm:w-64"
            />
          </Field>
          {config.tone === "personalizado" && (
            <Field>
              <FieldLabel htmlFor="agent-custom-tone">Descreva o tom</FieldLabel>
              <Textarea
                id="agent-custom-tone"
                value={config.customTone}
                onChange={(event) => update("customTone", event.target.value)}
                placeholder="Ex.: Acolhedor, usa frases curtas e evita termos técnicos."
                rows={3}
                maxLength={500}
              />
            </Field>
          )}
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
