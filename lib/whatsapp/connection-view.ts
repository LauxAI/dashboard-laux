import type { WhatsAppConnection, WhatsAppConnectionStatus } from "./connections"

/**
 * Visão da conexão que pode chegar ao navegador. É montada por lista branca de
 * campos: mesmo que a origem traga access_token ou company_id, eles não passam.
 */
export type SafeWhatsAppConnection = {
  id: string
  phone_number_id: string
  waba_id: string | null
  display_phone_number: string | null
  business_name: string | null
  status: WhatsAppConnectionStatus
  connected_at: string
  updated_at: string
}

export function toSafeConnection(connection: WhatsAppConnection): SafeWhatsAppConnection {
  return {
    id: connection.id,
    phone_number_id: connection.phone_number_id,
    waba_id: connection.waba_id,
    display_phone_number: connection.display_phone_number,
    business_name: connection.business_name,
    status: connection.status,
    connected_at: connection.connected_at,
    updated_at: connection.updated_at,
  }
}

const STATUS_PRIORITY: Record<WhatsAppConnectionStatus, number> = {
  active: 0,
  inactive: 1,
  disconnected: 2,
}

/**
 * Escolhe a conexão exibida: ativa primeiro, depois inativa, depois a desconectada
 * mais recente. Retorna null quando a empresa nunca conectou um número.
 */
export function pickCurrentConnection(connections: WhatsAppConnection[]): SafeWhatsAppConnection | null {
  if (connections.length === 0) return null
  const [best] = [...connections].sort((a, b) => {
    const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
    if (byStatus !== 0) return byStatus
    return Date.parse(b.updated_at) - Date.parse(a.updated_at)
  })
  return toSafeConnection(best)
}
