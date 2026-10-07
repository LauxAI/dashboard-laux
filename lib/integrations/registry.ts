/**
 * Catálogo dos provedores conectáveis do hub. Sem dependências de servidor: a UI e o
 * servidor usam as mesmas definições de campos e textos de ajuda. Campos com
 * `secret: true` são criptografados no servidor e nunca voltam ao navegador.
 */

export type ProviderId = "openai" | "n8n" | "make" | "hubspot" | "pipedrive" | "rdstation"

export type IntegrationCategoryId = "ia" | "automacao" | "crm"

export type FieldDefinition = {
  key: string
  label: string
  type: "text" | "password" | "url" | "select"
  required: boolean
  secret: boolean
  placeholder?: string
  help?: string
  options?: { value: string; label: string }[]
}

export type ProviderDefinition = {
  id: ProviderId
  name: string
  description: string
  category: IntegrationCategoryId
  fields: FieldDefinition[]
  /** Passos para obter as credenciais no serviço. */
  steps: string[]
  /** Como validar que está funcionando, mostrado após conectar. */
  testHint: string
}

export const categoryDefinitions: Record<IntegrationCategoryId, { label: string; description: string }> = {
  ia: { label: "Inteligência artificial", description: "Provedores de modelos que respondem pelos seus agentes." },
  automacao: { label: "Automação", description: "Dispare fluxos externos a partir dos eventos da LAUXAI." },
  crm: { label: "CRM", description: "Mantenha leads e clientes sincronizados com o seu CRM." },
}

export const providers: ProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Use modelos da OpenAI nos seus agentes de IA com a sua própria chave.",
    category: "ia",
    fields: [
      {
        key: "apiKey",
        label: "Chave de API",
        type: "password",
        required: true,
        secret: true,
        placeholder: "sk-...",
        help: "Fica criptografada e nunca é exibida novamente.",
      },
    ],
    steps: [
      "Acesse platform.openai.com e entre na sua conta.",
      "Abra API keys e crie uma nova chave secreta.",
      "Copie a chave (ela só aparece uma vez) e cole aqui.",
    ],
    testHint: "Ao conectar, validamos a chave listando os modelos disponíveis. Depois escolha o modelo e envie uma pergunta de teste.",
  },
  {
    id: "n8n",
    name: "n8n",
    description: "Liste e execute workflows do seu n8n a partir de automações e eventos.",
    category: "automacao",
    fields: [
      {
        key: "baseUrl",
        label: "URL do n8n",
        type: "url",
        required: true,
        secret: false,
        placeholder: "https://seu-n8n.exemplo.com",
        help: "Somente https e endereços públicos.",
      },
      { key: "apiKey", label: "Chave de API do n8n", type: "password", required: true, secret: true },
    ],
    steps: [
      "No n8n, abra Settings > n8n API e crie uma API key.",
      "Copie a URL base da sua instância (sem /api/v1).",
      "Os workflows executados precisam estar ativos e ter um gatilho Webhook.",
    ],
    testHint: "Ao conectar, listamos seus workflows para validar a chave. Use Executar para disparar um workflow de teste.",
  },
  {
    id: "make",
    name: "Make",
    description: "Liste e execute cenários do Make a partir de automações e eventos.",
    category: "automacao",
    fields: [
      {
        key: "zone",
        label: "Zona da conta",
        type: "select",
        required: true,
        secret: false,
        options: [
          { value: "eu1", label: "eu1.make.com" },
          { value: "eu2", label: "eu2.make.com" },
          { value: "us1", label: "us1.make.com" },
          { value: "us2", label: "us2.make.com" },
        ],
        help: "É o início do endereço que você vê ao entrar no Make.",
      },
      { key: "teamId", label: "ID da equipe", type: "text", required: true, secret: false, placeholder: "123456", help: "Aparece na URL: /team/ID/." },
      {
        key: "apiToken",
        label: "Token de API",
        type: "password",
        required: true,
        secret: true,
        help: "Em Perfil > API, crie um token com os escopos scenarios:read e scenarios:run.",
      },
    ],
    steps: [
      "No Make, abra seu perfil > API e gere um token com scenarios:read e scenarios:run.",
      "Anote a zona (ex.: eu1) e o ID da equipe na URL.",
      "Os cenários executados precisam estar ativos.",
    ],
    testHint: "Ao conectar, listamos seus cenários para validar o token. Use Executar para rodar um cenário.",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Envie leads e clientes para contatos do HubSpot e importe contatos existentes.",
    category: "crm",
    fields: [
      {
        key: "accessToken",
        label: "Token do app privado",
        type: "password",
        required: true,
        secret: true,
        placeholder: "pat-...",
        help: "Precisa dos escopos crm.objects.contacts.read e crm.objects.contacts.write.",
      },
    ],
    steps: [
      "No HubSpot, abra Configurações > Integrações > Apps privados e crie um app.",
      "Em Escopos, marque crm.objects.contacts.read e crm.objects.contacts.write.",
      "Crie o app, copie o token de acesso e cole aqui.",
    ],
    testHint: "Ao conectar, validamos o token consultando contatos. Depois use Importar contatos ou crie um lead para ver o envio.",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Envie leads e clientes como pessoas do Pipedrive e importe contatos existentes.",
    category: "crm",
    fields: [
      {
        key: "companyDomain",
        label: "Domínio da conta",
        type: "text",
        required: true,
        secret: false,
        placeholder: "suaempresa",
        help: "A parte antes de .pipedrive.com no endereço da sua conta.",
      },
      {
        key: "apiToken",
        label: "Token de API pessoal",
        type: "password",
        required: true,
        secret: true,
        help: "Em Configurações pessoais > API.",
      },
    ],
    steps: [
      "No Pipedrive, abra Configurações pessoais > API.",
      "Copie o token pessoal e o domínio da conta (ex.: suaempresa.pipedrive.com).",
      "Cole os dois aqui.",
    ],
    testHint: "Ao conectar, validamos o token consultando o seu usuário. Depois use Importar contatos ou crie um lead.",
  },
  {
    id: "rdstation",
    name: "RD Station CRM",
    description: "Envie leads e clientes como contatos do RD Station CRM e importe contatos existentes.",
    category: "crm",
    fields: [
      {
        key: "apiToken",
        label: "Token da API",
        type: "password",
        required: true,
        secret: true,
        help: "Em Configurações > Integrações > Token da API.",
      },
    ],
    steps: [
      "No RD Station CRM, abra Configurações > Integrações.",
      "Copie o Token da API da sua conta.",
      "Cole o token aqui.",
    ],
    testHint: "Ao conectar, validamos o token consultando contatos. Depois use Importar contatos ou crie um lead.",
  },
]

export function getProvider(id: string): ProviderDefinition | undefined {
  return providers.find((provider) => provider.id === id)
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && providers.some((provider) => provider.id === value)
}

export const crmProviderIds: ProviderId[] = ["hubspot", "pipedrive", "rdstation"]

export type ConnectionStatus = "conectado" | "desconectado" | "erro" | "configuracao_necessaria"

/** Visão segura de uma conexão para a UI: nunca contém segredos. */
export type IntegrationView = {
  provider: ProviderId
  status: ConnectionStatus
  accountLabel: string | null
  /** Configuração não secreta (ex.: URL, modelo escolhido). */
  config: Record<string, string>
  secretHint: string | null
  lastTestedAt: string | null
  lastErrorMessage: string | null
  connectedAt: string | null
}
