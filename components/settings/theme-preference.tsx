"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function ThemePreference() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <ToggleGroup
      multiple
      value={mounted && (theme === "light" || theme === "dark") ? [theme] : undefined}
      onValueChange={(values) => values[0] && setTheme(values[0])}
      variant="outline"
      aria-label="Tema da aplicação"
      disabled={!mounted}
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
