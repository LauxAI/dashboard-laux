"use client"

import { useState, useTransition, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { saveAIAgentConfig } from "@/app/(dashboard)/agentes/actions"
import { OptionSelect } from "@/components/shared/option-select"
import { SectionCard } from "@/components/shared/section-card"
import { SettingToggle } from "@/components/shared/setting-toggle"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AI_AGENT_LIMITS, hasGreetingField, normalizeAIAgentConfig, validateAIAgentConfig } from "@/lib/domain/ai-agents"
import { aiAgentTones } from "@/lib/domain/catalogs"
import type { AIAgentConfig, AIAgentTone, AIAgentType, SpecialistKey } from "@/lib/domain/types"

const knowledgeCopy: Record<AIAgentType, { title: string; placeholder: string; description: string }> = {
  atendimento: {
    title: "Base de conhecimento",
    placeholder: "Horários, endereço, formas de pagamento, políticas, perguntas frequentes...",
    description: "Tudo o que o agente pode usar para responder. Ele não inventa informações fora daqui.",
  },
  vendas: {
    title: "Informações da empresa",
    placeholder: "Diferenciais, condições comerciais, formas de pagamento, garantias...",
    description: "Contexto adicional para o agente vender com segurança.",
  },
  suporte: {
    title: "Base de conhecimento",
    placeholder: "Problemas comuns, prazos de resposta, políticas de troca e garantia...",
    description: "Informações que o agente consulta ao ajudar o cliente.",
  },
}

const specialistOptions: { key: SpecialistKey; label: string; description: string }[] = [
  {
    key: "scheduling",
    label: "Agendamento",
    description: "Consulta horários e cria, confirma, cancela ou remarca agendamentos. Exige o especialista ativo em Agendamento.",
  },
  {
    key: "sales",
    label: "Vendas",
    description: "Usa produtos, preços e abordagem comercial quando o cliente quer comprar. Exige o agente de Vendas ativo.",
  },
  {
    key: "support",
    label: "Suporte",
    description: "Usa procedimentos e base de suporte quando o cliente tem um problema. Exige o agente de Suporte ativo.",
  },
]

export function AIAgentForm({ type, initialConfig }: { type: AIAgentType; initialConfig: AIAgentConfig }) {
  const [config, setConfig] = useState(initialConfig)
  const [isPending, startTransition] = useTransition()

  const update = <K extends keyof AIAgentConfig>(key: K, value: AIAgentConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const invalid = validateAIAgentConfig(type, normalizeAIAgentConfig(type, config))
    if (invalid) {
      toast.error(invalid)
      return
    }
    startTransition(async () => {
      const result = await saveAIAgentConfig(type, config)
      if ("error" in result) toast.error(result.error)
      else toast.success("Configurações do agente salvas.")
    })
  }

  const knowledge = knowledgeCopy[type]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <SectionCard title="Identidade" description="Quem é o agente e o que ele deve alcançar">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="agent-name">Nome do agente</FieldLabel>
            <Input
              id="agent-name"
              value={config.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Ex.: Assistente virtual"
              maxLength={AI_AGENT_LIMITS.name}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="agent-description">Descrição</FieldLabel>
            <Textarea
              id="agent-description"
              value={config.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Resumo interno do que este agente faz"
              rows={2}
              maxLength={AI_AGENT_LIMITS.description}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="agent-objective">Objetivo</FieldLabel>
            <Textarea
              id="agent-objective"
              value={config.objective}
              onChange={(event) => update("objective", event.target.value)}
              placeholder="Ex.: Tirar dúvidas dos clientes e encaminhar pedidos para a equipe."
              rows={3}
              maxLength={AI_AGENT_LIMITS.objective}
              required
            />
          </Field>
          {hasGreetingField(type) && (
            <Field>
              <FieldLabel htmlFor="agent-greeting">Mensagem inicial</FieldLabel>
              <Textarea
                id="agent-greeting"
                value={config.greeting}
                onChange={(event) => update("greeting", event.target.value)}
                placeholder="Ex.: Olá! Como posso ajudar?"
                rows={2}
                maxLength={AI_AGENT_LIMITS.greeting}
              />
            </Field>
          )}
        </FieldGroup>
      </SectionCard>

      <SectionCard title="Comportamento" description="Instruções, personalidade e tom de voz">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="agent-instructions">Instruções</FieldLabel>
            <Textarea
              id="agent-instructions"
              value={config.instructions}
              onChange={(event) => update("instructions", event.target.value)}
              placeholder="Como o agente deve conduzir a conversa"
              rows={4}
              maxLength={AI_AGENT_LIMITS.instructions}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="agent-personality">Personalidade</FieldLabel>
            <Textarea
              id="agent-personality"
              value={config.personality}
              onChange={(event) => update("personality", event.target.value)}
              placeholder="Ex.: Paciente, atenciosa e organizada."
              rows={2}
              maxLength={AI_AGENT_LIMITS.personality}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="agent-tone">Tom de voz</FieldLabel>
            <OptionSelect
              name="tone"
              value={config.tone}
              onValueChange={(value) => update("tone", (value || "profissional") as AIAgentTone)}
              options={aiAgentTones}
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
                placeholder="Ex.: Acolhedor, frases curtas e sem termos técnicos."
                rows={2}
                maxLength={AI_AGENT_LIMITS.customTone}
              />
            </Field>
          )}
        </FieldGroup>
      </SectionCard>

      <SectionCard title={knowledge.title} description={knowledge.description}>
        <Field>
          <FieldLabel htmlFor="agent-knowledge" className="sr-only">
            {knowledge.title}
          </FieldLabel>
          <Textarea
            id="agent-knowledge"
            value={config.knowledge}
            onChange={(event) => update("knowledge", event.target.value)}
            placeholder={knowledge.placeholder}
            rows={8}
            maxLength={AI_AGENT_LIMITS.knowledge}
          />
          <FieldDescription>
            {config.knowledge.length}/{AI_AGENT_LIMITS.knowledge} caracteres
          </FieldDescription>
        </Field>
      </SectionCard>

      {type === "vendas" && <OfferingsSection config={config} update={update} />}
      {type === "suporte" && <ProceduresSection config={config} update={update} />}

      {type === "atendimento" && (
        <SectionCard
          title="Especialistas"
          description="O Atendimento é o único que conversa com o cliente. Ele pode recorrer a especialistas ativos e configurados."
          contentClassName="flex flex-col"
        >
          <div className="flex flex-col divide-y divide-border">
            {specialistOptions.map((option) => (
              <SettingToggle
                key={option.key}
                label={option.label}
                description={option.description}
                checked={config.specialists[option.key]}
                onCheckedChange={(checked) => update("specialists", { ...config.specialists, [option.key]: checked })}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Regras" description="Limites que o agente sempre deve respeitar">
        <StringList
          label="Regra"
          addLabel="Adicionar regra"
          placeholder="Ex.: Nunca prometer descontos sem aprovação."
          items={config.rules}
          maxItems={AI_AGENT_LIMITS.rules}
          maxLength={AI_AGENT_LIMITS.rule}
          onChange={(rules) => update("rules", rules)}
        />
      </SectionCard>

      <SectionCard title="Quando não souber ou não resolver" description="O que fazer fora do que está configurado">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="agent-fallback">Quando não souber responder</FieldLabel>
            <Textarea
              id="agent-fallback"
              value={config.fallbackBehavior}
              onChange={(event) => update("fallbackBehavior", event.target.value)}
              placeholder="Ex.: Avisar que vai verificar com a equipe e retornar."
              rows={2}
              maxLength={AI_AGENT_LIMITS.fallbackBehavior}
            />
          </Field>
          {type === "suporte" && (
            <Field>
              <FieldLabel htmlFor="agent-unresolved">Quando não conseguir resolver</FieldLabel>
              <Textarea
                id="agent-unresolved"
                value={config.unresolvedBehavior}
                onChange={(event) => update("unresolvedBehavior", event.target.value)}
                placeholder="Ex.: Pedir nome e contato e informar que a equipe retornará."
                rows={2}
                maxLength={AI_AGENT_LIMITS.unresolvedBehavior}
              />
            </Field>
          )}
        </FieldGroup>
        <div className="mt-4 border-t pt-2">
          <SettingToggle
            label="Transferir para atendente humano"
            description="O agente orienta a transferência quando o critério abaixo for atendido."
            checked={config.handoff.enabled}
            onCheckedChange={(enabled) => update("handoff", { ...config.handoff, enabled })}
          />
          {config.handoff.enabled && (
            <Field className="mt-2">
              <FieldLabel htmlFor="agent-handoff">Quando transferir</FieldLabel>
              <Textarea
                id="agent-handoff"
                value={config.handoff.criteria}
                onChange={(event) => update("handoff", { ...config.handoff, criteria: event.target.value })}
                placeholder="Ex.: Cliente pedir reembolso ou demonstrar insatisfação."
                rows={2}
                maxLength={AI_AGENT_LIMITS.handoffCriteria}
              />
            </Field>
          )}
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </form>
  )
}

type SectionProps = {
  config: AIAgentConfig
  update: <K extends keyof AIAgentConfig>(key: K, value: AIAgentConfig[K]) => void
}

function StringList({
  label,
  addLabel,
  placeholder,
  items,
  maxItems,
  maxLength,
  onChange,
}: {
  label: string
  addLabel: string
  placeholder: string
  items: string[]
  maxItems: number
  maxLength: number
  onChange: (items: string[]) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={item}
            onChange={(event) => onChange(items.map((current, i) => (i === index ? event.target.value : current)))}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-label={`${label} ${index + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            aria-label={`Remover ${label.toLowerCase()} ${index + 1}`}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={items.length >= maxItems}
        onClick={() => onChange([...items, ""])}
      >
        <Plus data-icon="inline-start" />
        {addLabel}
      </Button>
    </div>
  )
}

function OfferingsSection({ config, update }: SectionProps) {
  const setOffering = (index: number, patch: Partial<AIAgentConfig["offerings"][number]>) =>
    update(
      "offerings",
      config.offerings.map((offering, i) => (i === index ? { ...offering, ...patch } : offering)),
    )

  return (
    <>
      <SectionCard
        title="Produtos e serviços"
        description="O agente só apresenta o que estiver cadastrado aqui. Cadastre ao menos um."
      >
        <div className="flex flex-col gap-4">
          {config.offerings.map((offering, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <Input
                  value={offering.name}
                  onChange={(event) => setOffering(index, { name: event.target.value })}
                  placeholder="Nome"
                  maxLength={AI_AGENT_LIMITS.offeringName}
                  aria-label={`Nome do item ${index + 1}`}
                />
                <Input
                  value={offering.price}
                  onChange={(event) => setOffering(index, { price: event.target.value })}
                  placeholder="Preço (opcional)"
                  maxLength={AI_AGENT_LIMITS.offeringPrice}
                  aria-label={`Preço do item ${index + 1}`}
                />
              </div>
              <Textarea
                value={offering.description}
                onChange={(event) => setOffering(index, { description: event.target.value })}
                placeholder="Descrição"
                rows={2}
                maxLength={AI_AGENT_LIMITS.offeringDescription}
                aria-label={`Descrição do item ${index + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() =>
                  update(
                    "offerings",
                    config.offerings.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 data-icon="inline-start" />
                Remover
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            disabled={config.offerings.length >= AI_AGENT_LIMITS.offerings}
            onClick={() => update("offerings", [...config.offerings, { name: "", description: "", price: "" }])}
          >
            <Plus data-icon="inline-start" />
            Adicionar produto ou serviço
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Abordagem de vendas" description="Como o agente conduz e responde objeções">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="agent-sales-approach">Abordagem</FieldLabel>
            <Textarea
              id="agent-sales-approach"
              value={config.salesApproach}
              onChange={(event) => update("salesApproach", event.target.value)}
              placeholder="Ex.: Entender a necessidade antes de apresentar a oferta."
              rows={3}
              maxLength={AI_AGENT_LIMITS.salesApproach}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="agent-objections">Tratamento de objeções</FieldLabel>
            <Textarea
              id="agent-objections"
              value={config.objectionHandling}
              onChange={(event) => update("objectionHandling", event.target.value)}
              placeholder="Ex.: Se achar caro, destacar os benefícios incluídos."
              rows={3}
              maxLength={AI_AGENT_LIMITS.objectionHandling}
            />
          </Field>
        </FieldGroup>
      </SectionCard>
    </>
  )
}

function ProceduresSection({ config, update }: SectionProps) {
  const setProcedure = (index: number, patch: Partial<AIAgentConfig["procedures"][number]>) =>
    update(
      "procedures",
      config.procedures.map((procedure, i) => (i === index ? { ...procedure, ...patch } : procedure)),
    )

  return (
    <SectionCard
      title="Procedimentos"
      description="Passo a passo que o agente segue para resolver problemas. Cadastre ao menos um, ou preencha a base de conhecimento."
    >
      <div className="flex flex-col gap-4">
        {config.procedures.map((procedure, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-lg border p-3">
            <Input
              value={procedure.title}
              onChange={(event) => setProcedure(index, { title: event.target.value })}
              placeholder="Ex.: Redefinir senha"
              maxLength={AI_AGENT_LIMITS.procedureTitle}
              aria-label={`Título do procedimento ${index + 1}`}
            />
            <StringList
              label="Passo"
              addLabel="Adicionar passo"
              placeholder="Descreva o passo"
              items={procedure.steps}
              maxItems={AI_AGENT_LIMITS.procedureSteps}
              maxLength={AI_AGENT_LIMITS.procedureStep}
              onChange={(steps) => setProcedure(index, { steps })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() =>
                update(
                  "procedures",
                  config.procedures.filter((_, i) => i !== index),
                )
              }
            >
              <Trash2 data-icon="inline-start" />
              Remover procedimento
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={config.procedures.length >= AI_AGENT_LIMITS.procedures}
          onClick={() => update("procedures", [...config.procedures, { title: "", steps: [] }])}
        >
          <Plus data-icon="inline-start" />
          Adicionar procedimento
        </Button>
      </div>
    </SectionCard>
  )
}
