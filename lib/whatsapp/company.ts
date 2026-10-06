import "server-only"

/**
 * Resolve phone_number_id -> company_id, sempre no servidor e somente a partir de
 * configuração própria. O company_id nunca vem do payload nem do frontend.
 *
 * Ainda não existe tabela de números conectados (isso virá com o cadastro/Embedded
 * Signup), então nenhuma empresa é resolvida e retorna null. Quando existir, esta é
 * a única função a alterar: consultar a tabela com o cliente de serviço pelo
 * phone_number_id e retornar o company_id correspondente.
 */
export async function resolveWhatsAppCompany(phoneNumberId: string): Promise<string | null> {
  void phoneNumberId
  return null
}
