import { PageHeader } from "@/components/shared/page-header"
import { DemoBanner } from "@/components/shared/demo-banner"
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

export default function EmpresaPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Empresa"
        description="Informações gerais sobre a sua empresa na LAUXAI"
      />
      <DemoBanner />

      <Card>
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
          <CardDescription>Essas informações aparecem para seus clientes e para os agentes de IA.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome-empresa">Nome da empresa</FieldLabel>
              <Input id="nome-empresa" defaultValue="Castro Imóveis" />
            </Field>
            <Field>
              <FieldLabel htmlFor="segmento">Segmento</FieldLabel>
              <Select defaultValue="imobiliario">
                <SelectTrigger id="segmento" className="w-full">
                  <SelectValue />
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
              <Input id="site" defaultValue="www.castroimoveis.com.br" />
            </Field>
            <Field>
              <FieldLabel htmlFor="documento">CNPJ</FieldLabel>
              <Input id="documento" defaultValue="12.345.678/0001-90" />
              <FieldDescription>Usado para emissão de notas fiscais e faturamento.</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button>Salvar alterações</Button>
        </CardFooter>
      </Card>

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
                <Input id="endereco" defaultValue="Av. Paulista, 1500 — Sala 302" />
              </Field>
              <Field>
                <FieldLabel htmlFor="cidade">Cidade</FieldLabel>
                <Input id="cidade" defaultValue="São Paulo, SP" />
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button>Salvar alterações</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
