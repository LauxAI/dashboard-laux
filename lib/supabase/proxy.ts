import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import {
  ADMIN_ACCOUNT_MESSAGE,
  ADMIN_ACCOUNT_REASON,
  getAccountAccess,
  INACTIVE_ACCOUNT_MESSAGE,
  INACTIVE_ACCOUNT_REASON,
} from "./account-access"

function redirectTo(request: NextRequest, pathname: string, search: Record<string, string> = {}) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""
  for (const [key, value] of Object.entries(search)) url.searchParams.set(key, value)
  return NextResponse.redirect(url)
}

const PUBLIC_PATHS = [
  "/login",
  "/esqueci-senha",
  "/redefinir-senha",
  "/sessao-expirada",
  "/erro-autenticacao",
  "/conta-suspensa",
  "/conta-pendente",
  "/auth/callback",
]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Do not run code between createServerClient and supabase.auth.getUser().
  // A simple mistake could make it very hard to debug issues with users
  // being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  // The OAuth/recovery callback must exchange its code before any check.
  if (user && !pathname.startsWith("/auth/callback")) {
    const access = await getAccountAccess(supabase)
    const isApi = pathname.startsWith("/api/")

    if (access.status === "blocked") {
      // Authenticated in Supabase Auth, but without an active client account
      // (deleted, suspended, expired, cancelled): end the session server-side.
      await supabase.auth.signOut()
      const response = isApi
        ? NextResponse.json({ error: INACTIVE_ACCOUNT_MESSAGE }, { status: 403 })
        : pathname === "/login"
          ? NextResponse.next({ request })
          : redirectTo(request, "/login", { motivo: INACTIVE_ACCOUNT_REASON })
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
      return response
    }

    if (access.status === "admin" && !isPublicPath) {
      // Admins authenticate in the separate admin dashboard: keep them out of
      // the client dashboard without revoking their session.
      return isApi
        ? NextResponse.json({ error: ADMIN_ACCOUNT_MESSAGE }, { status: 403 })
        : redirectTo(request, "/login", { motivo: ADMIN_ACCOUNT_REASON })
    }

    if (access.status === "error" && !isPublicPath) {
      return isApi
        ? NextResponse.json({ error: "Não foi possível validar sua conta." }, { status: 503 })
        : redirectTo(request, "/erro-autenticacao")
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}
