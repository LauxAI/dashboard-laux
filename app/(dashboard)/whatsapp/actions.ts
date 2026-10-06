"use server"

import { revalidatePath } from "next/cache"
import {
  disconnectConnectionForCompany,
  getSessionCompanyId,
  WhatsAppConnectionError,
} from "@/lib/whatsapp/connections"
import {
  completeEmbeddedSignup,
  EMBEDDED_SIGNUP_UNAVAILABLE_MESSAGE,
  EmbeddedSignupError,
  getMetaSignupClient,
} from "@/lib/whatsapp/embedded-signup"

export type WhatsAppActionResult = { error: string } | { success: true }
export type StartWhatsAppResult = { error: string } | { unavailable: true; message: string }

const SESSION_ERROR = "Sua conta não está vinculada a uma empresa ativa. Entre novamente."

/** A empresa vem sempre da sessão; nenhum argumento das actions é tratado como company_id. */
async function resolveCompanyId(): Promise<string | null> {
  try {
    return await getSessionCompanyId()
  } catch {
    return null
  }
}

function revalidateWhatsAppPages() {
  revalidatePath("/whatsapp")
  revalidatePath("/integracoes")
}

export async function startWhatsAppConnection(): Promise<StartWhatsAppResult> {
  if (!(await resolveCompanyId())) return { error: SESSION_ERROR }
  if (!getMetaSignupClient()) return { unavailable: true, message: EMBEDDED_SIGNUP_UNAVAILABLE_MESSAGE }
  return { error: "O início do Embedded Signup ainda não foi implementado." }
}

/**
 * Recebe o resultado do Embedded Signup. Só grava depois que a Meta confirma o
 * número no servidor; sem o cliente da Meta nada é salvo.
 */
export async function completeWhatsAppSignup(raw: unknown): Promise<WhatsAppActionResult> {
  const companyId = await resolveCompanyId()
  if (!companyId) return { error: SESSION_ERROR }

  try {
    await completeEmbeddedSignup(companyId, raw)
  } catch (error) {
    if (error instanceof EmbeddedSignupError) {
      switch (error.code) {
        case "meta_unavailable":
          return { error: EMBEDDED_SIGNUP_UNAVAILABLE_MESSAGE }
        case "invalid_result":
          return { error: "O resultado da autorização é inválido. Tente conectar novamente." }
        case "verification_failed":
          return { error: "Não foi possível confirmar o número com a Meta. Tente conectar novamente." }
        case "phone_number_owned_by_other_company":
          return { error: "Este número já está conectado a outra empresa." }
      }
    }
    return { error: "Não foi possível salvar a conexão. Tente novamente." }
  }

  revalidateWhatsAppPages()
  return { success: true }
}

export async function disconnectWhatsApp(connectionId: string): Promise<WhatsAppActionResult> {
  const companyId = await resolveCompanyId()
  if (!companyId) return { error: SESSION_ERROR }

  try {
    const disconnected = await disconnectConnectionForCompany(companyId, connectionId)
    if (!disconnected) return { error: "Conexão não encontrada." }
  } catch (error) {
    if (error instanceof WhatsAppConnectionError && error.code === "invalid_input") {
      return { error: "Conexão não encontrada." }
    }
    return { error: "Não foi possível desconectar o WhatsApp. Tente novamente." }
  }

  revalidateWhatsAppPages()
  return { success: true }
}
