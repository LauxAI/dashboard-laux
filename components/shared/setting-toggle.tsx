"use client"

import { useId } from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export function SettingToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn("flex items-start justify-between gap-4 py-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {description && <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-0.5" />
    </div>
  )
}
