"use client"

import { useState, type FormEvent, type KeyboardEvent } from "react"
import { AlertCircle, Loader2, Send, Sparkles } from "lucide-react"
import { SectionCard } from "@/components/shared/section-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const EXAMPLE_MESSAGE =
  "Olá, você é o assistente de IA do LAUXAI. Responda confirmando que a integração está funcionando."

interface ChatResult {
  reply: string
  model: string
}

export function AiChatTester() {
  const [message, setMessage] = useState(EXAMPLE_MESSAGE)
  const [result, setResult] = useState<ChatResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function send() {
    const trimmed = message.trim()
    if (!trimmed || isLoading) return

    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = (await response.json().catch(() => ({}))) as Partial<ChatResult> & { error?: string }
      if (!response.ok || !data.reply) {
        setError(data.error ?? "Não foi possível obter uma resposta da IA.")
        return
      }
      setResult({ reply: data.reply, model: data.model ?? "" })
    } catch {
      setError("Falha de conexão com o servidor. Verifique sua internet e tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Mensagem" description="A chamada é feita exclusivamente pelo servidor via /api/ai/chat.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-message">Escreva sua mensagem</Label>
            <Textarea
              id="ai-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={6}
              maxLength={4000}
              placeholder="Digite algo para a IA..."
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">Dica: Ctrl + Enter para enviar.</p>
          </div>
          <Button type="submit" disabled={isLoading || !message.trim()} className="w-fit">
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            {isLoading ? "Enviando..." : "Enviar para IA"}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Resposta" description="Texto retornado pelo Gemini.">
        <div aria-live="polite" className="flex min-h-40 flex-col gap-3">
          {isLoading && (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Aguardando resposta do Gemini...
            </div>
          )}

          {!isLoading && error && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Erro ao consultar a IA</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isLoading && result && (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{result.reply}</p>
              {result.model && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Modelo: {result.model}
                </p>
              )}
            </>
          )}

          {!isLoading && !error && !result && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              A resposta aparecerá aqui.
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
