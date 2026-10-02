import { cn } from "@/lib/utils"

export function LauxaiMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-sm",
        className,
      )}
    >
      L
    </div>
  )
}

export function LauxaiLogo({
  className,
  showWordmark = true,
}: {
  className?: string
  showWordmark?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LauxaiMark />
      {showWordmark && (
        <span className="text-sm font-semibold tracking-wide text-foreground">
          LAUXAI <span className="text-muted-foreground font-normal">CORE</span>
        </span>
      )}
    </div>
  )
}
