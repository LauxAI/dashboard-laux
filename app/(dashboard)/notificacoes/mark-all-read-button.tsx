"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { markAllNotificationsRead } from "./actions"

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      disabled={disabled || isPending}
      onClick={() => startTransition(() => markAllNotificationsRead())}
    >
      Marcar todas como lidas
    </Button>
  )
}
