import { Skeleton } from "@/components/ui/skeleton"

export type SkeletonVariant = "dashboard" | "table" | "cards" | "split" | "form"

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  )
}

export function PageSkeleton({ variant = "table" }: { variant?: SkeletonVariant }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <HeaderSkeleton />
      {variant === "dashboard" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-80 rounded-xl lg:col-span-2" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </>
      )}
      {variant === "table" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-8 w-36" />
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}
      {variant === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}
      {variant === "split" && (
        <div className="flex h-[calc(100svh-12rem)] gap-4">
          <Skeleton className="h-full w-full rounded-xl md:w-80" />
          <Skeleton className="hidden h-full flex-1 rounded-xl md:block" />
        </div>
      )}
      {variant === "form" && (
        <div className="flex max-w-3xl flex-col gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      )}
    </div>
  )
}
