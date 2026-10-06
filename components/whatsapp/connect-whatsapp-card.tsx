"use client"

import { useState, useTransition } from "react"
import { Info, MessageCircle } from "lucide-react"
import { startWhatsAppConnection } from "@/app/(dashboard)/whatsapp/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Feedback = { tone: "info" | "error"; message: string }

export function ConnectWhatsAppCard({ previousNumber }: { previousNumber?: string | null }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleConnect = () => {
    setFeedback(null)
    startTransition(async () => {
      try {
        const result = await startWhatsAppConnection()
        if ("error" in result) setFeedback({ tone: "error", message: result.error })
        else setFeedback({ tone: "info", message: result.message })
      } catch {
        setFeedback({ tone: "error", message: "Não foi possível iniciar a conexão. Tente novamente." })
      }
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 px-6 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <MessageCircle className="size-6" aria-hidden="true" />
        </div>
        <div className="flex max-w-md flex-col gap-2">
          <h2 className="text-balance text-lg font-semibold text-foreground">Nenhum número conectado</h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Conecte o WhatsApp da sua empresa ao LAUXAI e permita que seus agentes atendam seus clientes
            automaticamente.
          </p>
          {previousNumber && (
            <p className="text-pretty text-xs text-muted-foreground">
              O número {previousNumber} foi desconectado. O histórico de conversas foi mantido.
            </p>
          )}
        </div>
        <Button size="lg" onClick={handleConnect} disabled={isPending}>
          <MessageCircle data-icon="inline-start" />
          {isPending ? "Iniciando..." : "Conectar WhatsApp"}
        </Button>
        <div aria-live="polite" className="w-full max-w-md">
          {feedback && (
            <Alert variant={feedback.tone === "error" ? "destructive" : "default"} className="text-left">
              <Info aria-hidden="true" />
              <AlertDescription>{feedback.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
