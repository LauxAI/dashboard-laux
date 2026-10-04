"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { notifyPendingBackend } from "@/lib/services/pending"

export function PendingActionButton({
  action,
  children,
  variant = "default",
  size = "default",
}: {
  action: string
  children: ReactNode
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm"
}) {
  return (
    <Button variant={variant} size={size} onClick={() => notifyPendingBackend(action)}>
      {children}
    </Button>
  )
}
