import type { ActionKind, AutomationCategory, ConditionField, ConditionOperator } from "./types"

/** Capacidades que um gatilho entrega ao fluxo e que as etapas podem exigir. */
export type Capability = "recipient" | "conversation" | "message" | "lead" | "appointment" | "client"

export type TriggerDefinition = {
  key: string
  label: string
  description: string
  group: "WhatsApp" | "Leads" | "Agenda" | "Clientes"
  provides: Capability[]
  /** true quando já existe uma origem real emitindo este evento no sistema. */
  wired: boolean
}

export const triggers: TriggerDefinition[] = [
  {
    key: "whatsapp.message_received",
    label: "Mensagem recebida no WhatsApp",
    description: "Dispara a cada mensagem de texto recebida de um contato.",
    group: "WhatsApp",
    provides: ["recipient", "conversation", "message"],
    wired: true,
  },
  {
    key: "whatsapp.new_contact",
    label: "Novo contato no WhatsApp",
    description: "Dispara na primeira mensagem de um número que nunca falou com a empresa.",
    group: "WhatsApp",
    provides: ["recipient", "conversation", "message"],
    wired: true,
  },
  {
    key: "whatsapp.conversation_started",
    label: "Conversa iniciada",
    description: "Dispara quando uma nova conversa é aberta pelo contato.",
    group: "WhatsApp",
    provides: ["recipient", "conversation", "message"],
    wired: true,
  },
  {
    key: "lead.created",
    label: "Novo lead criado",
    description: "Dispara quando um lead é cadastrado.",
    group: "Leads",
    provides: ["recipient", "lead"],
    wired: false,
  },
  {
    key: "lead.status_changed",
    label: "Lead mudou de etapa",
    description: "Dispara quando o status de um lead é alterado.",
    group: "Leads",
    provides: ["recipient", "lead"],
    wired: false,
  },
  {
    key: "appointment.created",
    label: "Agendamento criado",
    description: "Dispara quando um agendamento é marcado.",
    group: "Agenda",
    provides: ["recipient", "appointment"],
    wired: false,
  },
  {
    key: "appointment.reminder_due",
    label: "Lembrete de agendamento",
    description: "Dispara antes do horário de um agendamento.",
    group: "Agenda",
    provides: ["recipient", "appointment"],
    wired: false,
  },
  {
    key: "appointment.cancelled",
    label: "Agendamento cancelado",
    description: "Dispara quando um agendamento é cancelado.",
    group: "Agenda",
    provides: ["recipient", "appointment"],
    wired: false,
  },
  {
    key: "client.created",
    label: "Cliente criado",
    description: "Dispara quando um cliente é cadastrado.",
    group: "Clientes",
    provides: ["recipient", "client"],
    wired: false,
  },
]

export function getTrigger(key: string | null | undefined): TriggerDefinition | undefined {
  return triggers.find((trigger) => trigger.key === key)
}

export type ConditionFieldDefinition = {
  key: ConditionField
  label: string
  needs: Capability
  operators: ConditionOperator[]
  /** Quando definido, o valor é escolhido de uma lista fixa. */
  options?: { value: string; label: string }[]
}

export const operatorLabels: Record<ConditionOperator, string> = {
  contains: "contém",
  not_contains: "não contém",
  equals: "é igual a",
  not_equals: "é diferente de",
  starts_with: "começa com",
  is_empty: "está vazio",
  is_not_empty: "não está vazio",
  is_true: "é verdadeiro",
  is_false: "é falso",
}

export const operatorsWithoutValue: ConditionOperator[] = ["is_empty", "is_not_empty", "is_true", "is_false"]

export const conditionFields: ConditionFieldDefinition[] = [
  {
    key: "message_text",
    label: "Texto da mensagem",
    needs: "message",
    operators: ["contains", "not_contains", "equals", "starts_with", "is_empty", "is_not_empty"],
  },
  {
    key: "message_type",
    label: "Tipo da mensagem",
    needs: "message",
    operators: ["equals", "not_equals"],
    options: [
      { value: "text", label: "Texto" },
      { value: "image", label: "Imagem" },
      { value: "audio", label: "Áudio" },
      { value: "document", label: "Documento" },
    ],
  },
  { key: "contact_name", label: "Nome do contato", needs: "recipient", operators: ["contains", "equals", "is_empty", "is_not_empty"] },
  { key: "contact_phone", label: "Telefone do contato", needs: "recipient", operators: ["contains", "equals", "starts_with"] },
  { key: "is_new_contact", label: "É um contato novo", needs: "conversation", operators: ["is_true", "is_false"] },
  {
    key: "lead_status",
    label: "Status do lead",
    needs: "lead",
    operators: ["equals", "not_equals"],
    options: [
      { value: "novo", label: "Novo" },
      { value: "contatado", label: "Contatado" },
      { value: "qualificado", label: "Qualificado" },
      { value: "demonstracao", label: "Demonstração" },
      { value: "negociacao", label: "Em negociação" },
      { value: "cliente", label: "Cliente" },
      { value: "perdido", label: "Perdido" },
    ],
  },
  { key: "lead_source", label: "Origem do lead", needs: "lead", operators: ["equals", "not_equals", "contains"] },
  {
    key: "appointment_status",
    label: "Status do agendamento",
    needs: "appointment",
    operators: ["equals", "not_equals"],
    options: [
      { value: "pendente", label: "Pendente" },
      { value: "confirmado", label: "Confirmado" },
      { value: "cancelado", label: "Cancelado" },
      { value: "concluido", label: "Concluído" },
    ],
  },
]

export function getConditionField(key: string): ConditionFieldDefinition | undefined {
  return conditionFields.find((field) => field.key === key)
}

export type ActionParamDefinition = {
  key: string
  label: string
  kind: "text" | "textarea" | "select"
  required: boolean
  maxLength: number
  placeholder?: string
  options?: { value: string; label: string }[]
  help?: string
}

export type ActionDefinition = {
  kind: ActionKind
  label: string
  description: string
  group: "WhatsApp" | "Leads" | "Clientes" | "Agenda" | "Equipe"
  needs: Capability[]
  provides?: Capability[]
  params: ActionParamDefinition[]
}

export const actionDefinitions: ActionDefinition[] = [
  {
    kind: "whatsapp.send_message",
    label: "Enviar mensagem no WhatsApp",
    description: "Envia um texto ao contato pelo número conectado.",
    group: "WhatsApp",
    needs: ["recipient"],
    params: [
      {
        key: "message",
        label: "Mensagem",
        kind: "textarea",
        required: true,
        maxLength: 1000,
        placeholder: "Olá {{nome}}! Recebemos sua mensagem e já vamos te atender.",
        help: "Variáveis: {{nome}} e {{telefone}}.",
      },
    ],
  },
  {
    kind: "whatsapp.run_agent",
    label: "Responder com o agente de IA",
    description: "O agente ativo responde a mensagem. Se o agente já respondeu, a etapa é ignorada.",
    group: "WhatsApp",
    needs: ["conversation", "message"],
    params: [],
  },
  {
    kind: "whatsapp.handoff",
    label: "Transferir para um atendente",
    description: "Marca a conversa como transferida para atendimento humano.",
    group: "WhatsApp",
    needs: ["conversation"],
    params: [],
  },
  {
    kind: "lead.create",
    label: "Criar lead",
    description: "Cria um lead com o nome e o telefone do contato (sem duplicar o mesmo telefone).",
    group: "Leads",
    needs: ["recipient"],
    provides: ["lead"],
    params: [
      { key: "source", label: "Origem", kind: "text", required: false, maxLength: 60, placeholder: "WhatsApp" },
    ],
  },
  {
    kind: "lead.update_status",
    label: "Atualizar status do lead",
    description: "Move o lead para outra etapa do funil.",
    group: "Leads",
    needs: ["lead"],
    params: [
      {
        key: "status",
        label: "Novo status",
        kind: "select",
        required: true,
        maxLength: 40,
        options: [
          { value: "contatado", label: "Contatado" },
          { value: "qualificado", label: "Qualificado" },
          { value: "demonstracao", label: "Demonstração" },
          { value: "negociacao", label: "Em negociação" },
          { value: "cliente", label: "Cliente" },
          { value: "perdido", label: "Perdido" },
        ],
      },
    ],
  },
  {
    kind: "lead.add_note",
    label: "Adicionar nota ao lead",
    description: "Acrescenta uma observação ao lead.",
    group: "Leads",
    needs: ["lead"],
    params: [{ key: "note", label: "Nota", kind: "textarea", required: true, maxLength: 500 }],
  },
  {
    kind: "client.create",
    label: "Criar cliente",
    description: "Cria um cliente com o nome e o telefone do contato (sem duplicar o mesmo telefone).",
    group: "Clientes",
    needs: ["recipient"],
    params: [],
  },
  {
    kind: "appointment.confirm",
    label: "Confirmar agendamento",
    description: "Marca o agendamento como confirmado.",
    group: "Agenda",
    needs: ["appointment"],
    params: [],
  },
  {
    kind: "appointment.cancel",
    label: "Cancelar agendamento",
    description: "Cancela o agendamento.",
    group: "Agenda",
    needs: ["appointment"],
    params: [],
  },
  {
    kind: "team.notify",
    label: "Notificar a equipe",
    description: "Cria uma notificação para a equipe da empresa.",
    group: "Equipe",
    needs: [],
    params: [
      { key: "title", label: "Título", kind: "text", required: true, maxLength: 100, placeholder: "Atenção necessária" },
      { key: "message", label: "Mensagem", kind: "textarea", required: false, maxLength: 300 },
    ],
  },
]

/** Ações previstas que ainda não têm base no sistema (sem tabela ou módulo). */
export const plannedActions: { label: string; reason: string }[] = [
  { label: "Adicionar tag", reason: "O sistema ainda não tem tags." },
  { label: "Criar tarefa interna", reason: "O sistema ainda não tem tarefas." },
  { label: "Encerrar conversa", reason: "Encerramento de conversa ainda não existe." },
  { label: "Atribuir a um responsável", reason: "Atribuição de conversas do WhatsApp ainda não existe." },
  { label: "Criar ou reagendar agendamento", reason: "Depende do motor de disponibilidade da agenda." },
]

export function getAction(kind: string): ActionDefinition | undefined {
  return actionDefinitions.find((action) => action.kind === kind)
}

export const categoryLabels: Record<AutomationCategory, string> = {
  atendimento: "Atendimento",
  vendas: "Vendas",
  agendamento: "Agendamento",
  relacionamento: "Relacionamento",
  geral: "Geral",
}

export const categoryKeys = Object.keys(categoryLabels) as AutomationCategory[]

export const delayPresets: { minutes: number; label: string }[] = [
  { minutes: 5, label: "5 minutos" },
  { minutes: 30, label: "30 minutos" },
  { minutes: 60, label: "1 hora" },
  { minutes: 60 * 24, label: "1 dia" },
  { minutes: 60 * 24 * 3, label: "3 dias" },
]

export function describeDelay(minutes: number): string {
  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24)
    return days === 1 ? "1 dia" : `${days} dias`
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? "1 hora" : `${hours} horas`
  }
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`
}
