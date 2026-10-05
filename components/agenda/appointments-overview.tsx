"use client"

import { useMemo, useState } from "react"
import { CalendarDays } from "lucide-react"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/states/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Appointment } from "@/lib/domain/types"
import { formatAgendaTime, formatDayKey, toDayKey, weekDayKeys } from "./agenda-dates"

type View = "hoje" | "semana" | "proximos"

const emptyCopy: Record<View, { title: string; description: string }> = {
  hoje: { title: "Nenhum agendamento hoje", description: "Os compromissos marcados para hoje aparecerão aqui." },
  semana: { title: "Nenhum agendamento nesta semana", description: "Os compromissos de segunda a domingo aparecerão aqui." },
  proximos: {
    title: "Nenhum agendamento futuro",
    description: "Agendamentos feitos pela equipe ou pelo Agente de Agendamento aparecerão aqui.",
  },
}

function groupByDay(appointments: Appointment[]) {
  const groups = new Map<string, Appointment[]>()
  for (const appointment of appointments) {
    const key = toDayKey(appointment.startsAt)
    groups.set(key, [...(groups.get(key) ?? []), appointment])
  }
  return [...groups.entries()]
}

export function AppointmentsOverview({ appointments }: { appointments: Appointment[] }) {
  const [view, setView] = useState<View>("hoje")

  const visible = useMemo(() => {
    const now = new Date()
    const todayKey = toDayKey(now)
    const week = new Set(weekDayKeys(todayKey))
    const sorted = [...appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    if (view === "hoje") return sorted.filter((item) => toDayKey(item.startsAt) === todayKey)
    if (view === "semana") return sorted.filter((item) => week.has(toDayKey(item.startsAt)))
    return sorted.filter((item) => new Date(item.startsAt) >= now)
  }, [appointments, view])

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={view} onValueChange={(value) => setView(value as View)}>
        <TabsList aria-label="Período">
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="proximos">Próximos</TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <EmptyState icon={CalendarDays} title={emptyCopy[view].title} description={emptyCopy[view].description} />
      ) : (
        <div className="flex flex-col gap-4">
          {groupByDay(visible).map(([dayKey, items]) => (
            <Card key={dayKey}>
              <CardHeader>
                <CardTitle className="text-base">{formatDayKey(dayKey)}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y divide-border">
                  {items.map((appointment) => (
                    <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-4">
                        <span className="w-28 shrink-0 text-sm tabular-nums text-muted-foreground">
                          {formatAgendaTime(appointment.startsAt)}
                          {appointment.endsAt ? ` – ${formatAgendaTime(appointment.endsAt)}` : ""}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{appointment.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {[appointment.clientName, appointment.ownerName].filter(Boolean).join(" · ") ||
                              "Sem participantes"}
                          </span>
                        </div>
                      </div>
                      <StatusBadge kind="appointment" status={appointment.status} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
