"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Conversation } from "@/lib/types"

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

const channelLabel: Record<Conversation["canal"], string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
}

export function ConversationListItem({
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
        isActive && "bg-muted"
      )}
    >
      <Avatar size="sm">
        <AvatarFallback>{initials(conversation.nome)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{conversation.nome}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{conversation.horario}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{conversation.ultimaMensagem}</p>
        <span className="text-[11px] text-muted-foreground">{channelLabel[conversation.canal]}</span>
      </div>
      {conversation.naoLidas > 0 && (
        <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
          {conversation.naoLidas}
        </span>
      )}
    </button>
  )
}
