"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { saveAgendaConfigAction } from "@/app/(dashboard)/agenda/actions"
import { OptionSelect } from "@/components/shared/option-select"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { agendaTimezoneOptions, minNoticeOptions, slotIntervalOptions } from "@/lib/domain/catalogs"
import type { AvailabilityConfig } from "@/lib/domain/types"
import { BlockedDatesCard } from "./blocked-dates-card"
import { BusinessHoursCard } from "./business-hours-card"
import { ServicesCard } from "./services-card"

function withCurrent(options: { value: string; label: string }[], value: string, label: string) {
  return options.some((option) => option.value === value) ? options : [...options, { value, label }]
}

export function AvailabilitySettings({ initialConfig }: { initialConfig: AvailabilityConfig }) {
  const [config, setConfig] = useState(initialConfig)
  const [saved, setSaved] = useState(initialConfig)
  const [isSaving, startSaving] = useTransition()
  const dirty = JSON.stringify(config) !== JSON.stringify(saved)
  const { settings } = config

  const update = (patch: Partial<AvailabilityConfig>) => setConfig((current) => ({ ...current, ...patch }))
  const updateSettings = (patch: Partial<AvailabilityConfig["settings"]>) =>
    setConfig((current) => ({ ...current, settings: { ...current.settings, ...patch } }))

  const handleSave = () =>
    startSaving(async () => {
      const result = await saveAgendaConfigAction(config)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setConfig(result.config)
      setSaved(result.config)
      toast.success("Disponibilidade salva. O Agente de Agendamento já usa estas regras.")
    })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <BusinessHoursCard hours={config.hours} onChange={(hours) => update({ hours })} />
        <div className="flex flex-col gap-6">
          <ServicesCard services={config.services} onChange={(services) => update({ services })} />
          <SectionCard title="Regras de horário" description="Como o agente monta os horários oferecidos">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="agenda-timezone">Fuso horário</FieldLabel>
                <OptionSelect
                  name="timezone"
                  value={settings.timezone}
                  onValueChange={(timezone) => timezone && updateSettings({ timezone })}
                  options={withCurrent(agendaTimezoneOptions, settings.timezone, settings.timezone)}
                  ariaLabel="Fuso horário"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="agenda-interval">Horários oferecidos</FieldLabel>
                  <OptionSelect
                    name="slotInterval"
                    value={String(settings.slotIntervalMinutes)}
                    onValueChange={(value) => value && updateSettings({ slotIntervalMinutes: Number(value) })}
                    options={withCurrent(
                      slotIntervalOptions,
                      String(settings.slotIntervalMinutes),
                      `A cada ${settings.slotIntervalMinutes} minutos`,
                    )}
                    ariaLabel="Intervalo entre horários"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="agenda-notice">Antecedência mínima</FieldLabel>
                  <OptionSelect
                    name="minNotice"
                    value={String(settings.minNoticeMinutes)}
                    onValueChange={(value) => value !== "" && updateSettings({ minNoticeMinutes: Number(value) })}
                    options={withCurrent(
                      minNoticeOptions,
                      String(settings.minNoticeMinutes),
                      `${settings.minNoticeMinutes} minutos`,
                    )}
                    ariaLabel="Antecedência mínima"
                  />
                </Field>
              </div>
              <FieldDescription>
                O agente só oferece horários dentro do expediente, fora das datas bloqueadas e sem conflito com
                agendamentos existentes.
              </FieldDescription>
            </FieldGroup>
          </SectionCard>
        </div>
      </div>

      <BlockedDatesCard blockedDates={config.blockedDates} onChange={(blockedDates) => update({ blockedDates })} />

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-sm text-muted-foreground">Alterações não salvas</span>}
        {dirty && (
          <Button variant="outline" onClick={() => setConfig(saved)} disabled={isSaving}>
            Descartar
          </Button>
        )}
        <Button onClick={handleSave} disabled={!dirty || isSaving}>
          {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
          Salvar disponibilidade
        </Button>
      </div>
    </div>
  )
}
