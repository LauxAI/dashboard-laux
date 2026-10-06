import "server-only"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

export const GEMINI_MODEL_ID = "gemini-3.6-flash"

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY não está configurada.")
    this.name = "GeminiNotConfiguredError"
  }
}

/** A chave só existe no servidor (sem prefixo NEXT_PUBLIC_) e nunca é exposta. */
export function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new GeminiNotConfiguredError()
  return createGoogleGenerativeAI({ apiKey })(GEMINI_MODEL_ID)
}
