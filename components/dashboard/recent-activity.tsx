import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Activity as ActivityIcon } from "lucide-react"
import type { Activity } from "@/lib/data/queries"
import { formatRelativeTime } from "@/lib/format"

export function RecentActivity({ activities = [] }: { activities?: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade recente</CardTitle>
        <CardDescription>Últimas ações da sua operação</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ActivityIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma atividade ainda</EmptyTitle>
              <EmptyDescription>As ações da sua operação aparecem aqui.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol className="flex flex-col gap-5">
            {activities.map((item, index) => (
              <li key={item.id} className="relative flex gap-3 pl-5">
                {index !== activities.length - 1 && (
                  <span aria-hidden="true" className="absolute left-[3px] top-3 h-full w-px bg-border" />
                )}
                <span aria-hidden="true" className="absolute left-0 top-1.5 size-1.5 rounded-full bg-primary" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium leading-none text-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
