import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
        <Sparkles data-icon="inline-start" />
        Dados de demonstração
      </Badge>
      <span>Estes dados são ilustrativos. Conecte o Supabase para ver a operação real da sua empresa.</span>
    </div>
  )
}
