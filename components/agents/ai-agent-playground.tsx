"use client"

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { Eraser, SendHorizontal } from "lucide-react"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { TEST_LIMITS, type ChatMessage } from "@/lib/ai/request"
import type { AIAgentType } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

export function AIAgentPlayground({
  type,
  canTest,
  agentName,
}: {
  type: AIAgentType
  canTest: boolean
  agentName: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages, isLoading])

  const send = async () => {
    const content = draft.trim()
    if (!content || isLoading || !canTest) return

    const next: ChatMessage[] = [...messages, { role: "user", content }]
    setMessages(next)
    setDraft("")
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch(`/api/agentes/${type}/testar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      })
      const data = (await response.json().catch(() => ({}))) as {
        reply?: string
        error?: string
        usage?: { userExceeded: boolean; companyExceeded: boolean }
      }
      if (!response.ok || !data.reply) {
        setError(data.error ?? "Não foi possível gerar a resposta.")
        return
      }
      setMessages([...next, { role: "assistant", content: data.reply }])
      setNotice(
        data.usage?.userExceeded || data.usage?.companyExceeded
          ? "Seu volume de testes está acima do esperado. O agente continua funcionando, mas o uso está sendo monitorado."
          : null,
      )
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void send()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    void send()
  }

  const clear = () => {
    setMessages([])
    setError(null)
    setNotice(null)
  }

  return (
    <SectionCard
      title="Testar agente"
      description="Converse com o agente usando a configuração salva. Nada é enviado a clientes."
      action={
        messages.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Eraser data-icon="inline-start" />
            Limpar
          </Button>
        ) : undefined
      }
      contentClassName="flex flex-col gap-3"
    >
      {!canTest && (
        <p role="status" className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Preencha os campos obrigatórios e salve as configurações para testar o agente. O teste funciona mesmo com o
          agente inativo.
        </p>
      )}

      <div
        className="flex h-80 flex-col gap-3 overflow-y-auto rounded-lg border bg-muted/30 p-3"
        role="log"
        aria-live="polite"
        aria-label="Conversa de teste"
      >
        {messages.length === 0 && !isLoading && (
          <p className="m-auto text-center text-sm text-muted-foreground">
            Envie uma mensagem para conversar com {agentName}.
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-relaxed",
              message.role === "user"
                ? "self-end bg-primary text-primary-foreground"
                : "self-start border bg-card text-card-foreground",
            )}
          >
            {message.content}
          </div>
        ))}
        {isLoading && (
          <div className="self-start rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
            Digitando...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem"
          aria-label="Mensagem de teste"
          rows={2}
          maxLength={TEST_LIMITS.maxUserChars}
          disabled={!canTest}
        />
        <Button type="submit" size="icon" disabled={!canTest || isLoading || !draft.trim()} aria-label="Enviar mensagem">
          <SendHorizontal />
        </Button>
      </form>
    </SectionCard>
  )
}
