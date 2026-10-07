import "server-only"
import { IntegrationError, requestJson } from "../http"

const BASE = "https://api.openai.com/v1"
const PREFERRED_MODELS = ["gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini", "gpt-5", "gpt-4.1", "gpt-4o"]
const EXCLUDED = /(embedding|audio|tts|whisper|transcribe|image|dall-e|realtime|moderation|search|computer|codex|instruct|davinci|babbage|sora|omni-moderation)/i
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,80}$/

type ModelsResponse = { data?: { id?: unknown }[] }

export function isValidModelId(value: string): boolean {
  return MODEL_PATTERN.test(value)
}

/** Modelos de texto utilizáveis pelos agentes (filtra embeddings, áudio, imagem etc.). */
export function filterChatModels(ids: string[]): string[] {
  return ids.filter((id) => /^(gpt-|o\d|chatgpt-)/i.test(id) && !EXCLUDED.test(id)).sort()
}

export function pickDefaultModel(models: string[]): string | null {
  for (const preferred of PREFERRED_MODELS) if (models.includes(preferred)) return preferred
  return models[0] ?? null
}

export async function listModels(apiKey: string): Promise<string[]> {
  const { data } = await requestJson<ModelsResponse>(`${BASE}/models`, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!data || !Array.isArray(data.data)) throw new IntegrationError("bad_response")
  return filterChatModels(data.data.map((item) => item.id).filter((id): id is string => typeof id === "string"))
}

export async function verify(apiKey: string): Promise<{ accountLabel: string; config: Record<string, string> }> {
  const models = await listModels(apiKey)
  const model = pickDefaultModel(models)
  return { accountLabel: "Conta OpenAI", config: model ? { model } : {} }
}

type ResponsesOutput = {
  output_text?: unknown
  output?: { type?: string; content?: { type?: string; text?: unknown }[] }[]
  usage?: { input_tokens?: number; output_tokens?: number }
}

export type OpenAIReply = { text: string; inputTokens?: number; outputTokens?: number }

/** Resposta de texto via Responses API. Lança IntegrationError em falha. */
export async function generateText(input: {
  apiKey: string
  model: string
  instructions: string
  messages: { role: "user" | "assistant"; content: string }[]
  maxOutputTokens?: number
  timeoutMs?: number
}): Promise<OpenAIReply> {
  if (!isValidModelId(input.model)) throw new IntegrationError("not_configured", "Escolha um modelo válido da OpenAI.")
  const { data } = await requestJson<ResponsesOutput>(`${BASE}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      instructions: input.instructions,
      input: input.messages.map((message) => ({ role: message.role, content: message.content })),
      max_output_tokens: input.maxOutputTokens ?? 1024,
      store: false,
    }),
    timeoutMs: input.timeoutMs ?? 40_000,
  })
  if (!data) throw new IntegrationError("bad_response")

  let text = typeof data.output_text === "string" ? data.output_text : ""
  if (!text) {
    for (const item of data.output ?? []) {
      if (item.type !== "message") continue
      for (const part of item.content ?? []) if (part.type === "output_text" && typeof part.text === "string") text += part.text
    }
  }
  if (!text.trim()) throw new IntegrationError("bad_response", "O modelo não devolveu texto.")
  return { text: text.trim(), inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens }
}
