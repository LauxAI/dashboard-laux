import { ActionForm } from "@/components/shared/action-form"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getCurrentUser } from "@/lib/data/queries"
import { deleteAccount, updateProfile } from "./actions"

export default async function ConfiguracoesPage() {
  const user = await getCurrentUser()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Preferências da sua conta na LAUXAI CORE" />

      <SectionCard title="Perfil" description="Suas informações pessoais">
        <ActionForm action={updateProfile}>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="fullName">Nome</FieldLabel>
                <Input id="fullName" name="fullName" defaultValue={user?.fullName ?? ""} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input id="email" defaultValue={user?.email ?? ""} disabled />
                <FieldDescription>O e-mail de acesso não pode ser alterado por aqui.</FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </ActionForm>
      </SectionCard>

      <SectionCard
        title="Zona de risco"
        description="Ações permanentes relacionadas à sua conta"
        className="border-destructive/30"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">Excluir conta</p>
            <p className="text-pretty text-sm text-muted-foreground">
              Essa ação é permanente e encerra o seu acesso à plataforma.
            </p>
          </div>
          <form action={deleteAccount}>
            <Button type="submit" variant="destructive">
              Excluir conta
            </Button>
          </form>
        </div>
      </SectionCard>
    </div>
  )
}
