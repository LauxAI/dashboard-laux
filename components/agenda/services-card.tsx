"use client"

import { useState, type FormEvent } from "react"
import { Pencil, PlusIcon, Scissors, Trash2 } from "lucide-react"
import { OptionSelect } from "@/components/shared/option-select"
import { SectionCard } from "@/components/shared/section-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { serviceDurationOptions } from "@/lib/domain/catalogs"
import type { BookableService } from "@/lib/domain/types"

type Draft = { name: string; description: string; durationMinutes: string; active: boolean }

const emptyDraft: Draft = { name: "", description: "", durationMinutes: "30", active: true }

function durationLabel(minutes: number) {
  return serviceDurationOptions.find((option) => Number(option.value) === minutes)?.label ?? `${minutes} min`
}

export function ServicesCard({
  services,
  onChange,
}: {
  services: BookableService[]
  onChange: (services: BookableService[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft)
    setOpen(true)
  }

  const openEdit = (service: BookableService) => {
    setEditingId(service.id)
    setDraft({
      name: service.name,
      description: service.description ?? "",
      durationMinutes: String(service.durationMinutes),
      active: service.active,
    })
    setOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = draft.name.trim()
    if (!name) return
    const service: BookableService = {
      id: editingId ?? crypto.randomUUID(),
      name,
      description: draft.description.trim() || null,
      durationMinutes: Number(draft.durationMinutes) || 30,
      active: draft.active,
    }
    onChange(editingId ? services.map((item) => (item.id === editingId ? service : item)) : [...services, service])
    setOpen(false)
  }

  return (
    <SectionCard
      title="Serviços"
      description="O que o Agente de Agendamento pode oferecer aos clientes"
      action={
        <Button variant="outline" size="sm" onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Adicionar
        </Button>
      }
    >
      {services.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Scissors />
            </EmptyMedia>
            <EmptyTitle>Nenhum serviço cadastrado</EmptyTitle>
            <EmptyDescription>Cadastre os serviços com duração para que o agente possa oferecê-los.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {services.map((service) => (
            <li key={service.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{service.name}</span>
                  {!service.active && (
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      Inativo
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {durationLabel(service.durationMinutes)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(service)} aria-label={`Editar ${service.name}`}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange(services.filter((item) => item.id !== service.id))}
                  aria-label={`Remover ${service.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar serviço" : "Novo serviço"}</DialogTitle>
              <DialogDescription>A duração define o tamanho do horário reservado na agenda.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="service-name">Nome</FieldLabel>
                <Input
                  id="service-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Ex.: Consulta inicial"
                  maxLength={120}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="service-description">Descrição</FieldLabel>
                <Textarea
                  id="service-description"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  rows={2}
                  maxLength={500}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="service-duration">Duração</FieldLabel>
                <OptionSelect
                  value={draft.durationMinutes}
                  onValueChange={(value) => setDraft({ ...draft, durationMinutes: value || "30" })}
                  options={serviceDurationOptions}
                  ariaLabel="Duração"
                />
              </Field>
              <Field orientation="horizontal">
                <Switch
                  id="service-active"
                  checked={draft.active}
                  onCheckedChange={(active) => setDraft({ ...draft, active })}
                />
                <FieldLabel htmlFor="service-active">Disponível para agendamento</FieldLabel>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editingId ? "Salvar" : "Adicionar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
