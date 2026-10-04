import type { ReactNode } from "react"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function SectionCard({
  title,
  description,
  action,
  footer,
  children,
  className,
  contentClassName,
}: {
  title: string
  description?: string
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription className="text-pretty">{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
      {footer && <CardFooter className="justify-end gap-2 border-t">{footer}</CardFooter>}
    </Card>
  )
}
