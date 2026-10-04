"use client"

import { useMemo, useState } from "react"
import { Bell } from "lucide-react"
import { OptionSelect } from "@/components/shared/option-select"
import { Toolbar } from "@/components/shared/toolbar"
import { EmptyState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { notificationCategories } from "@/lib/domain/catalogs"
import type { Notification } from "@/lib/domain/types"
import { formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const categoryOptions = Object.entries(notificationCategories).map(([value, { label }]) => ({ value, label }))
const readOptions = [
  { value: "nao_lidas", label: "Não lidas" },
  { value: "lidas", label: "Lidas" },
]

export function NotificationsList({ notifications }: { notifications: Notification[] }) {
  const [category, setCategory] = useState("todos")
  const [readFilter, setReadFilter] = useState("todos")

  const filtered = useMemo(
    () =>
      notifications.filter(
        (n) =>
          (category === "todos" || n.category === category) &&
          (readFilter === "todos" || (readFilter === "lidas" ? n.read : !n.read)),
      ),
    [notifications, category, readFilter],
  )

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <OptionSelect value={category} onValueChange={setCategory} options={categoryOptions} allLabel="Todas as categorias" ariaLabel="Filtrar por categoria" />
        <OptionSelect value={readFilter} onValueChange={setReadFilter} options={readOptions} allLabel="Todas" ariaLabel="Filtrar por leitura" />
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState icon={Bell} title="Nenhuma notificação" description="Você está em dia por aqui." />
      ) : (
        <Card className="p-0">
          <ul className="flex flex-col divide-y divide-border">
            {filtered.map((n) => (
              <li key={n.id} className="flex items-start gap-3 p-4">
                <span
                  aria-hidden="true"
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-sm text-foreground", !n.read && "font-medium")}>{n.title}</span>
                    <Badge variant="secondary" className="font-normal">
                      {notificationCategories[n.category].label}
                    </Badge>
                    {!n.read && <span className="sr-only">(não lida)</span>}
                  </div>
                  {n.message && <p className="text-sm leading-relaxed text-muted-foreground">{n.message}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
