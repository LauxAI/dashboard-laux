import { NextResponse } from "next/server"
import { GEMINI_MODEL, GeminiError, generateGeminiReply } from "@/lib/ai/gemini"
import { createClient } from "@/lib/supabase/server"

const MAX_MESSAGE_LENGTH = 4000

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { message?: unknown } | null
  const message = typeof body?.message === "string" ? body.message.trim() : ""

  if (!message) {
    return NextResponse.json({ error: "Envie uma mensagem para a IA." }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `A mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.` },
      { status: 400 },
    )
  }

  try {
    const reply = await generateGeminiReply(message)
    return NextResponse.json({ reply, model: GEMINI_MODEL })
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[api/ai/chat] Unexpected error", error)
    return NextResponse.json({ error: "Erro inesperado ao consultar a IA." }, { status: 500 })
  }
}
