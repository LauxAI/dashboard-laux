"use client"

import { useMemo, useState } from "react"
import { SearchX, UsersIcon } from "lucide-react"
import { OptionSelect } from "@/components/shared/option-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { SearchInput, Toolbar, matchesSearch } from "@/components/shared/toolbar"
import { EmptyState } from "@/components/states/empty-state"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { leadSources, leadStatuses, labelFrom } from "@/lib/domain/catalogs"
import type { Lead } from "@/lib/domain/types"
import { formatCurrencyBRL, formatRelativeTime } from "@/lib/format"

const statusOptions = Object.entries(leadStatuses).map(([value, { label }]) => ({ value, label }))

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("todos")
  const [source, setSource] = useState("todos")

  const filtered = useMemo(
    () =>
      leads.filter(
        (lead) =>
          matchesSearch(query, lead.name, lead.email, lead.phone) &&
          (status === "todos" || lead.status === status) &&
          (source === "todos" || lead.source === source),
      ),
    [leads, query, status, source],
  )

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Nenhum lead ainda"
        description="Os leads recebidos pelos seus canais aparecerão aqui."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} label="Buscar leads" placeholder="Buscar por nome, e-mail ou telefone" />
        <OptionSelect value={status} onValueChange={setStatus} options={statusOptions} allLabel="Todos os status" ariaLabel="Filtrar por status" />
        <OptionSelect value={source} onValueChange={setSource} options={leadSources} allLabel="Todas as origens" ariaLabel="Filtrar por origem" />
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="Nenhum resultado" description="Ajuste a busca ou os filtros." />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Criado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{lead.name}</span>
                      <span className="text-xs text-muted-foreground">{lead.email ?? lead.phone ?? "Sem contato"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{labelFrom(leadSources, lead.source)}</TableCell>
                  <TableCell>
                    <StatusBadge kind="lead" status={lead.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrencyBRL(lead.value)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatRelativeTime(lead.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
