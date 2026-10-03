import { PageHeader } from "@/components/shared/page-header"
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
import { getTeamMembers } from "@/lib/data/queries"
import { UserPlusIcon } from "lucide-react"

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
}

export default async function EquipePage() {
  const members = await getTeamMembers()

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

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membro</TableHead>
              <TableHead>Função</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.user_id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback>{initials(member.full_name ?? member.email ?? "?")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-foreground">{member.full_name ?? "Sem nome"}</div>
                      <div className="text-sm text-muted-foreground">{member.email ?? "—"}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{roleLabels[member.role] ?? member.role}</Badge>
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
