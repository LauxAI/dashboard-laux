import "server-only"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

/**
 * Modelos em ordem de preferência. O primeiro é o mais estável e rápido com esta
 * chave; os seguintes só entram quando o anterior falha sem entregar resposta
 * (alta demanda, timeout, modelo indisponível). `GEMINI_MODEL` pode antecipar
 * outro modelo para o início da fila.
 */
export const GEMINI_MODEL_CHAIN = ["gemini-3-flash-preview", "gemini-3.6-flash", "gemini-3.1-flash-lite-preview"] as const

/**
 * Raciocínio reduzido: as respostas de atendimento são curtas e, com o raciocínio
 * padrão dos modelos Gemini 3, a latência passava de 30s e estourava o timeout.
 */
export const GEMINI_PROVIDER_OPTIONS = { google: { thinkingConfig: { thinkingLevel: "low" as const } } }

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY não está configurada.")
    this.name = "GeminiNotConfiguredError"
  }
}

function getProvider() {
  // A chave só existe no servidor (sem prefixo NEXT_PUBLIC_) e nunca é exposta.
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new GeminiNotConfiguredError()
  return createGoogleGenerativeAI({ apiKey })
}

/** Falha cedo (antes de qualquer tentativa) quando a chave não está configurada. */
export function assertGeminiConfigured() {
  getProvider()
}

export function getGeminiModelChain(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim()
  return preferred ? [preferred, ...GEMINI_MODEL_CHAIN.filter((id) => id !== preferred)] : [...GEMINI_MODEL_CHAIN]
}

export function getGeminiModel(modelId: string) {
  return getProvider()(modelId)
}
