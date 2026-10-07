"use client"

import { useState, useTransition } from "react"
import { Download, Loader2, Play, Send } from "lucide-react"
import { toast } from "sonner"
import {
  importCrmContacts,
  listOpenAIModels,
  listRemoteItems,
  runRemoteItem,
  saveOpenAIModel,
  testOpenAI,
  type RemoteItem,
} from "@/app/(dashboard)/integracoes/actions"
import { OptionSelect } from "@/components/shared/option-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {children}
    </section>
  )
}

export function OpenAIPanel({ currentModel }: { currentModel: string }) {
  const [models, setModels] = useState<string[]>(currentModel ? [currentModel] : [])
  const [model, setModel] = useState(currentModel)
  const [question, setQuestion] = useState("Diga olá e confirme que está funcionando.")
  const [answer, setAnswer] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function loadModels() {
    startTransition(async () => {
      const result = await listOpenAIModels()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setModels(result.data)
    })
  }

  function saveModel(next: string) {
    setModel(next)
    startTransition(async () => {
      const result = await saveOpenAIModel(next)
      if (!result.ok) toast.error(result.error)
      else toast.success("Modelo salvo.")
    })
  }

  function ask() {
    startTransition(async () => {
      setAnswer(null)
      const result = await testOpenAI(question)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setAnswer(result.data.text)
    })
  }

  return (
    <Section title="Modelo e teste">
      <div className="flex items-center gap-2">
        <OptionSelect
          value={model}
          onValueChange={saveModel}
          options={models.map((id) => ({ value: id, label: id }))}
          placeholder="Escolher modelo"
          ariaLabel="Modelo da OpenAI"
          className="sm:w-full"
          disabled={pending}
        />
        <Button variant="outline" size="sm" onClick={loadModels} disabled={pending}>
          Atualizar lista
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Pergunta de teste" maxLength={500} />
        <Button size="sm" onClick={ask} disabled={pending || !model}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          Testar
        </Button>
      </div>
      {answer && <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">{answer}</p>}
    </Section>
  )
}

export function RemoteRunnerPanel({ provider }: { provider: "n8n" | "make" }) {
  const noun = provider === "n8n" ? "workflows" : "cenários"
  const [items, setItems] = useState<RemoteItem[] | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function load() {
    startTransition(async () => {
      const result = await listRemoteItems(provider)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setItems(result.data)
    })
  }

  function run(id: string) {
    setRunningId(id)
    startTransition(async () => {
      const result = await runRemoteItem(provider, id)
      setRunningId(null)
      if (!result.ok) toast.error(result.error)
      else toast.success(`Execução enviada (HTTP ${result.data.status}).`)
    })
  }

  return (
    <Section title={provider === "n8n" ? "Workflows" : "Cenários"}>
      {items === null ? (
        <Button variant="outline" size="sm" onClick={load} disabled={pending} className="self-start">
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Listar {noun}
        </Button>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item encontrado nesta conta.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-foreground">{item.name}</span>
                <Badge variant="secondary" className="font-normal">
                  {item.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <Button variant="outline" size="sm" disabled={pending || !item.active} onClick={() => run(item.id)}>
                {runningId === item.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
                Executar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

export function CrmPanel({ provider }: { provider: string }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run() {
    startTransition(async () => {
      const result = await importCrmContacts(provider)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSummary(`${result.data.imported} importados, ${result.data.skipped} ignorados (já existiam) de ${result.data.total}.`)
    })
  }

  return (
    <Section title="Sincronização">
      <p className="text-sm text-muted-foreground">
        Novos leads são enviados automaticamente para este CRM. Importe também os contatos que já existem nele.
      </p>
      <Button variant="outline" size="sm" onClick={run} disabled={pending} className="self-start">
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
        Importar contatos
      </Button>
      {summary && <p className="text-sm text-foreground">{summary}</p>}
    </Section>
  )
}
