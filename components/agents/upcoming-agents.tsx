import { Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { upcomingAgents } from "@/lib/domain/catalogs"

export function UpcomingAgents() {
  return (
    <section aria-labelledby="upcoming-agents-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="upcoming-agents-title" className="text-base font-semibold text-foreground">
          Em breve
        </h2>
        <p className="text-sm text-muted-foreground">Novos agentes que estarão disponíveis para a sua empresa.</p>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {upcomingAgents.map((agent) => (
          <li
            key={agent.key}
            className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-card/40 p-4"
            aria-disabled="true"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                <agent.icon className="size-4" aria-hidden="true" />
              </div>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                <Lock aria-hidden="true" />
                Bloqueado
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-foreground">{agent.name}</h3>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{agent.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
