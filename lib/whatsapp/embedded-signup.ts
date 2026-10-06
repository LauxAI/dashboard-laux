import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertConnectionForCompany, WhatsAppConnectionError, type WhatsAppConnection } from "./connections"

/**
 * Camada de abstração do Meta Embedded Signup.
 *
 *   iniciar conexão → Embedded Signup → resultado da Meta → validar → salvar
 *
 * Nada aqui assume uma resposta da Meta: o resultado bruto vindo do navegador só
 * é tratado como uma alegação. A conexão só é salva como "active" depois que o
 * MetaSignupClient (servidor) troca o code por token e a Graph API confirma que o
 * phone_number_id pertence ao WABA informado. Enquanto não existir um
 * MetaSignupClient real, getMetaSignupClient() retorna null e nada é gravado.
 */

export type EmbeddedSignupResult = {
  /** Código de autorização devolvido pelo Embedded Signup. */
  code: string
  phoneNumberId: string
  wabaId: string
}

export type MetaPhoneNumberDetails = {
  phoneNumberId: string
  wabaId: string
  displayPhoneNumber: string | null
  verifiedName: string | null
}

export interface MetaSignupClient {
  /** Troca o code por access_token no servidor. */
  exchangeCode(code: string): Promise<{ accessToken: string; expiresAt: Date | null }>
  /** Consulta na Graph API, com o token recém-emitido, os dados do número. */
  getPhoneNumber(accessToken: string, phoneNumberId: string): Promise<MetaPhoneNumberDetails | null>
}

export class EmbeddedSignupError extends Error {
  constructor(
    readonly code:
      | "meta_unavailable"
      | "invalid_result"
      | "verification_failed"
      | "phone_number_owned_by_other_company"
      | "database_error",
  ) {
    super(code)
    this.name = "EmbeddedSignupError"
  }
}

export const EMBEDDED_SIGNUP_UNAVAILABLE_MESSAGE = "A conexão com a Meta será iniciada aqui."

/**
 * Cliente real da Meta. Fica null até a autorização do Business Manager estar
 * disponível; é o único ponto a implementar quando a Meta liberar.
 */
export function getMetaSignupClient(): MetaSignupClient | null {
  return null
}

const NUMERIC_ID = /^\d{1,64}$/

export function parseEmbeddedSignupResult(raw: unknown): EmbeddedSignupResult {
  if (typeof raw !== "object" || raw === null) throw new EmbeddedSignupError("invalid_result")
  const { code, phoneNumberId, wabaId } = raw as Record<string, unknown>
  if (typeof code !== "string" || code.length === 0 || code.length > 2048) {
    throw new EmbeddedSignupError("invalid_result")
  }
  if (typeof phoneNumberId !== "string" || !NUMERIC_ID.test(phoneNumberId)) {
    throw new EmbeddedSignupError("invalid_result")
  }
  if (typeof wabaId !== "string" || !NUMERIC_ID.test(wabaId)) {
    throw new EmbeddedSignupError("invalid_result")
  }
  return { code, phoneNumberId, wabaId }
}

/**
 * Valida o resultado do Embedded Signup contra a Meta e salva a conexão da empresa.
 * O companyId deve vir da sessão no servidor. Nenhuma mensagem de erro carrega o
 * token ou o corpo da resposta da Meta.
 */
export async function completeEmbeddedSignup(
  companyId: string,
  raw: unknown,
  client: MetaSignupClient | null = getMetaSignupClient(),
  db?: SupabaseClient,
): Promise<WhatsAppConnection> {
  if (!client) throw new EmbeddedSignupError("meta_unavailable")
  const result = parseEmbeddedSignupResult(raw)

  let token: { accessToken: string; expiresAt: Date | null }
  let details: MetaPhoneNumberDetails | null
  try {
    token = await client.exchangeCode(result.code)
    details = await client.getPhoneNumber(token.accessToken, result.phoneNumberId)
  } catch {
    throw new EmbeddedSignupError("verification_failed")
  }

  if (!details || details.phoneNumberId !== result.phoneNumberId || details.wabaId !== result.wabaId) {
    throw new EmbeddedSignupError("verification_failed")
  }
  if (!token.accessToken) throw new EmbeddedSignupError("verification_failed")

  try {
    return await upsertConnectionForCompany(
      companyId,
      {
        phoneNumberId: details.phoneNumberId,
        wabaId: details.wabaId,
        displayPhoneNumber: details.displayPhoneNumber,
        businessName: details.verifiedName,
        status: "active",
        accessToken: token.accessToken,
        tokenExpiresAt: token.expiresAt,
      },
      db,
    )
  } catch (error) {
    if (error instanceof WhatsAppConnectionError && error.code === "phone_number_owned_by_other_company") {
      throw new EmbeddedSignupError("phone_number_owned_by_other_company")
    }
    throw new EmbeddedSignupError("database_error")
  }
}
