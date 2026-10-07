"use client"

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { ArrowRight, Eraser, FlaskConical, SendHorizontal } from "lucide-react"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { TEST_LIMITS, type ChatMessage } from "@/lib/ai/request"
import { parseStreamLine, splitStreamBuffer, type StreamSpecialistKey } from "@/lib/ai/stream-events"
import { cn } from "@/lib/utils"

type TraceStep = { specialist: StreamSpecialistKey; tool: string; success: boolean }
type UiMessage = ChatMessage & { trace?: TraceStep[] }

const specialistNames: Record<StreamSpecialistKey, string> = {
  scheduling: "Agendamento",
  sales: "Vendas",
  support: "Suporte",
}

const suggestions = [
  "Quero marcar um horário amanhã",
  "Quanto custa o serviço?",
  "Estou com um problema para acessar minha conta",
  "Quero cancelar meu agendamento",
  "Esse preço está muito caro",
]

function uniqueSpecialists(trace: TraceStep[]) {
  return trace.filter((step, index) => trace.findIndex((other) => other.specialist === step.specialist) === index)
}

function TraceLine({ trace }: { trace: TraceStep[] }) {
  const steps = uniqueSpecialists(trace)
  return (
    <p
      className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      aria-label="Fluxo usado nesta resposta, visível apenas no teste"
    >
      <span>Atendimento</span>
      {steps.map((step) => {
        const failed = trace.some((item) => item.specialist === step.specialist && !item.success)
        return (
          <span key={step.specialist} className="flex items-center gap-1.5">
            <ArrowRight className="size-3" aria-hidden="true" />
            <span className={cn(failed && "text-destructive")}>
              {specialistNames[step.specialist]}
              {failed && " (falhou)"}
            </span>
          </span>
        )
      })}
      <ArrowRight className="size-3" aria-hidden="true" />
      <span>Atendimento</span>
    </p>
  )
}

export function AgentTestChat({ canTest, agentName }: { canTest: boolean; agentName: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages, isLoading])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || isLoading || !canTest) return

    const history: UiMessage[] = [...messages, { role: "user", content }]
    setMessages(history)
    setDraft("")
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch("/api/agentes/testar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content: body }) => ({ role, content: body })) }),
      })

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setMessages(messages)
        setDraft(content)
        setError(data.error ?? "Não foi possível gerar a resposta.")
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let reply = ""
      let trace: TraceStep[] = []
      let finished = false
      let failure: string | null = null

      const handleLine = (line: string) => {
        const event = parseStreamLine(line)
        if (!event) return
        if (event.type === "specialist") {
          trace = [...trace, { specialist: event.specialist, tool: event.tool, success: event.success }]
          setMessages([...history, { role: "assistant", content: reply, trace }])
        } else if (event.type === "delta") {
          reply += event.text
          setMessages([...history, { role: "assistant", content: reply, trace }])
        } else if (event.type === "error") {
          failure = event.error
        } else {
          finished = true
          setNotice(
            event.usage.userExceeded || event.usage.companyExceeded
              ? "Seu volume de testes está acima do esperado. O agente continua funcionando, mas o uso está sendo monitorado."
              : null,
          )
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const { lines, rest } = splitStreamBuffer(buffer)
        buffer = rest
        lines.forEach(handleLine)
      }
      buffer += decoder.decode()
      if (buffer) handleLine(buffer)

      if (failure || !finished) {
        // Descarta a resposta parcial para não enviá-la como histórico ao modelo.
        setMessages(history)
        setError(failure ?? "A resposta foi interrompida. Tente novamente.")
      }
    } catch {
      setMessages(history)
      setError("Falha de conexão. Verifique sua internet e tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void send(draft)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    void send(draft)
  }

  const clear = () => {
    setMessages([])
    setError(null)
    setNotice(null)
  }

  const lastMessage = messages[messages.length - 1]

  return (
    <SectionCard
      title="Teste integrado"
      description="Simule uma conversa para verificar como o Atendimento e seus especialistas configurados irão responder aos clientes."
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
      <p
        role="note"
        className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground"
      >
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>Modo de teste — alterações reais na agenda estão desativadas. Consultas usam seus dados reais.</span>
      </p>

      {!canTest && (
        <p role="status" className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Preencha os campos obrigatórios e salve a configuração do Atendimento para testar. O teste funciona mesmo com
          o agente inativo.
        </p>
      )}

      <div
        className="flex h-96 flex-col gap-3 overflow-y-auto rounded-lg border bg-muted/30 p-3"
        role="log"
        aria-live="polite"
        aria-busy={isLoading}
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
            className={cn("flex max-w-[85%] flex-col gap-1", message.role === "user" ? "self-end" : "self-start")}
          >
            {message.trace && message.trace.length > 0 && <TraceLine trace={message.trace} />}
            {(message.content || message.role === "user") && (
              <div
                className={cn(
                  "whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border bg-card text-card-foreground",
                )}
              >
                {message.content}
              </div>
            )}
          </div>
        ))}
        {isLoading && (!lastMessage || lastMessage.role === "user" || !lastMessage.content) && (
          <div className="self-start rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
            Digitando...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">Experimente:</p>
        <ul className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canTest || isLoading}
                onClick={() => void send(suggestion)}
              >
                {suggestion}
              </Button>
            </li>
          ))}
        </ul>
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
