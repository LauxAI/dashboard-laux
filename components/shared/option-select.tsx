"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type SelectOption = { value: string; label: string }

/** Select com rótulos legíveis no gatilho. Use `allLabel` para incluir a opção "todos". */
export function OptionSelect({
  value,
  onValueChange,
  options,
  placeholder = "Selecionar",
  allLabel,
  ariaLabel,
  className,
  size = "default",
  name,
  disabled,
}: {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  allLabel?: string
  ariaLabel?: string
  className?: string
  size?: "sm" | "default"
  name?: string
  disabled?: boolean
}) {
  const items = allLabel ? [{ value: "todos", label: allLabel }, ...options] : options
  return (
    <Select
      items={items}
      value={value || null}
      name={name}
      disabled={disabled}
      onValueChange={(next) => onValueChange((next as string | null) ?? "")}
    >
      <SelectTrigger size={size} aria-label={ariaLabel} className={cn("w-full sm:w-44", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
