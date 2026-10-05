import { Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function UnsavedNotice({
  title = "Configuração em prévia",
  description = "As alterações feitas aqui ficam apenas nesta tela e ainda não são salvas. A gravação será ativada quando o armazenamento desta área for conectado.",
}: {
  title?: string
  description?: string
}) {
  return (
    <Alert className="border-border bg-muted/40">
      <Info className="text-muted-foreground" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-pretty">{description}</AlertDescription>
    </Alert>
  )
}
