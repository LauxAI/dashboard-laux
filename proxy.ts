import { updateSession } from "@/lib/supabase/proxy"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

// /api/webhooks/* recebe chamadas de serviços externos (ex.: Meta) sem sessão de
// usuário; cada webhook se autentica sozinho (assinatura/verify token).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
