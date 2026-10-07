import type { SchedulingAgentConfig } from "@/lib/domain/types"
import type { SpecialistContext } from "./specialist-status"

export type { SpecialistContext } from "./specialist-status"

/** Nomes das ferramentas de consulta de cada especialista. Fonte única para prompt, ferramentas e testes. */
export const SPECIALIST_TOOL_NAMES = {
  sales: "consultar_vendas",
  support: "consultar_suporte",
} as const

function schedulingLine(config: SchedulingAgentConfig): string {
  const { behavior } = config
  const abilities = [
    behavior.offerAvailableSlots && "consultar_horarios",
    behavior.allowBooking && "criar_agendamento",
    behavior.allowLookup && "consultar_meus_agendamentos",
    behavior.allowConfirmation && "confirmar_agendamento",
    behavior.allowCancellation && "cancelar_agendamento",
    behavior.allowRescheduling && "remarcar_agendamento",
  ].filter(Boolean) as string[]
  if (abilities.length === 0) return ""

  const required = [
    behavior.askName && "nome",
    behavior.askPhone && "telefone",
    behavior.askEmail && "e-mail",
    behavior.askService && "serviço (use listar_servicos)",
  ].filter(Boolean) as string[]

  return [
    `- Agendamento: horários e compromissos. Ferramentas: listar_servicos, ${abilities.join(", ")}.`,
    required.length ? `  Antes de agendar, colete: ${required.join(", ")}.` : "",
    "  Ofereça somente horários devolvidos por consultar_horarios e confirme data e hora com o cliente antes de agendar.",
    "  Ações fora da lista de ferramentas não estão disponíveis: diga que não é possível por aqui.",
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Seção curta do prompt do Atendimento. Apenas apresenta os especialistas
 * disponíveis e como acioná-los: catálogo, procedimentos e regras ficam na
 * configuração de cada especialista e só chegam ao modelo pelo resultado da
 * ferramenta, quando o assunto pede.
 */
export function buildSpecialistsSection(specialists: SpecialistContext | undefined): string {
  if (!specialists) return ""
  const lines = [
    specialists.scheduling && schedulingLine(specialists.scheduling),
    specialists.sales &&
      `- Vendas: preços, produtos, planos, orçamento, interesse em comprar e objeções ("está caro"). Ferramenta: ${SPECIALIST_TOOL_NAMES.sales}.`,
    specialists.support &&
      `- Suporte: problemas, erros, dúvidas de uso e dificuldade de acesso. Ferramenta: ${SPECIALIST_TOOL_NAMES.support}.`,
  ].filter(Boolean) as string[]
  if (lines.length === 0) return ""

  return [
    "## Especialistas",
    "Você tem especialistas internos que consultam a configuração real da empresa. Eles nunca falam com o cliente: você é a única voz, mantém seu nome, tom e personalidade, e escreve a resposta final com o resultado que eles devolvem.",
    ...lines,
    [
      "Como usar:",
      "- Acione o especialista somente quando o assunto pedir; em conversa comum, responda sozinho.",
      "- Para preços, produtos, procedimentos e horários, chame a ferramenta antes de responder. Nunca responda esses assuntos de memória.",
      "- Não escreva texto ao cliente antes de chamar a ferramenta; responda depois de receber o resultado.",
      "- Use apenas o que o resultado trouxe. Se vier vazio, incompleto ou com success=false, diga que não tem a informação ou que não conseguiu; não invente.",
      "- Siga o campo guidance do resultado, quando houver.",
      "- Só diga que algo foi agendado, confirmado, cancelado ou remarcado se o resultado trouxe success=true para essa ação. Se simulated=true, é um teste: nada foi gravado, e você deve avisar isso em uma frase curta.",
      "- Nunca mostre JSON, nomes de ferramentas nem diga que consultou um especialista.",
      "- Assuntos sem especialista na lista acima: responda apenas com a sua própria configuração; se não houver a informação, diga que não a tem.",
    ].join("\n"),
  ].join("\n\n")
}
