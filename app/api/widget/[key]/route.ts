import { NextResponse } from "next/server"
import { isOriginAllowed, getWidgetByKey, handleVisitorMessage } from "@/lib/integrations/widget"
import { toIntegrationError } from "@/lib/integrations/http"

export const runtime = "nodejs"
export const maxDuration = 60

type Params = { params: Promise<{ key: string }> }

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) })
}

/** Configuração pública (título, cor, boas-vindas). Não expõe nada da empresa além do necessário. */
export async function GET(request: Request, { params }: Params) {
  const origin = request.headers.get("origin")
  const { key } = await params
  const widget = await getWidgetByKey(key).catch(() => null)
  if (!widget || !widget.enabled || !isOriginAllowed(widget.allowedOrigins, origin)) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: corsHeaders(origin) })
  }
  return NextResponse.json(
    {
      title: widget.title,
      welcomeMessage: widget.welcomeMessage,
      primaryColor: widget.primaryColor,
      position: widget.position,
      collectContact: widget.collectContact,
    },
    { headers: corsHeaders(origin) },
  )
}

export async function POST(request: Request, { params }: Params) {
  const origin = request.headers.get("origin")
  const headers = corsHeaders(origin)
  const { key } = await params
  const widget = await getWidgetByKey(key).catch(() => null)
  if (!widget || !widget.enabled || !isOriginAllowed(widget.allowedOrigins, origin)) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers })
  }

  const raw = await request.text()
  if (raw.length > 8_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413, headers })
  let body: { message?: unknown; sessionId?: unknown; contact?: { name?: string; email?: string; phone?: string } }
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers })
  }
  if (typeof body.message !== "string") return NextResponse.json({ error: "bad_request" }, { status: 400, headers })
  const sessionId = typeof body.sessionId === "string" && /^[0-9a-f-]{36}$/i.test(body.sessionId) ? body.sessionId : null

  try {
    const result = await handleVisitorMessage({
      widget,
      sessionId,
      message: body.message,
      origin,
      contact: widget.collectContact ? body.contact : undefined,
    })
    return NextResponse.json(result, { headers })
  } catch (error) {
    const normalized = toIntegrationError(error)
    const status = normalized.code === "rate_limited" ? 429 : normalized.code === "bad_response" ? 400 : 503
    return NextResponse.json({ error: normalized.code, message: normalized.message }, { status, headers })
  }
}
