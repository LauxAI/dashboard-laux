"use client"

import { useMemo, useState } from "react"
import { Contact, SearchX } from "lucide-react"
import { OptionSelect } from "@/components/shared/option-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { SearchInput, Toolbar, matchesSearch } from "@/components/shared/toolbar"
import { EmptyState } from "@/components/states/empty-state"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { clientStatuses } from "@/lib/domain/catalogs"
import type { Client } from "@/lib/domain/types"
import { formatDateBRL } from "@/lib/format"

const statusOptions = Object.entries(clientStatuses).map(([value, { label }]) => ({ value, label }))

export function ClientsTable({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("todos")

  const filtered = useMemo(
    () =>
      clients.filter(
        (client) =>
          matchesSearch(query, client.name, client.email, client.phone, client.companyName) &&
          (status === "todos" || client.status === status),
      ),
    [clients, query, status],
  )

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={Contact}
        title="Nenhum cliente ainda"
        description="Leads convertidos e clientes cadastrados aparecerão aqui."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} label="Buscar clientes" placeholder="Buscar por nome, empresa ou e-mail" />
        <OptionSelect value={status} onValueChange={setStatus} options={statusOptions} allLabel="Todos os status" ariaLabel="Filtrar por status" />
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="Nenhum resultado" description="Ajuste a busca ou os filtros." />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{client.name}</span>
                      <span className="text-xs text-muted-foreground">{client.email ?? client.phone ?? "Sem contato"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.companyName ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {client.tags.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        client.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="font-normal">
                            {tag}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="client" status={client.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDateBRL(client.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
