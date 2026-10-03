"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateProfile(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim()
  if (!fullName) return { error: "Informe seu nome." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado." }

  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id)
  if (error) return { error: "Não foi possível salvar as alterações." }

  revalidatePath("/configuracoes")
  return { success: true }
}

export async function deleteAccount() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL

  if (serviceRoleKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js")
    const admin = createAdminClient(supabaseUrl, serviceRoleKey)
    await admin.auth.admin.deleteUser(user!.id)
  }

  await supabase.auth.signOut()
  redirect("/login")
}
