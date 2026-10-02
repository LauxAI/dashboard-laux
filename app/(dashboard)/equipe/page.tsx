import { PageHeader } from "@/components/shared/page-header"
import { DemoBanner } from "@/components/shared/demo-banner"
import { TeamStatusBadge } from "@/components/shared/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { demoTeam } from "@/lib/demo-data"
import { UserPlusIcon } from "lucide-react"

const cargoLabels: Record<string, string> = {
  administrador: "Administrador",
  gestor: "Gestor",
  atendente: "Atendente",
}

function initials(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
}

export default function EquipePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipe"
        description="Gerencie quem tem acesso à operação da sua empresa"
        actions={
          <Button>
            <UserPlusIcon data-icon="inline-start" />
            Convidar membro
          </Button>
        }
      />

      <DemoBanner />

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membro</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demoTeam.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback>{initials(member.nome)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-foreground">{member.nome}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{cargoLabels[member.cargo]}</Badge>
                </TableCell>
                <TableCell>
                  <TeamStatusBadge status={member.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    Gerenciar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
