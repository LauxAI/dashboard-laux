import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { DemoBanner } from "@/components/shared/demo-banner"
import { PageHeader } from "@/components/shared/page-header"
import { demoContacts } from "@/lib/demo-data"
import { PlusIcon, SearchIcon } from "lucide-react"

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export default function ClientesPage() {
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

      <DemoBanner />

      <InputGroup className="sm:max-w-sm">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Buscar por nome, empresa ou e-mail" />
      </InputGroup>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contato</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Último contato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demoContacts.map((contact) => (
              <TableRow key={contact.id} className="cursor-pointer">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{initials(contact.nome)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{contact.nome}</span>
                      <span className="text-xs text-muted-foreground">{contact.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{contact.empresa}</TableCell>
                <TableCell className="text-muted-foreground">{contact.whatsapp}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{contact.origem}</TableCell>
                <TableCell className="text-muted-foreground">{contact.ultimoContato}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
