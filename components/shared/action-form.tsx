"use client"

import { useTransition, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export type ActionResult = { error?: string | null; success?: boolean } | void

/**
 * Formulário que envia para uma Server Action e dá feedback por toast.
 * A action continua sendo a fonte da verdade da validação.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Salvar alterações",
  successMessage = "Alterações salvas.",
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  children: ReactNode
  submitLabel?: string
  successMessage?: string
  className?: string
}) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await action(formData)
      if (result && result.error) toast.error(result.error)
      else toast.success(successMessage)
    })
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <fieldset disabled={isPending} className="flex flex-col gap-6">
        {children}
        <div className="flex justify-end">
          <Button type="submit">
            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {submitLabel}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
