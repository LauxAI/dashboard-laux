"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { createAutomation } from "@/app/(dashboard)/automacoes/actions"
import { Button } from "@/components/ui/button"

export function NewAutomationButton({
  templateId = null,
  label = "Nova automação",
  variant = "default",
}: {
  templateId?: string | null
  label?: string
  variant?: "default" | "outline"
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const result = await createAutomation(templateId)
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        router.push(`/automacoes/${result.id}`)
      } catch {
        toast.error("Não foi possível criar a automação. Tente novamente.")
      }
    })
  }

  return (
    <Button type="button" variant={variant} onClick={handleCreate} disabled={isPending}>
      {templateId ? null : <PlusIcon data-icon="inline-start" />}
      {isPending ? "Criando..." : label}
    </Button>
  )
}
