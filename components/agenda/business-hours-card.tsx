"use client"

import { SectionCard } from "@/components/shared/section-card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { businessWeekdays } from "@/lib/domain/catalogs"
import type { BusinessHoursDay } from "@/lib/domain/types"

export function BusinessHoursCard({
  hours,
  onChange,
}: {
  hours: BusinessHoursDay[]
  onChange: (hours: BusinessHoursDay[]) => void
}) {
  const updateDay = (index: number, patch: Partial<BusinessHoursDay>) =>
    onChange(hours.map((day, current) => (current === index ? { ...day, ...patch } : day)))

  return (
    <SectionCard
      title="Horário de funcionamento"
      description="Dias e horários em que o Agente de Agendamento pode marcar compromissos"
    >
      <ul className="flex flex-col divide-y divide-border">
        {hours.map((day, index) => {
          const meta = businessWeekdays.find((weekday) => weekday.key === day.day)
          const label = meta?.label ?? day.day
          const invalid = day.enabled && day.start !== "" && day.end !== "" && day.end <= day.start
          return (
            <li key={day.day} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  id={`hours-${day.day}`}
                  checked={day.enabled}
                  onCheckedChange={(enabled) => updateDay(index, { enabled })}
                />
                <label htmlFor={`hours-${day.day}`} className="w-32 text-sm font-medium text-foreground">
                  {label}
                </label>
              </div>
              {day.enabled ? (
                <div className="flex flex-col gap-1 sm:items-end">
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`${label}: início`}
                      value={day.start}
                      onChange={(event) => updateDay(index, { start: event.target.value })}
                      className="w-32"
                      aria-invalid={invalid || undefined}
                    />
                    <span className="text-sm text-muted-foreground">até</span>
                    <Input
                      type="time"
                      aria-label={`${label}: término`}
                      value={day.end}
                      onChange={(event) => updateDay(index, { end: event.target.value })}
                      className="w-32"
                      aria-invalid={invalid || undefined}
                    />
                  </div>
                  {invalid && <p className="text-xs text-destructive">O término deve ser depois do início.</p>}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Fechado</span>
              )}
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
