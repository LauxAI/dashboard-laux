"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { saveAutomation, setAutomationStatus } from "@/app/(dashboard)/automacoes/actions"
import { OptionSelect } from "@/components/shared/option-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  actionDefinitions,
  categoryKeys,
  categoryLabels,
  conditionFields,
  delayPresets,
  describeDelay,
  getAction,
  getConditionField,
  getTrigger,
  operatorLabels,
  operatorsWithoutValue,
  triggers,
  type Capability,
} from "@/lib/automations/catalog"
import { automationStatusLabels } from "@/lib/automations/labels"
import {
  MAX_STEPS,
  type AutomationCategory,
  type AutomationDefinition,
  type AutomationStatus,
  type AutomationStep,
  type StoredAutomation,
} from "@/lib/automations/types"
import { hasBlockingIssues, validateDefinition, type ReadinessContext } from "@/lib/automations/validation"

function providedBefore(triggerType: string, steps: AutomationStep[], index: number): Set<Capability> {
  const provided = new Set<Capability>(getTrigger(triggerType)?.provides ?? [])
  for (const step of steps.slice(0, index)) {
    if (step.type !== "action") continue
    getAction(step.kind)?.provides?.forEach((capability) => provided.add(capability))
  }
  return provided
}

function emptyAction(kind: string): AutomationStep {
  const action = getAction(kind) ?? actionDefinitions[0]
  return {
    type: "action",
    kind: action.kind,
    params: Object.fromEntries(action.params.map((param) => [param.key, ""])),
  }
}

export function AutomationBuilder({
  automation,
  readiness,
}: {
  automation: StoredAutomation
  readiness: ReadinessContext
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(automation.name)
  const [description, setDescription] = useState(automation.description ?? "")
  const [category, setCategory] = useState<AutomationCategory>(automation.category ?? "geral")
  const [triggerType, setTriggerType] = useState(automation.triggerType ?? "")
  const [steps, setSteps] = useState<AutomationStep[]>(automation.steps)
  const [status, setStatus] = useState<AutomationStatus>(automation.status)

  const definition: AutomationDefinition = useMemo(
    () => ({ name, description, category, triggerType, steps }),
    [name, description, category, triggerType, steps],
  )
  const issues = useMemo(() => validateDefinition(definition, { strict: true, readiness }), [definition, readiness])
  const issuesByStep = (index: number) => issues.filter((issue) => issue.stepIndex === index)
  const generalIssues = issues.filter((issue) => issue.stepIndex === null)
  const isActive = status === "active"

  const updateStep = (index: number, next: AutomationStep) =>
    setSteps((current) => current.map((step, position) => (position === index ? next : step)))
  const removeStep = (index: number) => setSteps((current) => current.filter((_, position) => position !== index))
  const moveStep = (index: number, direction: -1 | 1) =>
    setSteps((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const addStep = (type: AutomationStep["type"]) => {
    if (steps.length >= MAX_STEPS) {
      toast.error(`Use no máximo ${MAX_STEPS} etapas.`)
      return
    }
    const provided = providedBefore(triggerType, steps, steps.length)
    if (type === "delay") {
      setSteps([...steps, { type: "delay", minutes: 60 }])
    } else if (type === "condition") {
      const field = conditionFields.find((candidate) => provided.has(candidate.needs))
      if (!field) {
        toast.error("Escolha um gatilho com dados para filtrar.")
        return
      }
      setSteps([...steps, { type: "condition", field: field.key, operator: field.operators[0], value: "" }])
    } else {
      const action = actionDefinitions.find((candidate) => candidate.needs.every((need) => provided.has(need)))
      if (!action) {
        toast.error("Escolha um gatilho antes de adicionar ações.")
        return
      }
      setSteps([...steps, emptyAction(action.kind)])
    }
  }

  const run = (task: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await task()
      } catch {
        toast.error("Não foi possível concluir a operação. Tente novamente.")
      }
    })

  const persist = async (): Promise<boolean> => {
    const result = await saveAutomation(automation.id, { name, description, category, triggerType, steps })
    if ("error" in result) {
      toast.error(result.error)
      return false
    }
    return true
  }

  const handleSave = () =>
    run(async () => {
      if (await persist()) {
        toast.success("Automação salva.")
        router.refresh()
      }
    })

  const handleToggleStatus = () =>
    run(async () => {
      const next: AutomationStatus = isActive ? "paused" : "active"
      if (!(await persist())) return
      const result = await setAutomationStatus(automation.id, next)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setStatus(next)
      toast.success(next === "active" ? "Automação ativada." : "Automação pausada.")
      result.warnings?.forEach((warning) => toast.warning(warning))
      router.refresh()
    })

  const triggerOptions = triggers.map((trigger) => ({ value: trigger.key, label: `${trigger.group} · ${trigger.label}` }))
  const selectedTrigger = getTrigger(triggerType)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" render={<Link href="/automacoes" />} nativeButton={false}>
          <ArrowLeftIcon data-icon="inline-start" />
          Automações
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{automationStatusLabels[status]}</span>
          <Button type="button" variant="outline" onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            type="button"
            onClick={handleToggleStatus}
            disabled={isPending || (!isActive && hasBlockingIssues(issues))}
          >
            {isActive ? "Pausar" : "Ativar"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="automation-name">Nome</Label>
            <Input id="automation-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Categoria</Label>
            <OptionSelect
              value={category}
              onValueChange={(value) => setCategory(value as AutomationCategory)}
              options={categoryKeys.map((key) => ({ value: key, label: categoryLabels[key] }))}
              ariaLabel="Categoria"
              className="sm:w-full"
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="automation-description">Descrição</Label>
            <Textarea
              id="automation-description"
              value={description}
              maxLength={500}
              rows={2}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quando</CardTitle>
          <CardDescription>O evento que dispara esta automação.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <OptionSelect
            value={triggerType}
            onValueChange={(value) => setTriggerType(value)}
            options={triggerOptions}
            placeholder="Escolha o gatilho"
            ariaLabel="Gatilho"
            className="sm:w-full"
          />
          {selectedTrigger ? <p className="text-sm text-muted-foreground">{selectedTrigger.description}</p> : null}
          {generalIssues.map((issue) => (
            <Alert key={issue.message} variant={issue.severity === "error" ? "destructive" : "default"}>
              <AlertDescription>{issue.message}</AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Então</h2>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma etapa ainda. Adicione condições, esperas e ações.</p>
        ) : null}
        {steps.map((step, index) => {
          const provided = providedBefore(triggerType, steps, index)
          return (
            <Card key={index}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {index + 1}. {step.type === "condition" ? "Condição" : step.type === "delay" ? "Esperar" : "Ação"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveStep(index, -1)}
                      disabled={index === 0}
                      aria-label="Mover para cima"
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveStep(index, 1)}
                      disabled={index === steps.length - 1}
                      aria-label="Mover para baixo"
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeStep(index)} aria-label="Remover etapa">
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>

                {step.type === "condition" ? (
                  <ConditionEditor
                    step={step}
                    provided={provided}
                    onChange={(next) => updateStep(index, next)}
                  />
                ) : step.type === "delay" ? (
                  <OptionSelect
                    value={String(step.minutes)}
                    onValueChange={(value) => updateStep(index, { type: "delay", minutes: Number(value) })}
                    options={[
                      ...(delayPresets.some((preset) => preset.minutes === step.minutes)
                        ? []
                        : [{ value: String(step.minutes), label: describeDelay(step.minutes) }]),
                      ...delayPresets.map((preset) => ({ value: String(preset.minutes), label: preset.label })),
                    ]}
                    ariaLabel="Tempo de espera"
                  />
                ) : (
                  <ActionEditor step={step} provided={provided} onChange={(next) => updateStep(index, next)} />
                )}

                {issuesByStep(index).map((issue) => (
                  <p key={issue.message} className={issue.severity === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                    {issue.message}
                  </p>
                ))}
              </CardContent>
            </Card>
          )
        })}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => addStep("condition")}>
            <PlusIcon data-icon="inline-start" />
            Condição
          </Button>
          <Button type="button" variant="outline" onClick={() => addStep("delay")}>
            <PlusIcon data-icon="inline-start" />
            Espera
          </Button>
          <Button type="button" variant="outline" onClick={() => addStep("action")}>
            <PlusIcon data-icon="inline-start" />
            Ação
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConditionEditor({
  step,
  provided,
  onChange,
}: {
  step: Extract<AutomationStep, { type: "condition" }>
  provided: Set<Capability>
  onChange: (step: AutomationStep) => void
}) {
  const field = getConditionField(step.field)
  const available = conditionFields.filter((candidate) => provided.has(candidate.needs) || candidate.key === step.field)
  const needsValue = !operatorsWithoutValue.includes(step.operator)

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <OptionSelect
        value={step.field}
        onValueChange={(value) => {
          const next = getConditionField(value)
          if (next) onChange({ type: "condition", field: next.key, operator: next.operators[0], value: "" })
        }}
        options={available.map((candidate) => ({ value: candidate.key, label: candidate.label }))}
        ariaLabel="Campo"
        className="sm:w-full"
      />
      <OptionSelect
        value={step.operator}
        onValueChange={(value) =>
          onChange({ ...step, operator: value as typeof step.operator, value: operatorsWithoutValue.includes(value as typeof step.operator) ? "" : step.value })
        }
        options={(field?.operators ?? []).map((operator) => ({ value: operator, label: operatorLabels[operator] }))}
        ariaLabel="Operador"
        className="sm:w-full"
      />
      {needsValue ? (
        field?.options ? (
          <OptionSelect
            value={step.value}
            onValueChange={(value) => onChange({ ...step, value })}
            options={field.options}
            placeholder="Valor"
            ariaLabel="Valor"
            className="sm:w-full"
          />
        ) : (
          <Input
            value={step.value}
            maxLength={200}
            placeholder="Valor"
            aria-label="Valor"
            onChange={(event) => onChange({ ...step, value: event.target.value })}
          />
        )
      ) : null}
    </div>
  )
}

function ActionEditor({
  step,
  provided,
  onChange,
}: {
  step: Extract<AutomationStep, { type: "action" }>
  provided: Set<Capability>
  onChange: (step: AutomationStep) => void
}) {
  const action = getAction(step.kind)
  const available = actionDefinitions.filter(
    (candidate) => candidate.needs.every((need) => provided.has(need)) || candidate.kind === step.kind,
  )

  return (
    <div className="flex flex-col gap-3">
      <OptionSelect
        value={step.kind}
        onValueChange={(value) => onChange(emptyAction(value))}
        options={available.map((candidate) => ({ value: candidate.kind, label: `${candidate.group} · ${candidate.label}` }))}
        ariaLabel="Ação"
        className="sm:w-full"
      />
      {action ? <p className="text-sm text-muted-foreground">{action.description}</p> : null}
      {action?.params.map((param) => {
        const id = `${step.kind}-${param.key}`
        const value = step.params[param.key] ?? ""
        const setValue = (next: string) => onChange({ ...step, params: { ...step.params, [param.key]: next } })
        return (
          <div key={param.key} className="flex flex-col gap-2">
            <Label htmlFor={id}>
              {param.label}
              {param.required ? null : <span className="font-normal text-muted-foreground"> (opcional)</span>}
            </Label>
            {param.kind === "select" && param.options ? (
              <OptionSelect
                value={value}
                onValueChange={setValue}
                options={param.options}
                placeholder="Escolha"
                ariaLabel={param.label}
                className="sm:w-full"
              />
            ) : param.kind === "textarea" ? (
              <Textarea
                id={id}
                value={value}
                rows={3}
                maxLength={param.maxLength}
                placeholder={param.placeholder}
                onChange={(event) => setValue(event.target.value)}
              />
            ) : (
              <Input
                id={id}
                value={value}
                maxLength={param.maxLength}
                placeholder={param.placeholder}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
            {param.help ? <p className="text-xs text-muted-foreground">{param.help}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
