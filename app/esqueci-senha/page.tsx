"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setIsSent(true)
    }, 900)
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
            <Input id="email" type="email" placeholder="voce@suaempresa.com.br" required autoFocus />
          </Field>
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
