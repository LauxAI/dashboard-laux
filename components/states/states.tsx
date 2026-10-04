"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { CircleAlert, Lock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"

export { EmptyState } from "@/components/states/empty-state"

export function ErrorState({
  title = "Não foi possível carregar",
  description,
  onRetry,
  className,
}: {
  title?: string
  description: string
  onRetry?: () => void
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const retry = onRetry ?? (() => startTransition(() => router.refresh()))

  return (
    <Empty className={cn("min-h-64", className)} role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription className="text-pretty">{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={retry} disabled={isPending}>
          <RefreshCw className={cn(isPending && "animate-spin")} />
          Tentar novamente
        </Button>
      </EmptyContent>
    </Empty>
  )
}

export function NoPermissionState({
  area,
  className,
}: {
  area: string
  className?: string
}) {
  return (
    <Empty className={cn("min-h-64", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock />
        </EmptyMedia>
        <EmptyTitle>Acesso restrito</EmptyTitle>
        <EmptyDescription className="text-pretty">
          Seu perfil não tem permissão para acessar {area}. Fale com um administrador da sua empresa.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
