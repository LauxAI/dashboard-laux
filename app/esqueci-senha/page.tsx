"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertCircle, ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "").trim()

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })

    setIsLoading(false)

    if (resetError) {
      setError("Não foi possível enviar o e-mail de redefinição. Tente novamente em alguns instantes.")
      return
    }

    setIsSent(true)
  }

  if (isSent) {
    return (
      <AuthShell
        title="Verifique seu e-mail"
        description="Enviamos as instruções de redefinição de senha"
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
              <MailCheck />
            </EmptyMedia>
            <EmptyTitle>E-mail enviado</EmptyTitle>
            <EmptyDescription>
              Se houver uma conta associada a esse e-mail, você receberá um link para redefinir sua senha em
              poucos minutos.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Esqueceu sua senha?"
      description="Informe seu e-mail e enviaremos um link de redefinição"
      footer={
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
          <ArrowLeft className="size-3.5" />
          Voltar para o login
        </Link>
      }
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" name="email" type="email" placeholder="voce@suaempresa.com.br" required autoFocus />
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
              <Mail data-icon="inline-start" />
            )}
            {isLoading ? "Enviando..." : "Enviar link de redefinição"}
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
