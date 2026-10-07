import { NextResponse } from "next/server"
import { INBOUND_MAX_BYTES, processInboundEvent, resolveInboundCompany } from "@/lib/integrations/inbound"
import { toIntegrationError } from "@/lib/integrations/http"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const companyId = await resolveInboundCompany(token).catch(() => null)
  if (!companyId) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > INBOUND_MAX_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 })
  const raw = await request.text()
  if (raw.length > INBOUND_MAX_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 })

  try {
    const result = await processInboundEvent(companyId, raw)
    return NextResponse.json({ status: result.status, message: result.message })
  } catch (error) {
    const normalized = toIntegrationError(error)
    const status = normalized.code === "bad_response" ? 400 : 500
    return NextResponse.json({ error: normalized.code, message: normalized.message }, { status })
  }
}
