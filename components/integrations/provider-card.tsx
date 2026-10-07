"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plug, PlugZap, RefreshCw, Unplug } from "lucide-react"
import { toast } from "sonner"
import { connectIntegration, disconnectIntegration, testIntegration } from "@/app/(dashboard)/integracoes/actions"
import { OptionSelect } from "@/components/shared/option-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { IntegrationView, ProviderDefinition } from "@/lib/integrations/registry"
import { CrmPanel, OpenAIPanel, RemoteRunnerPanel } from "./provider-panels"

function formatDate(value: string | null): string {
  if (!value) return "nunca"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function ConnectForm({ definition, onDone }: { definition: ProviderDefinition; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await connectIntegration(definition.id, values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`${definition.name} conectado.`)
      setValues({})
      onDone()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
        {definition.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {definition.fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`${definition.id}-${field.key}`}>{field.label}</Label>
            {field.type === "select" ? (
              <OptionSelect
                value={values[field.key] ?? ""}
                onValueChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
                options={field.options ?? []}
                ariaLabel={field.label}
                className="sm:w-full"
              />
            ) : (
              <Input
                id={`${definition.id}-${field.key}`}
                type={field.type === "password" ? "password" : field.type === "url" ? "url" : "text"}
                autoComplete="off"
                spellCheck={false}
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                required={field.required}
              />
            )}
            {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
          </div>
        ))}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PlugZap aria-hidden="true" />}
          {pending ? "Validando credenciais..." : "Conectar e validar"}
        </Button>
      </form>
    </div>
  )
}

function ManagePanel({ definition, view, onDone }: { definition: ProviderDefinition; view: IntegrationView; onDone: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) toast.error(result.error ?? "Não foi possível concluir a ação.")
      else {
        toast.success(success)
        after?.()
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Conta</dt>
          <dd className="font-medium text-foreground">{view.accountLabel ?? "Conectada"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Credencial</dt>
          <dd className="font-mono text-foreground">{view.secretHint ?? "••••"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Último teste</dt>
          <dd className="text-foreground">{formatDate(view.lastTestedAt)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusBadge kind="integration" status={view.status} />
          </dd>
        </div>
      </dl>
      {view.status === "erro" && view.lastErrorMessage && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {view.lastErrorMessage}
        </p>
      )}

      {definition.id === "openai" && <OpenAIPanel currentModel={view.config.model ?? ""} />}
      {(definition.id === "n8n" || definition.id === "make") && <RemoteRunnerPanel provider={definition.id} />}
      {definition.category === "crm" && <CrmPanel provider={definition.id} />}

      <p className="text-xs text-muted-foreground">{definition.testHint}</p>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => testIntegration(definition.id), "Conexão validada.")}>
          <RefreshCw aria-hidden="true" />
          Testar conexão
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => disconnectIntegration(definition.id), `${definition.name} desconectado.`, onDone)}
        >
          <Unplug aria-hidden="true" />
          Desconectar
        </Button>
      </div>
    </div>
  )
}

export function ProviderCard({ definition, view }: { definition: ProviderDefinition; view: IntegrationView | null }) {
  const [open, setOpen] = useState(false)
  const connected = view !== null && view.status !== "desconectado"
  const status = view?.status ?? "desconectado"

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="flex flex-col gap-1">
          <CardTitle className="text-base">{definition.name}</CardTitle>
          <CardDescription className="text-pretty">{definition.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          {connected && view?.accountLabel && <p className="truncate text-sm text-muted-foreground">{view.accountLabel}</p>}
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2">
          <StatusBadge kind="integration" status={status} />
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plug aria-hidden="true" />
            {connected ? "Gerenciar" : "Conectar"}
          </Button>
        </CardFooter>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{definition.name}</DialogTitle>
            <DialogDescription>{connected ? "Gerencie a conexão e teste o funcionamento." : "Informe as credenciais para conectar."}</DialogDescription>
          </DialogHeader>
          {connected && view ? (
            <ManagePanel definition={definition} view={view} onDone={() => setOpen(false)} />
          ) : (
            <ConnectForm definition={definition} onDone={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
