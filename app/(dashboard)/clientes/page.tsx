import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PageHeader } from "@/components/shared/page-header"
import { getClients } from "@/lib/data/queries"
import { formatDateTimeBRL } from "@/lib/format"
import { PlusIcon, SearchIcon, UsersIcon } from "lucide-react"

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export default async function ClientesPage() {
  const clients = await getClients()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description="Base de contatos e clientes atendidos pela sua operação"
        actions={
          <Button>
            <PlusIcon data-icon="inline-start" />
            Novo contato
          </Button>
        }
      />

      <InputGroup className="sm:max-w-sm">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Buscar por nome, empresa ou e-mail" />
      </InputGroup>

      {clients.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum cliente ainda</EmptyTitle>
            <EmptyDescription>Os contatos e clientes atendidos pela sua operação aparecem aqui.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cliente desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>{initials(client.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{client.name}</span>
                        <span className="text-xs text-muted-foreground">{client.email ?? "—"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.company_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{client.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{client.status}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTimeBRL(client.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
