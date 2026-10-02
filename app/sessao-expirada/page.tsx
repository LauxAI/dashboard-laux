import Link from "next/link"
import { Clock, LogIn } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export default function SessionExpiredPage() {
  return (
    <AuthShell title="Sessão expirada" description="Por segurança, sua sessão foi encerrada">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Clock />
          </EmptyMedia>
          <EmptyTitle>Faça login novamente</EmptyTitle>
          <EmptyDescription>
            Você ficou inativo por um período prolongado. Entre novamente para continuar de onde parou.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <Button render={<Link href="/login" />} nativeButton={false}>
        <LogIn data-icon="inline-start" />
        Entrar novamente
      </Button>
    </AuthShell>
  )
}
