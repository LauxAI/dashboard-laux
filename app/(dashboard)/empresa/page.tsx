import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCompany } from "@/lib/data/queries"
import { updateCompanyAddress, updateCompanyProfile } from "./actions"

export default async function EmpresaPage() {
  const company = await getCompany()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Empresa"
        description="Informações gerais sobre a sua empresa na LAUXAI"
      />

      <form action={updateCompanyProfile}>
        <Card>
          <CardHeader>
            <CardTitle>Dados da empresa</CardTitle>
            <CardDescription>Essas informações aparecem para seus clientes e para os agentes de IA.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="nome-empresa">Nome da empresa</FieldLabel>
                <Input id="nome-empresa" name="name" defaultValue={company?.name ?? ""} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="segmento">Segmento</FieldLabel>
                <Select name="segmento" defaultValue={company?.segmento ?? undefined}>
                  <SelectTrigger id="segmento" className="w-full">
                    <SelectValue placeholder="Selecione um segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="imobiliario">Imobiliário</SelectItem>
                      <SelectItem value="juridico">Jurídico</SelectItem>
                      <SelectItem value="saude">Saúde</SelectItem>
                      <SelectItem value="consultoria">Consultoria</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="site">Site</FieldLabel>
                <Input id="site" name="site" defaultValue={company?.site ?? ""} placeholder="www.suaempresa.com.br" />
              </Field>
              <Field>
                <FieldLabel htmlFor="documento">CNPJ</FieldLabel>
                <Input id="documento" name="cnpj" defaultValue={company?.cnpj ?? ""} placeholder="00.000.000/0000-00" />
                <FieldDescription>Usado para emissão de notas fiscais e faturamento.</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Salvar alterações</Button>
          </CardFooter>
        </Card>
      </form>

      <form action={updateCompanyAddress}>
        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
            <CardDescription>Usado em contratos e documentos fiscais.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="endereco">Endereço</FieldLabel>
                  <Input id="endereco" name="endereco" defaultValue={company?.endereco ?? ""} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cidade">Cidade</FieldLabel>
                  <Input id="cidade" name="cidade" defaultValue={company?.cidade ?? ""} />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Salvar alterações</Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
