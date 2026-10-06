import "server-only"

/**
 * Configuração da WhatsApp Cloud API. Todas as variáveis são exclusivas do servidor
 * (nunca NEXT_PUBLIC_*) e os valores nunca são registrados em log.
 */
export function getWhatsAppConfig() {
  return {
    /** Token do handshake GET. Defina o mesmo valor no painel da Meta. */
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || undefined,
    /** App Secret do app Meta, usado para validar a assinatura X-Hub-Signature-256 do POST. */
    appSecret: process.env.WHATSAPP_APP_SECRET || undefined,
    // Reservadas para a etapa de envio de mensagens; ainda não são usadas.
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || undefined,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || undefined,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || undefined,
  }
}
