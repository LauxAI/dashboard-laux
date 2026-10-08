"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function ThemePreference() {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      multiple
      value={theme ? [theme] : []}
      onValueChange={(values) => values[0] && setTheme(values[0])}
      variant="outline"
      aria-label="Tema da aplicação"
      className="w-full justify-start sm:w-auto"
    >
      <ToggleGroupItem value="light" aria-label="Usar tema claro" className="gap-2 px-3">
        <Sun data-icon="inline-start" />
        Claro
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Usar tema escuro" className="gap-2 px-3">
        <Moon data-icon="inline-start" />
        Escuro
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
