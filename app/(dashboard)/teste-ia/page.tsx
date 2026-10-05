import { AiChatTester } from "@/components/ai/ai-chat-tester"
import { PageHeader } from "@/components/shared/page-header"

export const metadata = { title: "Teste de IA" }

export default function AiTestPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teste de IA"
        description="Envie uma mensagem ao Gemini pelo servidor do LAUXAI e confira a resposta real."
      />
      <AiChatTester />
    </div>
  )
}
