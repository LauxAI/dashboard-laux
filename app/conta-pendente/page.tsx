import Link from "next/link"
import { Hourglass, LogIn } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export default function AccountPendingPage() {
  return (
    <AuthShell title="Conta em análise" description="Estamos configurando o ambiente da sua empresa">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Hourglass />
          </EmptyMedia>
          <EmptyTitle>Ativação em andamento</EmptyTitle>
          <EmptyDescription>
            Nosso time está finalizando a configuração dos seus agentes de IA e integrações. Você receberá um
            e-mail assim que tudo estiver pronto.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <Button render={<Link href="/login" />} nativeButton={false} variant="outline">
        <LogIn data-icon="inline-start" />
        Voltar para o login
      </Button>
    </AuthShell>
  )
}
