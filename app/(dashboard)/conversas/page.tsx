import { MessagesSquareIcon } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState, ErrorState } from "@/components/states/states"
import { Card } from "@/components/ui/card"
import { getConversations } from "@/lib/data/queries"
import { ConversasClient } from "./conversas-client"

export default async function ConversasPage() {
  const { data: conversations, error } = await getConversations()

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-6">
      <PageHeader title="Conversas" description="Centralize e acompanhe o atendimento em todos os canais" />

      <Card className="flex min-h-0 flex-1 flex-row overflow-hidden p-0">
        {error ? (
          <ErrorState className="flex-1" description={error} />
        ) : conversations.length === 0 ? (
          <EmptyState
            className="flex-1"
            icon={MessagesSquareIcon}
            title="Nenhuma conversa ainda"
            description="As conversas dos seus canais conectados vão aparecer aqui."
          />
        ) : (
          <ConversasClient conversations={conversations} />
        )}
      </Card>
    </div>
  )
}
