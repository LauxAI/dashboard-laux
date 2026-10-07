import type { AIAgentConfig } from "@/lib/domain/types"

/**
 * Consultas determinísticas dos especialistas de Vendas e Suporte. Leem a
 * configuração persistida da empresa e devolvem um resultado estruturado ao
 * Atendimento; nunca geram texto para o cliente nem inventam dados.
 */

export type SalesIntent = "produto_preco" | "objecao" | "abordagem" | "geral"

export const salesIntents: SalesIntent[] = ["produto_preco", "objecao", "abordagem", "geral"]

const STOPWORDS = new Set([
  "para", "com", "uma", "uns", "umas", "que", "como", "qual", "quais", "quanto", "custa", "pelo", "pela", "dos", "das",
  "nao", "meu", "minha", "esse", "essa", "este", "esta", "isso", "mais", "muito", "tem", "ter", "por", "sobre", "quero",
])

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

function tokens(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
}

function score(haystack: string, query: string[]): number {
  const text = normalize(haystack)
  return query.reduce((total, token) => (text.includes(token) ? total + 1 : total), 0)
}

const MAX_OFFERINGS = 20
const MAX_PROCEDURES = 3

export function lookupSales(config: AIAgentConfig, input: { tipo?: string; consulta?: string }) {
  const intent: SalesIntent = salesIntents.includes(input.tipo as SalesIntent) ? (input.tipo as SalesIntent) : "geral"
  const query = tokens(input.consulta ?? "")

  const scored = config.offerings.map((offering) => ({
    offering,
    points: score(`${offering.name} ${offering.description}`, query),
  }))
  const matched = scored.filter((item) => item.points > 0).sort((a, b) => b.points - a.points)
  const exactMatch = query.length === 0 || matched.length > 0
  const chosen = (matched.length > 0 ? matched : scored).slice(0, MAX_OFFERINGS).map((item) => item.offering)

  const wantsOfferings = intent !== "abordagem"
  const wantsObjections = intent === "objecao" || intent === "geral"
  const wantsApproach = intent === "objecao" || intent === "abordagem" || intent === "geral"

  const guidance: string[] = []
  if (wantsOfferings && query.length > 0 && !exactMatch) {
    guidance.push("Nenhum item do catálogo corresponde exatamente à consulta; liste apenas o que existe e não invente produto nem preço.")
  }
  if (wantsOfferings && config.offerings.some((o) => !o.price)) {
    guidance.push("Itens sem preço informado: diga que o valor não está disponível; nunca estime.")
  }
  if (intent === "objecao" && !config.objectionHandling) {
    guidance.push("Não há orientação de objeções configurada: reconheça a preocupação e use apenas dados reais do catálogo; não invente descontos nem condições.")
  }

  return {
    type: "sales_info" as const,
    success: true as const,
    specialist: "vendas" as const,
    intent,
    exactMatch,
    ...(wantsOfferings
      ? { offerings: chosen.map((o) => ({ name: o.name, price: o.price || null, description: o.description || null })) }
      : {}),
    ...(wantsApproach && config.salesApproach ? { salesApproach: config.salesApproach } : {}),
    ...(wantsObjections && config.objectionHandling ? { objectionHandling: config.objectionHandling } : {}),
    rules: config.rules,
    ...(config.instructions ? { instructions: config.instructions } : {}),
    ...(config.knowledge ? { knowledge: config.knowledge } : {}),
    guidance,
  }
}

export function lookupSupport(config: AIAgentConfig, input: { problema?: string }) {
  const query = tokens(input.problema ?? "")

  const scored = config.procedures.map((procedure) => ({
    procedure,
    points: score(`${procedure.title} ${procedure.steps.join(" ")}`, query),
  }))
  const matched = scored
    .filter((item) => item.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, MAX_PROCEDURES)
    .map((item) => item.procedure)

  const guidance: string[] = []
  if (matched.length === 0) {
    guidance.push(
      config.knowledge
        ? "Nenhum procedimento corresponde ao problema; responda somente com o conhecimento fornecido, se ele cobrir o caso."
        : "Nenhum procedimento corresponde ao problema e não há conhecimento adicional: não invente passos.",
    )
    if (config.unresolvedBehavior) guidance.push(`Quando não for possível resolver: ${config.unresolvedBehavior}`)
  }
  if (config.handoff.enabled) {
    guidance.push(
      "A transferência para humano é apenas uma orientação: nenhuma ferramenta a executa, então não diga que o cliente já foi transferido.",
    )
  }

  return {
    type: "support_info" as const,
    success: true as const,
    specialist: "suporte" as const,
    procedureMatched: matched.length > 0,
    procedures: matched.map((p) => ({ title: p.title, steps: p.steps })),
    availableProcedures: config.procedures.map((p) => p.title),
    ...(config.knowledge ? { knowledge: config.knowledge } : {}),
    rules: config.rules,
    ...(config.instructions ? { instructions: config.instructions } : {}),
    ...(config.unresolvedBehavior ? { unresolvedBehavior: config.unresolvedBehavior } : {}),
    handoff: config.handoff.enabled
      ? { enabled: true, criteria: config.handoff.criteria, suggested: matched.length === 0 }
      : { enabled: false },
    guidance,
  }
}
