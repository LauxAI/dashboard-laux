"use client"

import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group"
import { PageHeader } from "@/components/shared/page-header"
import { ConversationStatusBadge } from "@/components/shared/status-badge"
import { demoConversations } from "@/lib/demo-data"
import { MessagesSquareIcon, SearchIcon, SendIcon } from "lucide-react"
import { ConversationListItem } from "./conversation-list-item"
import { cn } from "@/lib/utils"

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export default function ConversasPage() {
  const [activeId, setActiveId] = useState(demoConversations[0]?.id)
  const active = demoConversations.find((c) => c.id === activeId)

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-6">
      <PageHeader
        title="Conversas"
        description="Centralize e acompanhe o atendimento em todos os canais"
      />

      <Card className="flex min-h-0 flex-1 flex-row overflow-hidden p-0">
        <div className="flex w-full max-w-xs shrink-0 flex-col border-r border-border">
          <div className="border-b border-border p-3">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput placeholder="Buscar conversas" />
            </InputGroup>
          </div>
          <div className="flex-1 overflow-y-auto">
            {demoConversations.map((conversation) => (
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
                    <AvatarFallback>{initials(active.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{active.nome}</span>
                    <span className="text-xs text-muted-foreground">Responsável: {active.responsavel}</span>
                  </div>
                </div>
                <ConversationStatusBadge status={active.status} />
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-3">
                  {active.messages.map((message) => {
                    const isClient = message.sender === "cliente"
                    return (
                      <div
                        key={message.id}
                        className={cn("flex", isClient ? "justify-start" : "justify-end")}
                      >
                        <div
                          className={cn(
                            "max-w-md rounded-2xl px-4 py-2.5 text-sm",
                            isClient
                              ? "bg-card text-card-foreground"
                              : "bg-primary text-primary-foreground"
                          )}
                        >
                          <p className="leading-relaxed">{message.text}</p>
                          <span
                            className={cn(
                              "mt-1 block text-[11px]",
                              isClient ? "text-muted-foreground" : "text-primary-foreground/70"
                            )}
                          >
                            {message.sender === "ia" ? "Agente IA · " : null}
                            {message.time}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-border p-3">
                <InputGroup>
                  <InputGroupInput placeholder="Escreva uma mensagem..." />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="icon-xs">
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
      </Card>
    </div>
  )
}
