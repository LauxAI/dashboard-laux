import { UserPlusIcon, UsersIcon } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PendingActionButton } from "@/components/shared/pending-action-button"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState, ErrorState } from "@/components/states/states"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getTeamMembers } from "@/lib/data/queries"
import { teamRoles } from "@/lib/domain/catalogs"
import { formatRelativeTime, getInitials } from "@/lib/format"

export default async function EquipePage() {
  const { data: members, error } = await getTeamMembers()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipe"
        description="Gerencie quem tem acesso à operação da sua empresa"
        actions={
          <PendingActionButton action="Convidar membro">
            <UserPlusIcon data-icon="inline-start" />
            Convidar membro
          </PendingActionButton>
        }
      />

      {error ? (
        <ErrorState description={error} />
      ) : members.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum membro" description="Convide pessoas para operar com você." />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Último acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback>{getInitials(member.fullName ?? member.email)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{member.fullName ?? "Sem nome"}</span>
                        <span className="text-xs text-muted-foreground">{member.email ?? "—"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {teamRoles[member.role].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="team" status={member.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {member.lastSeenAt ? formatRelativeTime(member.lastSeenAt) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
