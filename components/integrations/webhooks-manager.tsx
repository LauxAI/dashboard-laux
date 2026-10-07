"use client"

import { useState, useTransition } from "react"
import { Copy, Loader2, Plus, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  createWebhookEndpoint,
  generateInboundUrl,
  removeWebhookEndpoint,
  testWebhookEndpoint,
  toggleInboundUrl,
  toggleWebhookEndpoint,
} from "@/app/(dashboard)/integracoes/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { InboundView } from "@/lib/integrations/inbound"
import type { WebhookDeliveryView, WebhookEndpointView } from "@/lib/integrations/webhooks"

type EventOption = { value: string; label: string }

type Props = {
  baseUrl: string
  endpoints: WebhookEndpointView[]
  deliveries: WebhookDeliveryView[]
  inbound: InboundView
  eventOptions: EventOption[]
  encryptionReady: boolean
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" })

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Copiado.")
  } catch {
    toast.error("Não foi possível copiar.")
  }
}

export function WebhooksManager({ baseUrl, endpoints, deliveries, inbound, eventOptions, encryptionReady }: Props) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [events, setEvents] = useState<string[]>(["lead.created"])
  const [secret, setSecret] = useState<string | null>(null)
  const [inboundUrl, setInboundUrl] = useState<string | null>(null)

  function toggleEvent(value: string) {
    setEvents((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))
  }

  function create() {
    startTransition(async () => {
      const result = await createWebhookEndpoint({ name, url, events })
      if (!result.ok) return void toast.error(result.error)
      setSecret(result.data.signingSecret)
      setName("")
      setUrl("")
      toast.success("Endpoint criado.")
    })
  }

  function test(id: string) {
    startTransition(async () => {
      const result = await testWebhookEndpoint(id)
      if (!result.ok) return void toast.error(result.error)
      if (result.data.ok) toast.success(`Entregue (HTTP ${result.data.httpStatus}).`)
      else toast.error(result.data.error ?? "Falha na entrega.")
    })
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) toast.error(result.error ?? "Não foi possível concluir.")
      else toast.success(success)
    })
  }

  function generate() {
    startTransition(async () => {
      const result = await generateInboundUrl()
      if (!result.ok) return void toast.error(result.error)
      setInboundUrl(`${baseUrl}/api/webhooks/inbound/${result.data.token}`)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {!encryptionReady && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          A chave de criptografia das integrações ainda não foi configurada no servidor. Defina INTEGRATIONS_ENCRYPTION_KEY para criar endpoints.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enviar eventos para outro sistema</CardTitle>
          <CardDescription>
            Cada envio é um POST JSON assinado. Verifique o cabeçalho X-Lauxai-Signature (HMAC-SHA256 de &quot;timestamp.corpo&quot;) com o segredo do endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {secret && (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-secondary p-3">
              <p className="text-sm font-medium text-foreground">Segredo de assinatura (mostrado só agora)</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-xs">{secret}</code>
                <Button type="button" variant="outline" size="sm" onClick={() => copy(secret)}>
                  <Copy aria-hidden="true" />
                  Copiar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSecret(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wh-name">Nome</Label>
              <Input id="wh-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Meu CRM" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wh-url">URL de destino (https)</Label>
              <Input id="wh-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://exemplo.com/webhooks/lauxai" inputMode="url" />
            </div>
          </div>
          <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Eventos</legend>
            {eventOptions
              .filter((option) => option.value !== "webhook.test")
              .map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" checked={events.includes(option.value)} onChange={() => toggleEvent(option.value)} />
                  {option.label}
                </label>
              ))}
          </fieldset>
          <div>
            <Button type="button" onClick={create} disabled={pending || !encryptionReady || !name.trim() || !url.trim() || events.length === 0}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
              Criar endpoint
            </Button>
          </div>

          {endpoints.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {endpoints.map((endpoint) => (
                <li key={endpoint.id} className="flex flex-col gap-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium text-foreground">{endpoint.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{endpoint.url}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={endpoint.active ? "secondary" : "outline"}>{endpoint.active ? "Ativo" : "Desativado"}</Badge>
                      <Switch
                        checked={endpoint.active}
                        aria-label={`Ativar ${endpoint.name}`}
                        disabled={pending}
                        onCheckedChange={(checked) => run(() => toggleWebhookEndpoint(endpoint.id, checked), checked ? "Endpoint ativado." : "Endpoint desativado.")}
                      />
                      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => test(endpoint.id)}>
                        <Send aria-hidden="true" />
                        Testar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remover ${endpoint.name}`}
                        disabled={pending}
                        onClick={() => run(() => removeWebhookEndpoint(endpoint.id), "Endpoint removido.")}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Eventos: {endpoint.events.join(", ")} · Segredo {endpoint.secretHint ?? "—"}
                    {endpoint.disabledReason ? ` · ${endpoint.disabledReason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receber leads de outros sistemas</CardTitle>
          <CardDescription>
            Envie um POST JSON para a URL abaixo, por exemplo: {`{ "id": "abc", "event": "lead.create", "contact": { "name": "Ana", "phone": "5511999990000" } }`}. O mesmo id é processado uma só vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {inboundUrl && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-secondary p-3">
              <code className="min-w-0 flex-1 break-all text-xs">{inboundUrl}</code>
              <Button type="button" variant="outline" size="sm" onClick={() => copy(inboundUrl)}>
                <Copy aria-hidden="true" />
                Copiar
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={generate} disabled={pending || !encryptionReady}>
              {inbound ? "Gerar nova URL (invalida a anterior)" : "Gerar URL"}
            </Button>
            {inbound && (
              <>
                <span className="text-sm text-muted-foreground">Token atual {inbound.tokenHint}</span>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={inbound.enabled}
                    disabled={pending}
                    onCheckedChange={(checked) => run(() => toggleInboundUrl(checked), checked ? "URL ativada." : "URL desativada.")}
                  />
                  Ativa
                </label>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas entregas</CardTitle>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma entrega ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {deliveries.map((delivery) => (
                <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-foreground">{delivery.eventType}</span>
                  <span className="text-xs text-muted-foreground">
                    {delivery.status === "success" ? "Entregue" : delivery.status === "failed" ? "Falhou" : "Pendente"}
                    {delivery.httpStatus ? ` · HTTP ${delivery.httpStatus}` : ""}
                    {delivery.errorMessage ? ` · ${delivery.errorMessage}` : ""} · {dateFormat.format(new Date(delivery.createdAt))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
