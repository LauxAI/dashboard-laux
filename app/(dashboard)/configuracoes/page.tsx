import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { getProfile } from "@/lib/data/queries"
import { deleteAccount, updateProfile } from "./actions"

const notificationPrefs = [
  { id: "leads", label: "Novos leads", description: "Receber um alerta quando um novo lead chegar.", defaultChecked: true },
  { id: "agendamentos", label: "Agendamentos", description: "Avisos de confirmação e cancelamento.", defaultChecked: true },
  { id: "automacoes", label: "Falhas em automações", description: "Ser notificado quando uma automação falhar.", defaultChecked: true },
  { id: "resumo", label: "Resumo semanal", description: "Receber um resumo por e-mail toda segunda-feira.", defaultChecked: false },
]

export default async function ConfiguracoesPage() {
  const profile = await getProfile()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Preferências da conta e da plataforma" />

      <form action={updateProfile}>
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Suas informações pessoais na LAUXAI CORE</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="nome">Nome</FieldLabel>
                  <Input id="nome" name="fullName" defaultValue={profile?.full_name ?? ""} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">E-mail</FieldLabel>
                  <Input id="email" defaultValue={profile?.email ?? ""} disabled />
                  <FieldDescription>O e-mail não pode ser alterado por aqui.</FieldDescription>
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
          <div className="flex justify-end px-6 pb-6">
            <Button type="submit">Salvar alterações</Button>
          </div>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
          <CardDescription>Escolha o que você quer ser avisado</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {notificationPrefs.map((pref, index) => (
              <div key={pref.id}>
                {index > 0 && <FieldSeparator />}
                <Field orientation="horizontal">
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor={pref.id}>{pref.label}</FieldLabel>
                    <FieldDescription>{pref.description}</FieldDescription>
                  </div>
                  <Switch id={pref.id} defaultChecked={pref.defaultChecked} />
                </Field>
              </div>
            ))}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Zona de risco</CardTitle>
          <CardDescription>Ações permanentes relacionadas à sua conta</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">Excluir conta</p>
            <p className="text-sm text-muted-foreground">
              Essa ação é permanente e removerá todos os dados da sua empresa.
            </p>
          </div>
          <form action={deleteAccount}>
            <Button type="submit" variant="destructive">
              Excluir conta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
