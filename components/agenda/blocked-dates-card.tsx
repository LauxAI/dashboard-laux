"use client"

import { useState, type FormEvent } from "react"
import { CalendarOff, PlusIcon, Trash2 } from "lucide-react"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import type { BlockedDate } from "@/lib/domain/types"
import { formatDayKey } from "./agenda-dates"

export function BlockedDatesCard({
  blockedDates,
  onChange,
}: {
  blockedDates: BlockedDate[]
  onChange: (blockedDates: BlockedDate[]) => void
}) {
  const [date, setDate] = useState("")
  const [reason, setReason] = useState("")

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!date || blockedDates.some((item) => item.date === date)) return
    const next = [...blockedDates, { id: crypto.randomUUID(), date, reason: reason.trim() || null }]
    onChange(next.sort((a, b) => a.date.localeCompare(b.date)))
    setDate("")
    setReason("")
  }

  return (
    <SectionCard title="Datas bloqueadas" description="Feriados, folgas e dias sem atendimento">
      <div className="flex flex-col gap-4">
        <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="date"
            aria-label="Data"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="sm:w-44"
            required
          />
          <Input
            aria-label="Motivo (opcional)"
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={80}
          />
          <Button type="submit" variant="outline">
            <PlusIcon data-icon="inline-start" />
            Bloquear
          </Button>
        </form>

        {blockedDates.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarOff />
              </EmptyMedia>
              <EmptyTitle>Nenhuma data bloqueada</EmptyTitle>
              <EmptyDescription>O agente não oferecerá horários nas datas adicionadas aqui.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {blockedDates.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{formatDayKey(item.date)}</span>
                  {item.reason && <span className="text-xs text-muted-foreground">{item.reason}</span>}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange(blockedDates.filter((blocked) => blocked.id !== item.id))}
                  aria-label={`Remover bloqueio de ${formatDayKey(item.date)}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  )
}
