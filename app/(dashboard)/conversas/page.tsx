import { PageHeader } from "@/components/shared/page-header"
import { Card } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getConversations } from "@/lib/data/queries"
import { MessagesSquareIcon } from "lucide-react"
import { ConversasClient } from "./conversas-client"

export default async function ConversasPage() {
  const conversations = await getConversations()

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-6">
      <PageHeader title="Conversas" description="Centralize e acompanhe o atendimento em todos os canais" />

      <Card className="flex min-h-0 flex-1 flex-row overflow-hidden p-0">
        {conversations.length === 0 ? (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessagesSquareIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma conversa ainda</EmptyTitle>
              <EmptyDescription>
                As conversas dos seus canais conectados vão aparecer aqui.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ConversasClient conversations={conversations} />
        )}
      </Card>
    </div>
  )
}
