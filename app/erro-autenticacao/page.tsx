import Link from "next/link"
import { LogIn, ShieldAlert } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export default function AuthErrorPage() {
  return (
    <AuthShell title="Não foi possível entrar" description="Ocorreu um erro ao autenticar sua conta">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>Erro de autenticação</EmptyTitle>
          <EmptyDescription>
            O link que você usou pode ter expirado ou já ter sido utilizado. Tente entrar novamente ou solicite
            um novo link de acesso.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <Button render={<Link href="/login" />} nativeButton={false}>
        <LogIn data-icon="inline-start" />
        Voltar para o login
      </Button>
    </AuthShell>
  )
}
