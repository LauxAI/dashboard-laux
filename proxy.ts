import { updateSession } from "@/lib/supabase/proxy"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

// /api/webhooks/* recebe chamadas de serviços externos (ex.: Meta) sem sessão de
// usuário; cada webhook se autentica sozinho (assinatura/verify token).
// /api/widget/* é consumido pelo site do cliente (visitantes anônimos); a rota
// valida chave pública, widget ativo e origem permitida.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks/|api/widget/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
