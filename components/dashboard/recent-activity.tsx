import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { demoActivity } from "@/lib/demo-data"

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade recente</CardTitle>
        <CardDescription>Últimas ações da sua operação</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-5">
          {demoActivity.map((item, index) => (
            <li key={item.id} className="relative flex gap-3 pl-5">
              {index !== demoActivity.length - 1 && (
                <span aria-hidden="true" className="absolute left-[3px] top-3 h-full w-px bg-border" />
              )}
              <span aria-hidden="true" className="absolute left-0 top-1.5 size-1.5 rounded-full bg-primary" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium leading-none text-foreground">{item.titulo}</p>
                <p className="text-sm text-muted-foreground">{item.descricao}</p>
                <p className="text-xs text-muted-foreground">{item.horario}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
