import { after, NextResponse, type NextRequest } from "next/server"
import { resolveWhatsAppCompany } from "@/lib/whatsapp/company"
import { getWhatsAppConfig } from "@/lib/whatsapp/config"
import { insertWebhookEvents } from "@/lib/whatsapp/event-store"
import { logWebhook } from "@/lib/whatsapp/log"
import { parseWhatsAppPayload } from "@/lib/whatsapp/payload"
import { processWhatsAppEvents } from "@/lib/whatsapp/processor"
import { readLimitedBody } from "@/lib/whatsapp/request-body"
import { verifySignature, verifySubscription } from "@/lib/whatsapp/security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

/** Handshake de verificação do webhook (hub.mode, hub.verify_token, hub.challenge). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const challenge = verifySubscription(
    {
      mode: params.get("hub.mode"),
      token: params.get("hub.verify_token"),
      challenge: params.get("hub.challenge"),
    },
    getWhatsAppConfig().verifyToken,
  )

  if (challenge === null) {
    logWebhook("warn", "verification_rejected")
    return new Response("Forbidden", { status: 403, headers: NO_STORE })
  }

  logWebhook("info", "verification_succeeded")
  return new Response(challenge, {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  })
}

/** Recebe eventos de mensagens e status. Responde 200 sem aguardar o processamento. */
export async function POST(request: NextRequest) {
  const { appSecret } = getWhatsAppConfig()
  if (!appSecret) {
    // Falha fechada: sem o App Secret não há como provar que o evento veio da Meta.
    logWebhook("error", "app_secret_not_configured")
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503, headers: NO_STORE })
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type deve ser application/json." }, { status: 415, headers: NO_STORE })
  }

  const rawBody = await readLimitedBody(request)
  if (!rawBody.ok) {
    logWebhook("warn", "body_rejected", { reason: rawBody.reason })
    return NextResponse.json(
      { error: rawBody.reason === "too_large" ? "Payload muito grande." : "Corpo ilegível." },
      { status: rawBody.reason === "too_large" ? 413 : 400, headers: NO_STORE },
    )
  }

  if (!verifySignature(rawBody.body, request.headers.get("x-hub-signature-256"), appSecret)) {
    logWebhook("warn", "signature_rejected")
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401, headers: NO_STORE })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody.body)
  } catch {
    logWebhook("warn", "invalid_json")
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers: NO_STORE })
  }

  const parsed = parseWhatsAppPayload(payload)
  if (!parsed.ok) {
    logWebhook("warn", "payload_rejected", { reason: parsed.reason })
    return NextResponse.json({ error: "Payload inválido." }, { status: 400, headers: NO_STORE })
  }

  after(() =>
    processWhatsAppEvents(parsed.events, {
      resolveCompany: async (phoneNumberId) => (await resolveWhatsAppCompany(phoneNumberId))?.company_id ?? null,
      insertEvents: insertWebhookEvents,
    }).catch((error) => {
      logWebhook("error", "processing_failed", { error: error instanceof Error ? error.name : "unknown" })
    }),
  )

  return NextResponse.json({ status: "received" }, { status: 200, headers: NO_STORE })
}
