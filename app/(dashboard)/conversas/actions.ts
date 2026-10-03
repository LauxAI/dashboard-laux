"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function sendMessage(conversationId: string, content: string) {
  const trimmed = content.trim()
  if (!trimmed) return { error: "Mensagem vazia" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (!membership) return { error: "Empresa não encontrada" }

  const { error: insertError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    company_id: membership.company_id,
    sender: "equipe",
    content: trimmed,
  })
  if (insertError) return { error: "Não foi possível enviar a mensagem" }

  await supabase
    .from("conversations")
    .update({ last_message: trimmed, updated_at: new Date().toISOString() })
    .eq("id", conversationId)

  revalidatePath("/conversas")
  return { error: null }
}
