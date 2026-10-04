import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * Logotipo oficial LAUXAI CORE — arquivo original recortado, sem redesenho.
 * Proporções preservadas pela largura/altura intrínsecas + `h-auto`.
 */
export function LauxaiLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/lauxai-core-logo.png"
      alt="LAUXAI CORE"
      width={358}
      height={97}
      priority={priority}
      className={cn("h-auto w-36 select-none", className)}
    />
  )
}

/** Símbolo "L" oficial, para sidebar recolhida e espaços reduzidos. */
export function LauxaiMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/lauxai-mark.png"
      alt="LAUXAI"
      width={79}
      height={83}
      className={cn("h-auto w-7 shrink-0 select-none", className)}
    />
  )
}
