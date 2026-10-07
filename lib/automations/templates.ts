import type { AutomationCategory, AutomationStep } from "./types"

export type AutomationTemplate = {
  id: string
  name: string
  description: string
  category: AutomationCategory
  triggerType: string
  steps: AutomationStep[]
}

const sendMessage = (message: string): AutomationStep => ({
  type: "action",
  kind: "whatsapp.send_message",
  params: { message },
})

const notifyTeam = (title: string, message = ""): AutomationStep => ({
  type: "action",
  kind: "team.notify",
  params: { title, message },
})

export const templates: AutomationTemplate[] = [
  {
    id: "boas-vindas-whatsapp",
    name: "Boas-vindas a novo contato",
    description: "Envia uma mensagem de boas-vindas na primeira conversa de cada contato.",
    category: "atendimento",
    triggerType: "whatsapp.new_contact",
    steps: [sendMessage("Olá {{nome}}! Obrigado por entrar em contato. Já vamos te atender.")],
  },
  {
    id: "agente-novo-contato",
    name: "Agente responde e equipe é avisada",
    description: "O agente de IA responde o novo contato e a equipe recebe uma notificação.",
    category: "atendimento",
    triggerType: "whatsapp.new_contact",
    steps: [
      { type: "action", kind: "whatsapp.run_agent", params: {} },
      notifyTeam("Novo contato no WhatsApp", "Um novo contato iniciou uma conversa."),
    ],
  },
  {
    id: "transferir-atendente",
    name: "Transferir para atendente por palavra-chave",
    description: "Quando o contato pede um atendente, a conversa é transferida e a equipe é avisada.",
    category: "atendimento",
    triggerType: "whatsapp.message_received",
    steps: [
      { type: "condition", field: "message_text", operator: "contains", value: "atendente" },
      { type: "action", kind: "whatsapp.handoff", params: {} },
      sendMessage("Certo, {{nome}}! Vou chamar um atendente para falar com você."),
      notifyTeam("Cliente pediu atendimento humano", "Uma conversa foi transferida para atendimento humano."),
    ],
  },
  {
    id: "contato-vira-lead",
    name: "Novo contato vira lead",
    description: "Cria um lead no funil para cada novo contato do WhatsApp e avisa a equipe.",
    category: "vendas",
    triggerType: "whatsapp.new_contact",
    steps: [
      { type: "action", kind: "lead.create", params: { source: "WhatsApp" } },
      notifyTeam("Novo lead do WhatsApp", "Um lead foi criado a partir de uma nova conversa."),
    ],
  },
  {
    id: "interesse-preco",
    name: "Interesse em preço qualifica o lead",
    description: "Se o contato pergunta sobre preço, cria o lead como qualificado e responde.",
    category: "vendas",
    triggerType: "whatsapp.message_received",
    steps: [
      { type: "condition", field: "message_text", operator: "contains", value: "preço" },
      { type: "action", kind: "lead.create", params: { source: "WhatsApp" } },
      { type: "action", kind: "lead.update_status", params: { status: "qualificado" } },
      sendMessage("Olá {{nome}}! Já vou te passar as informações de valores."),
    ],
  },
  {
    id: "followup-lead",
    name: "Follow-up de lead após 1 dia",
    description: "Um dia depois de criar o lead, envia uma mensagem de acompanhamento.",
    category: "vendas",
    triggerType: "lead.created",
    steps: [
      { type: "delay", minutes: 60 * 24 },
      sendMessage("Olá {{nome}}! Passando para saber se posso ajudar com alguma dúvida."),
    ],
  },
  {
    id: "confirmacao-agendamento",
    name: "Confirmação de agendamento",
    description: "Avisa o cliente assim que um agendamento é criado.",
    category: "agendamento",
    triggerType: "appointment.created",
    steps: [sendMessage("Olá {{nome}}! Seu agendamento foi registrado. Até lá!")],
  },
  {
    id: "lembrete-agendamento",
    name: "Lembrete de agendamento",
    description: "Lembra o cliente antes do horário marcado.",
    category: "agendamento",
    triggerType: "appointment.reminder_due",
    steps: [sendMessage("Olá {{nome}}! Lembrando do seu agendamento. Responda se precisar remarcar.")],
  },
  {
    id: "aviso-cancelamento",
    name: "Aviso de cancelamento",
    description: "Informa o cliente e a equipe quando um agendamento é cancelado.",
    category: "agendamento",
    triggerType: "appointment.cancelled",
    steps: [
      sendMessage("Olá {{nome}}! Seu agendamento foi cancelado. Se quiser remarcar, é só responder."),
      notifyTeam("Agendamento cancelado", "Um agendamento foi cancelado."),
    ],
  },
  {
    id: "boas-vindas-cliente",
    name: "Boas-vindas a novo cliente",
    description: "Dá boas-vindas quando um cliente é cadastrado.",
    category: "relacionamento",
    triggerType: "client.created",
    steps: [sendMessage("Olá {{nome}}! Seja bem-vindo(a). Conte com a gente.")],
  },
  {
    id: "pedido-cancelamento",
    name: "Aviso de pedido de cancelamento",
    description: "Se o contato menciona cancelamento, a equipe é avisada na hora.",
    category: "relacionamento",
    triggerType: "whatsapp.message_received",
    steps: [
      { type: "condition", field: "message_text", operator: "contains", value: "cancelar" },
      notifyTeam("Cliente mencionou cancelamento", "Uma mensagem recebida cita cancelamento."),
    ],
  },
]

export function getTemplate(id: string): AutomationTemplate | undefined {
  return templates.find((template) => template.id === id)
}
