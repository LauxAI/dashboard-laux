import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/shared/page-header"
import { LeadStatusBadge } from "@/components/shared/status-badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getLeads } from "@/lib/data/queries"
import { formatRelativeTime } from "@/lib/format"
import { PlusIcon, SearchIcon, UsersIcon } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export default async function LeadsPage() {
  const leads = await getLeads()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leads"
        description="Acompanhe e gerencie os leads recebidos pelos seus canais"
        actions={
          <Button>
            <PlusIcon data-icon="inline-start" />
            Novo lead
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="sm:max-w-sm">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Buscar por nome, empresa ou e-mail" />
        </InputGroup>

        <div className="flex items-center gap-2">
          <Select defaultValue="todos">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="contatado">Contatado</SelectItem>
                <SelectItem value="qualificado">Qualificado</SelectItem>
                <SelectItem value="demonstracao">Demonstração</SelectItem>
                <SelectItem value="negociacao">Em negociação</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select defaultValue="todas">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="todas">Todas as origens</SelectItem>
                <SelectItem value="landing">Landing Page</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="indicacao">Indicação</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {leads.length === 0 ? (
        <Card>
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum lead ainda</EmptyTitle>
              <EmptyDescription>
                Os leads recebidos pelos seus canais aparecerão aqui. Cadastre o primeiro para começar.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Última atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>{initials(lead.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{lead.name}</span>
                        <span className="text-xs text-muted-foreground">{lead.phone ?? lead.email ?? ""}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.source ?? "—"}</TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.value ? `R$ ${Number(lead.value).toLocaleString("pt-BR")}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatRelativeTime(lead.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
