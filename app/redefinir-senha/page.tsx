"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Loader2 } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { createClient } from "@/lib/supabase/client"

type SessionState = "checking" | "valid" | "invalid"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [sessionState, setSessionState] = useState<SessionState>("checking")
  const [isLoading, setIsLoading] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data }) => {
      setSessionState(data.session ? "valid" : "invalid")
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionState("valid")
      }
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get("password") ?? "")
    const confirmPassword = String(formData.get("confirm-password") ?? "")

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.")
      return
    }

    setIsLoading(true)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    setIsLoading(false)

    if (updateError) {
      setError("Não foi possível redefinir sua senha. O link pode ter expirado, solicite um novo.")
      return
    }

    setIsDone(true)
  }

  if (sessionState === "checking") {
    return (
      <AuthShell title="Crie uma nova senha" description="Escolha uma senha forte para proteger sua conta">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AuthShell>
    )
  }

  if (sessionState === "invalid") {
    return (
      <AuthShell
        title="Crie uma nova senha"
        description="Escolha uma senha forte para proteger sua conta"
        footer={
          <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
            <ArrowLeft className="size-3.5" />
            Voltar para o login
          </Link>
        }
      >
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>Link inválido ou expirado</EmptyTitle>
            <EmptyDescription>
              Este link de redefinição de senha não é mais válido. Solicite um novo link para continuar.
            </EmptyDescription>
          </EmptyHeader>
          <Link href="/esqueci-senha">
            <Button variant="outline">Solicitar novo link</Button>
          </Link>
        </Empty>
      </AuthShell>
    )
  }

  if (isDone) {
    return (
      <AuthShell title="Crie uma nova senha" description="Escolha uma senha forte para proteger sua conta">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle2 />
            </EmptyMedia>
            <EmptyTitle>Senha redefinida</EmptyTitle>
            <EmptyDescription>Sua senha foi alterada com sucesso. Agora você já pode entrar.</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => router.push("/login")}>Ir para o login</Button>
        </Empty>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Crie uma nova senha" description="Escolha uma senha forte para proteger sua conta">
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">Nova senha</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </InputGroup>
            <FieldDescription>Mínimo de 8 caracteres, com letras e números.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">Confirme a nova senha</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="confirm-password"
                name="confirm-password"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </InputGroup>
          </Field>
          {error ? (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={isLoading} className="mt-1">
            {isLoading ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <KeyRound data-icon="inline-start" />
            )}
            {isLoading ? "Salvando..." : "Redefinir senha"}
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
