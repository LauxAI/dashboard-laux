"use client"

import { useState, useTransition } from "react"
import { Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { saveWidgetSettings } from "@/app/(dashboard)/integracoes/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  baseUrl: string
  publicKey: string
  initial: {
    enabled: boolean
    title: string
    welcomeMessage: string
    primaryColor: string
    position: "left" | "right"
    collectContact: boolean
    allowedOrigins: string[]
  }
}

export function WidgetForm({ baseUrl, publicKey, initial }: Props) {
  const [pending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [title, setTitle] = useState(initial.title)
  const [welcomeMessage, setWelcomeMessage] = useState(initial.welcomeMessage)
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor)
  const [position, setPosition] = useState(initial.position)
  const [origins, setOrigins] = useState(initial.allowedOrigins.join("\n"))

  const snippet = `<script src="${baseUrl}/api/widget/embed" data-key="${publicKey}" async></script>`

  function save() {
    startTransition(async () => {
      const result = await saveWidgetSettings({
        enabled,
        title,
        welcomeMessage,
        primaryColor,
        position,
        collectContact: false,
        allowedOrigins: origins,
      })
      if (result.ok) toast.success("Widget salvo.")
      else toast.error(result.error)
    })
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet)
      toast.success("Código copiado.")
    } catch {
      toast.error("Não foi possível copiar.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aparência e comportamento</CardTitle>
          <CardDescription>O widget responde com o agente de IA ativo da empresa.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            Widget ativo
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-title">Título</Label>
              <Input id="w-title" value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-color">Cor (#RRGGBB)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Escolher cor"
                  className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1"
                  value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#0f766e"}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                />
                <Input id="w-color" value={primaryColor} maxLength={7} onChange={(event) => setPrimaryColor(event.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="w-welcome">Mensagem de boas-vindas</Label>
            <Textarea id="w-welcome" value={welcomeMessage} maxLength={300} rows={3} onChange={(event) => setWelcomeMessage(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="w-position">Posição</Label>
            <select
              id="w-position"
              className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
              value={position}
              onChange={(event) => setPosition(event.target.value === "left" ? "left" : "right")}
            >
              <option value="right">Canto direito</option>
              <option value="left">Canto esquerdo</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="w-origins">Sites permitidos (um por linha)</Label>
            <Textarea id="w-origins" value={origins} rows={3} placeholder="https://www.seusite.com.br" onChange={(event) => setOrigins(event.target.value)} />
            <p className="text-xs text-muted-foreground">Deixe vazio para permitir qualquer site. Recomendado: liste apenas o seu domínio.</p>
          </div>
          <div>
            <Button type="button" onClick={save} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Código de instalação</CardTitle>
          <CardDescription>Cole antes de fechar a tag &lt;/body&gt; do seu site.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-secondary p-3 text-xs">{snippet}</code>
          <Button type="button" variant="outline" size="sm" onClick={copySnippet}>
            <Copy aria-hidden="true" />
            Copiar
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
