import type { ReactNode } from "react"
import { LauxaiLogo } from "@/components/brand/logo"

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.58_0.21_25_/_0.12),transparent)]"
      />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <LauxaiLogo />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-balance text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="text-pretty text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          {children}
        </div>
        {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  )
}
