import Link from "next/link"
import { Ban, MessageCircle } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export default function AccountSuspendedPage() {
  return (
    <AuthShell title="Conta suspensa" description="O acesso a esta conta foi temporariamente suspenso">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <Ban />
          </EmptyMedia>
          <EmptyTitle>Entre em contato com o suporte</EmptyTitle>
          <EmptyDescription>
            Identificamos uma pendência no pagamento ou nos termos de uso da sua conta. Fale com nosso time para
            reativar o acesso.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <Button render={<Link href="#" />} nativeButton={false} variant="outline">
        <MessageCircle data-icon="inline-start" />
        Falar com o suporte
      </Button>
    </AuthShell>
  )
}
