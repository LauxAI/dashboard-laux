"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      router.push("/dashboard")
    }, 900)
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
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" type="email" placeholder="voce@suaempresa.com.br" required autoFocus />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Link href="/esqueci-senha" className="text-xs font-medium text-primary hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
            <InputGroup>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
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
            <FieldDescription>Use o e-mail e senha cadastrados pela sua empresa.</FieldDescription>
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
