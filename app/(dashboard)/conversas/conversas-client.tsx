"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group"
import { Badge } from "@/components/ui/badge"
import { formatDateTimeBRL, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Conversation, Message } from "@/lib/domain/types"
import { MessagesSquareIcon, SendIcon } from "lucide-react"
import { sendMessage } from "./actions"

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

const conversationStatusLabel: Record<string, string> = {
  aberta: "Aberta",
  pendente: "Pendente",
  resolvida: "Resolvida",
}

const fetcher = (url: string) =>
  fetch(url).then(async (res) => {
    if (!res.ok) throw new Error("Falha ao carregar mensagens")
    const body = (await res.json()) as { messages: Message[] }
    return body.messages
  })

function ConversationListItem({
  conversation,
  isActive,
  onSelect,
}: {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50",
        isActive && "bg-muted",
      )}
    >
      <Avatar>
        <AvatarFallback>{initials(conversation.contactName)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{conversation.contactName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(conversation.updatedAt)}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{conversation.lastMessage ?? "Sem mensagens"}</p>
        <span className="text-[11px] capitalize text-muted-foreground">{conversation.channel}</span>
      </div>
      {conversation.unreadCount > 0 && (
        <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
          {conversation.unreadCount}
        </span>
      )}
    </button>
  )
}

export function ConversasClient({ conversations }: { conversations: Conversation[] }) {
  const [activeId, setActiveId] = useState(conversations[0]?.id)
  const [draft, setDraft] = useState("")
  const [isPending, startTransition] = useTransition()
  const active = conversations.find((c) => c.id === activeId)

  const { data: messages, mutate } = useSWR(
    active ? `/api/conversations/${active.id}/messages` : null,
    fetcher,
  )

  function handleSend() {
    const text = draft.trim()
    if (!text || !active) return
    setDraft("")
    startTransition(async () => {
      await sendMessage(active.id, text)
      mutate()
    })
  }

  return (
    <>
      <div className="flex w-full max-w-xs shrink-0 flex-col border-r border-border">
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeId}
              onSelect={() => setActiveId(conversation.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{initials(active.contactName)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{active.contactName}</span>
                  <span className="text-xs capitalize text-muted-foreground">{active.channel}</span>
                </div>
              </div>
              <Badge variant="outline" className="font-normal">
                {conversationStatusLabel[active.status] ?? active.status}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-3">
                {(messages ?? []).map((message) => {
                  const isClient = message.sender === "cliente"
                  return (
                    <div key={message.id} className={cn("flex", isClient ? "justify-start" : "justify-end")}>
                      <div
                        className={cn(
                          "max-w-md rounded-2xl px-4 py-2.5 text-sm",
                          isClient ? "bg-card text-card-foreground" : "bg-primary text-primary-foreground",
                        )}
                      >
                        <p className="leading-relaxed">{message.content}</p>
                        <span
                          className={cn(
                            "mt-1 block text-[11px]",
                            isClient ? "text-muted-foreground" : "text-primary-foreground/70",
                          )}
                        >
                          {message.sender === "ia" ? "Agente IA · " : null}
                          {formatDateTimeBRL(message.createdAt)}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {messages?.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma mensagem nesta conversa ainda.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-border p-3">
              <InputGroup>
                <InputGroupInput
                  placeholder="Escreva uma mensagem..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" onClick={handleSend} disabled={isPending || !draft.trim()}>
                    <SendIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </>
        ) : (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessagesSquareIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma conversa selecionada</EmptyTitle>
              <EmptyDescription>Escolha uma conversa na lista para visualizar as mensagens.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </>
  )
}
