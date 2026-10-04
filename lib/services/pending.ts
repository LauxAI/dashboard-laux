"use client"

import { toast } from "sonner"

/**
 * Ponto único para ações cuja UI está pronta mas o backend ainda não.
 * O DEV substitui cada chamada pela mutation real (server action/API) — basta
 * buscar por `notifyPendingBackend` no projeto.
 */
export function notifyPendingBackend(action: string) {
  toast.info(action, {
    description: "Interface pronta. Esta ação será ativada quando o backend for conectado.",
  })
}
