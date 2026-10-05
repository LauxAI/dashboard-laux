"use client"

import { useState } from "react"
import { OptionSelect } from "@/components/shared/option-select"
import { SectionCard } from "@/components/shared/section-card"
import { UnsavedNotice } from "@/components/shared/unsaved-notice"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { appointmentBufferOptions, businessWeekdays } from "@/lib/domain/catalogs"
import type { BlockedDate, BookableService, BusinessHoursDay } from "@/lib/domain/types"
import { notifyPendingBackend } from "@/lib/services/pending"
import { BlockedDatesCard } from "./blocked-dates-card"
import { BusinessHoursCard } from "./business-hours-card"
import { ServicesCard } from "./services-card"

const initialHours: BusinessHoursDay[] = businessWeekdays.map((weekday) => ({
  day: weekday.key,
  enabled: false,
  start: "",
  end: "",
}))

export function AvailabilitySettings() {
  const [hours, setHours] = useState(initialHours)
  const [services, setServices] = useState<BookableService[]>([])
  const [buffer, setBuffer] = useState("0")
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])

  return (
    <div className="flex flex-col gap-6">
      <UnsavedNotice description="Horários, serviços e bloqueios ficam apenas nesta tela por enquanto. Quando o armazenamento for conectado, o Agente de Agendamento passará a usar estas regras." />

      <div className="grid gap-6 xl:grid-cols-2">
        <BusinessHoursCard hours={hours} onChange={setHours} />
        <div className="flex flex-col gap-6">
          <ServicesCard services={services} onChange={setServices} />
          <SectionCard title="Intervalo entre atendimentos" description="Tempo livre reservado após cada agendamento">
            <Field>
              <FieldLabel htmlFor="appointment-buffer">Intervalo</FieldLabel>
              <OptionSelect
                name="buffer"
                value={buffer}
                onValueChange={(value) => setBuffer(value || "0")}
                options={appointmentBufferOptions}
                ariaLabel="Intervalo entre atendimentos"
                className="sm:w-56"
              />
              <FieldDescription>Evita que o agente marque horários colados um no outro.</FieldDescription>
            </Field>
          </SectionCard>
        </div>
      </div>

      <BlockedDatesCard blockedDates={blockedDates} onChange={setBlockedDates} />

      <div className="flex justify-end">
        <Button onClick={() => notifyPendingBackend("Salvar disponibilidade da agenda")}>Salvar disponibilidade</Button>
      </div>
    </div>
  )
}
