import "server-only"

export const GEMINI_MODEL = "gemini-3.5-flash-lite"

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const REQUEST_TIMEOUT_MS = 30_000

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "GeminiError"
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string }
}

export type GeminiRole = "user" | "model"

export interface GeminiChatMessage {
  role: GeminiRole
  text: string
}

export interface GeminiChatOptions {
  messages: GeminiChatMessage[]
  systemInstruction?: string
  temperature?: number
  /** Quando informado, o Gemini responde apenas JSON que segue este schema (formato OpenAPI do Gemini). */
  responseSchema?: Record<string, unknown>
}

export async function generateGeminiReply(message: string): Promise<string> {
  return generateGeminiChat({ messages: [{ role: "user", text: message }] })
}

export async function generateGeminiChat({
  messages,
  systemInstruction,
  temperature,
  responseSchema,
}: GeminiChatOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new GeminiError("A variável de ambiente GEMINI_API_KEY não está configurada no servidor.", 500)
  }

  const generationConfig = {
    ...(temperature !== undefined ? { temperature } : {}),
    ...(responseSchema ? { responseMimeType: "application/json", responseSchema } : {}),
  }

  const payload = {
    contents: messages.map((message) => ({ role: message.role, parts: [{ text: message.text }] })),
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
  }

  let response: Response
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError"
    throw new GeminiError(
      timedOut ? "O Gemini demorou demais para responder. Tente novamente." : "Não foi possível conectar ao Gemini.",
      502,
    )
  }

  const data = (await response.json().catch(() => ({}))) as GeminiResponse

  if (!response.ok) {
    console.error("[ai/gemini] Gemini API error", response.status, data.error?.message)
    const message =
      response.status === 400 || response.status === 403
        ? "O Gemini recusou a requisição. Verifique se a GEMINI_API_KEY é válida."
        : response.status === 429
          ? "Limite de uso do Gemini atingido. Aguarde um momento e tente novamente."
          : "O Gemini retornou um erro inesperado."
    throw new GeminiError(message, 502)
  }

  if (data.promptFeedback?.blockReason) {
    throw new GeminiError("A mensagem foi bloqueada pelos filtros de segurança do Gemini.", 422)
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim()

  if (!text) {
    throw new GeminiError("O Gemini não retornou nenhum texto.", 502)
  }

  return text
}
