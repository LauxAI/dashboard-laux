import { ActionForm } from "@/components/shared/action-form"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { EmptyState } from "@/components/states/empty-state"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getCompany } from "@/lib/data/queries"
import { Building2 } from "lucide-react"
import { updateCompanyAddress, updateCompanyProfile } from "./actions"

export default async function EmpresaPage() {
  const company = await getCompany()

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Empresa" description="Dados cadastrais da sua empresa" />
        <EmptyState
          icon={Building2}
          title="Empresa não encontrada"
          description="Sua conta ainda não está vinculada a uma empresa."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Empresa" description="Dados cadastrais da sua empresa" />

      <SectionCard title="Perfil da empresa" description="Informações exibidas para sua equipe">
        <ActionForm action={updateCompanyProfile}>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="name">Nome da empresa</FieldLabel>
                <Input id="name" name="name" defaultValue={company.name} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="segmento">Segmento</FieldLabel>
                <Input id="segmento" name="segmento" defaultValue={company.segment ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="site">Site</FieldLabel>
                <Input id="site" name="site" type="url" placeholder="https://" defaultValue={company.website ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cnpj">CNPJ</FieldLabel>
                <Input id="cnpj" name="cnpj" inputMode="numeric" defaultValue={company.taxId ?? ""} />
              </Field>
            </div>
          </FieldGroup>
        </ActionForm>
      </SectionCard>

      <SectionCard title="Endereço" description="Localização principal da operação">
        <ActionForm action={updateCompanyAddress}>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="endereco">Endereço</FieldLabel>
                <Input id="endereco" name="endereco" defaultValue={company.address ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cidade">Cidade</FieldLabel>
                <Input id="cidade" name="cidade" defaultValue={company.city ?? ""} />
              </Field>
            </div>
          </FieldGroup>
        </ActionForm>
      </SectionCard>
    </div>
  )
}
