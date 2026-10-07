import type { AIAgentConfig, SchedulingAgentConfig } from "@/lib/domain/types"

/** Especialistas ativos e válidos que o Atendimento pode usar na conversa. */
export type SpecialistContext = {
  scheduling?: SchedulingAgentConfig
  sales?: AIAgentConfig
  support?: AIAgentConfig
}

const block = (title: string, body: string | undefined | false) => (body ? `### ${title}\n${body}` : "")
const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n")

function schedulingSection(config: SchedulingAgentConfig): string {
  const { behavior } = config
  const abilities = [
    behavior.offerAvailableSlots && "consultar horários disponíveis (ferramenta consultar_horarios)",
    behavior.allowBooking && "criar agendamentos (ferramenta criar_agendamento)",
    behavior.allowLookup && "consultar os agendamentos do próprio cliente (ferramenta consultar_meus_agendamentos)",
    behavior.allowConfirmation && "confirmar agendamentos (ferramenta confirmar_agendamento)",
    behavior.allowCancellation && "cancelar agendamentos (ferramenta cancelar_agendamento)",
    behavior.allowRescheduling && "remarcar agendamentos (ferramenta remarcar_agendamento)",
  ].filter(Boolean) as string[]
  if (abilities.length === 0) return ""

  const required = [
    behavior.askName && "nome do cliente",
    behavior.askPhone && "telefone do cliente",
    behavior.askEmail && "e-mail do cliente",
    behavior.askService && "serviço desejado (use listar_servicos para mostrar as opções)",
  ].filter(Boolean) as string[]

  return [
    "### Agendamento",
    config.description && `Papel: ${config.description}`,
    `Você pode: ${abilities.join("; ")}.`,
    required.length ? `Antes de agendar, colete: ${required.join(", ")}.` : "",
    "Use sempre as ferramentas para consultar horários e para agendar. Nunca invente horários nem afirme que algo foi agendado, confirmado, cancelado ou remarcado sem que a ferramenta tenha retornado sucesso.",
    "Ofereça apenas horários devolvidos pela ferramenta e confirme com o cliente a data e o horário antes de agendar.",
    "Ações que não estão na lista acima não estão disponíveis: informe que não é possível por aqui.",
  ]
    .filter(Boolean)
    .join("\n")
}

function salesSection(config: AIAgentConfig): string {
  return [
    "### Vendas",
    "Quando o cliente demonstrar interesse em comprar, conhecer produtos, preços ou planos, atue como especialista de vendas usando apenas as informações abaixo.",
    config.objective && `Objetivo: ${config.objective}`,
    config.instructions,
    config.rules.length ? `Regras:\n${bullets(config.rules)}` : "",
    config.offerings.length
      ? `Produtos e serviços:\n${config.offerings
          .map((o) => `- ${o.name}${o.price ? ` (${o.price})` : ""}${o.description ? `: ${o.description}` : ""}`)
          .join("\n")}`
      : "",
    block("Abordagem de vendas", config.salesApproach),
    block("Tratamento de objeções", config.objectionHandling),
    block("Conhecimento de vendas", config.knowledge),
  ]
    .filter(Boolean)
    .join("\n")
}

function supportSection(config: AIAgentConfig): string {
  return [
    "### Suporte",
    "Quando o cliente relatar um problema ou pedir ajuda com algo que já usa, atue como especialista de suporte usando apenas as informações abaixo.",
    config.objective && `Objetivo: ${config.objective}`,
    config.instructions,
    config.rules.length ? `Regras:\n${bullets(config.rules)}` : "",
    config.procedures.length
      ? `Procedimentos:\n${config.procedures
          .map((p) => `#### ${p.title}\n${p.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`)
          .join("\n\n")}`
      : "",
    block("Conhecimento de suporte", config.knowledge),
    block("Quando não for possível resolver", config.unresolvedBehavior),
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Seção do prompt do Atendimento com os especialistas habilitados. O Atendimento
 * é o único que fala com o cliente: mantém sempre a própria voz, saudação e tom;
 * os especialistas só contribuem com conhecimento e capacidades.
 */
export function buildSpecialistsSection(specialists: SpecialistContext | undefined): string {
  if (!specialists) return ""
  const parts = [
    specialists.scheduling && schedulingSection(specialists.scheduling),
    specialists.sales && salesSection(specialists.sales),
    specialists.support && supportSection(specialists.support),
  ].filter(Boolean) as string[]
  if (parts.length === 0) return ""

  return [
    "## Especialistas",
    "Você tem especialistas internos de apoio. Eles nunca falam com o cliente: você continua sendo a única voz, mantendo seu nome, tom e personalidade, e usa o conhecimento deles quando o assunto pedir.",
    ...parts,
  ].join("\n\n")
}
