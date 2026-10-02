"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      router.push("/login")
    }, 900)
  }

  return (
    <AuthShell title="Crie uma nova senha" description="Escolha uma senha forte para proteger sua conta">
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">Nova senha</FieldLabel>
            <InputGroup>
              <InputGroupInput id="password" type="password" placeholder="••••••••" required minLength={8} />
            </InputGroup>
            <FieldDescription>Mínimo de 8 caracteres, com letras e números.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">Confirme a nova senha</FieldLabel>
            <InputGroup>
              <InputGroupInput id="confirm-password" type="password" placeholder="••••••••" required minLength={8} />
            </InputGroup>
          </Field>
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
