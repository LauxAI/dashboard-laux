"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateCompanyProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: company } = await supabase.from("companies").select("id").maybeSingle()
  if (!company) return { error: "Empresa não encontrada." }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Informe o nome da empresa." }

  const { error } = await supabase
    .from("companies")
    .update({
      name,
      segmento: String(formData.get("segmento") ?? "") || null,
      site: String(formData.get("site") ?? "") || null,
      cnpj: String(formData.get("cnpj") ?? "") || null,
    })
    .eq("id", company.id)

  if (error) return { error: "Não foi possível salvar as alterações." }

  revalidatePath("/empresa")
  return { success: true }
}

export async function updateCompanyAddress(formData: FormData) {
  const supabase = await createClient()
  const { data: company } = await supabase.from("companies").select("id").maybeSingle()
  if (!company) return { error: "Empresa não encontrada." }

  const { error } = await supabase
    .from("companies")
    .update({
      endereco: String(formData.get("endereco") ?? "") || null,
      cidade: String(formData.get("cidade") ?? "") || null,
    })
    .eq("id", company.id)

  if (error) return { error: "Não foi possível salvar as alterações." }

  revalidatePath("/empresa")
  return { success: true }
}
