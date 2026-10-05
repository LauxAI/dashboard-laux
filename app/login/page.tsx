"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { createClient } from "@/lib/supabase/client"
import {
  ADMIN_ACCOUNT_MESSAGE,
  ADMIN_ACCOUNT_REASON,
  getAccountAccess,
  INACTIVE_ACCOUNT_MESSAGE,
  INACTIVE_ACCOUNT_REASON,
} from "@/lib/supabase/account-access"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const reason = searchParams.get("motivo")
    if (reason === INACTIVE_ACCOUNT_REASON) return INACTIVE_ACCOUNT_MESSAGE
    if (reason === ADMIN_ACCOUNT_REASON) return ADMIN_ACCOUNT_MESSAGE
    return null
  })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "")
    const password = String(formData.get("password") ?? "")

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setIsLoading(false)
      if (signInError.message.toLowerCase().includes("email not confirmed")) {
        setError("Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.")
      } else if (signInError.status === 429) {
        setError("Muitas tentativas. Aguarde um momento e tente novamente.")
      } else {
        setError("E-mail ou senha inválidos.")
      }
      return
    }

    const access = await getAccountAccess(supabase)
    if (access.status === "admin") {
      // Only drop the session just created here; never revoke the admin's
      // sessions elsewhere (default signOut scope is global).
      await supabase.auth.signOut({ scope: "local" })
      setIsLoading(false)
      setError(ADMIN_ACCOUNT_MESSAGE)
      return
    }
    if (access.status !== "active") {
      await supabase.auth.signOut()
      setIsLoading(false)
      setError(
        access.status === "blocked"
          ? INACTIVE_ACCOUNT_MESSAGE
          : "Não foi possível validar sua conta. Tente novamente em instantes.",
      )
      return
    }

    const next = searchParams.get("next") || "/dashboard"
    router.push(next)
    router.refresh()
  }

  return (
    <AuthShell
      title="Entrar na sua conta"
      description="Acesse o painel LAUXAI para gerenciar seu atendimento"
      footer={
        <span>
          Não tem uma conta?{" "}
          <Link href="#" className="font-medium text-primary hover:underline">
            Fale com nosso time
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="voce@suaempresa.com.br"
              required
              autoFocus
              disabled={isLoading}
              aria-invalid={error ? true : undefined}
            />
          </Field>
          <Field data-invalid={error ? true : undefined}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Link href="/esqueci-senha" className="text-xs font-medium text-primary hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
            <InputGroup>
              <InputGroupInput
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                disabled={isLoading}
                aria-invalid={error ? true : undefined}
              />
              <InputGroupAddon align="inline-end">
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </InputGroupAddon>
            </InputGroup>
            {error ? <FieldError>{error}</FieldError> : <FieldDescription>Use o e-mail e senha cadastrados pela sua empresa.</FieldDescription>}
          </Field>
          <Button type="submit" disabled={isLoading} className="mt-1">
            {isLoading ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <LogIn data-icon="inline-start" />
            )}
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
