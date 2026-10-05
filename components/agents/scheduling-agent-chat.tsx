"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { AlertCircle, Bot, Loader2, RotateCcw, Send } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SchedulingAgentConfig } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
}

const MAX_MESSAGE_LENGTH = 4000;

export function SchedulingAgentChat({
  config,
}: {
  config: SchedulingAgentConfig;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentName = config.name.trim() || "Agente de Agendamento";
  const greeting = config.greeting.trim();

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, isLoading]);

  async function send() {
    const text = draft.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setDraft("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/agents/scheduling/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          messages: history.map(({ role, text: messageText }) => ({
            role,
            text: messageText,
          })),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };
      if (!response.ok || !data.reply) {
        setError(
          data.error ?? "Não foi possível obter uma resposta do agente.",
        );
        setMessages(messages);
        setDraft(text);
        return;
      }
      setMessages([
        ...history,
        { id: crypto.randomUUID(), role: "model", text: data.reply },
      ]);
    } catch {
      setError(
        "Falha de conexão com o servidor. Verifique sua internet e tente novamente.",
      );
      setMessages(messages);
      setDraft(text);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  function reset() {
    setMessages([]);
    setDraft("");
    setError(null);
  }

  return (
    <SectionCard
      title="Testar conversa"
      description="Converse com o agente usando a configuração atual. O histórico fica apenas nesta página."
      contentClassName="flex flex-col gap-4"
    >
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={`Conversa com ${agentName}`}
        className="flex h-96 flex-col gap-3 overflow-y-auto rounded-lg border bg-muted/30 p-4"
      >
        {greeting && <Bubble role="model" author={agentName} text={greeting} />}

        {!greeting && messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Bot className="size-6" aria-hidden="true" />
            <p className="text-pretty">
              Envie uma mensagem como se você fosse um cliente para testar o
              agente.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <Bubble
            key={message.id}
            role={message.role}
            author={message.role === "user" ? "Você" : agentName}
            text={message.text}
          />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {agentName} está digitando...
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        A agenda ainda não está conectada: o agente não consulta horários reais
        nem cria agendamentos.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="agent-chat-message" className="sr-only">
          Mensagem para o agente
        </label>
        <Textarea
          id="agent-chat-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Ex.: Olá, queria marcar uma consulta."
          className="resize-none"
          disabled={isLoading}
        />
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={isLoading || messages.length === 0}
          >
            <RotateCcw data-icon="inline-start" />
            Reiniciar
          </Button>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Enter envia · Shift + Enter quebra linha
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !draft.trim()}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </form>
    </SectionCard>
  );
}

function Bubble({
  role,
  author,
  text,
}: {
  role: ChatMessage["role"];
  author: string;
  text: string;
}) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-1",
        isUser ? "self-end items-end" : "self-start items-start",
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">
        {author}
      </span>
      <p
        className={cn(
          "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border bg-card text-card-foreground",
        )}
      >
        {text}
      </p>
    </div>
  );
}
