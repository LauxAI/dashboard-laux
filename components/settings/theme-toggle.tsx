"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isLight = mounted && resolvedTheme === "light"
  const label = isLight ? "Alternar para tema escuro" : "Alternar para tema claro"

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      aria-label={label}
      title={label}
      disabled={!mounted}
      onClick={() => setTheme(isLight ? "dark" : "light")}
    >
      {isLight ? <Moon /> : <Sun />}
    </Button>
  )
}
