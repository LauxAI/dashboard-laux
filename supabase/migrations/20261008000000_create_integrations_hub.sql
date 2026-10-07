-- Hub de integrações: conexões por empresa, segredos criptografados, logs, webhooks
-- (saída e entrada), widget de chat e vínculos de sincronização com CRMs.
--
-- Segurança: todas as tabelas novas ficam acessíveis somente pela service_role no
-- servidor (RLS ligado, sem policy, sem privilégio para anon/authenticated). Segredos
-- (tokens, chaves de API, segredos de webhook) só existem em colunas *_ciphertext,
-- cifradas na aplicação com AES-256-GCM. `integrations` continua legível pela
-- empresa dona (somente campos não secretos) e nunca gravável pelo cliente.

-- 1. integrations (tabela já existente: estende, sem perder dados) ---------------

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null,
  status text not null default 'desconectado',
  config jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.integrations add column if not exists display_name text;
alter table public.integrations add column if not exists account_label text;
alter table public.integrations add column if not exists last_tested_at timestamptz;
alter table public.integrations add column if not exists last_error_code text;
alter table public.integrations add column if not exists last_error_message text;
alter table public.integrations add column if not exists updated_at timestamptz not null default now();

update public.integrations set config = '{}'::jsonb where config is null;
alter table public.integrations alter column config set default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'integrations_status_check') then
    alter table public.integrations
      add constraint integrations_status_check
      check (status in ('conectado', 'desconectado', 'erro', 'configuracao_necessaria'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'integrations_company_provider_key') then
    alter table public.integrations
      add constraint integrations_company_provider_key unique (company_id, provider);
  end if;
end $$;

create or replace function public.set_integrations_hub_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists integrations_set_updated_at on public.integrations;
create trigger integrations_set_updated_at
  before update on public.integrations
  for each row execute function public.set_integrations_hub_updated_at();

alter table public.integrations enable row level security;

do $$
declare policy_name text;
begin
  for policy_name in select policyname from pg_policies where schemaname = 'public' and tablename = 'integrations'
  loop
    execute format('drop policy %I on public.integrations', policy_name);
  end loop;
end $$;

create policy integrations_select_own_company on public.integrations
  for select to authenticated
  using (company_id = public.current_client_company_id());

revoke all on public.integrations from anon;
revoke insert, update, delete on public.integrations from authenticated;
grant select on public.integrations to authenticated;
grant all on public.integrations to service_role;

-- 2. Segredos das conexões (somente service_role) ----------------------------------

create table if not exists public.integration_secrets (
  integration_id uuid primary key references public.integrations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  ciphertext text not null,
  hint text,
  updated_at timestamptz not null default now(),
  constraint integration_secrets_ciphertext_check check (char_length(ciphertext) between 1 and 20000)
);

-- 3. Logs de chamadas a integrações (sem segredos, sem payload) --------------------

create table if not exists public.integration_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null,
  operation text not null,
  status text not null,
  http_status integer,
  duration_ms integer,
  error_code text,
  message text,
  created_at timestamptz not null default now(),
  constraint integration_logs_status_check check (status in ('success', 'failed'))
);
create index if not exists integration_logs_company_created_idx
  on public.integration_logs (company_id, created_at desc);
create index if not exists integration_logs_company_provider_idx
  on public.integration_logs (company_id, provider, created_at desc);

-- 4. Webhooks de saída ---------------------------------------------------------------

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  url text not null,
  events text[] not null default '{}',
  active boolean not null default true,
  secret_hint text,
  consecutive_failures integer not null default 0,
  disabled_reason text,
  last_delivery_at timestamptz,
  last_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint webhook_endpoints_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint webhook_endpoints_url_check check (char_length(url) between 8 and 2048 and url like 'https://%')
);
create index if not exists webhook_endpoints_company_idx on public.webhook_endpoints (company_id);

-- Segredo de assinatura e cabeçalhos personalizados: cifrados.
create table if not exists public.webhook_endpoint_secrets (
  endpoint_id uuid primary key references public.webhook_endpoints (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints (id) on delete cascade,
  event_id text not null,
  event_type text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  http_status integer,
  duration_ms integer,
  error_message text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  constraint webhook_deliveries_status_check check (status in ('pending', 'success', 'failed')),
  constraint webhook_deliveries_event_unique unique (endpoint_id, event_id)
);
create index if not exists webhook_deliveries_company_created_idx
  on public.webhook_deliveries (company_id, created_at desc);
create index if not exists webhook_deliveries_endpoint_created_idx
  on public.webhook_deliveries (endpoint_id, created_at desc);

-- 5. Webhook de entrada (uma URL secreta por empresa; só o hash do token é guardado) -

create table if not exists public.inbound_webhook_endpoints (
  company_id uuid primary key references public.companies (id) on delete cascade,
  token_hash text not null unique,
  token_hint text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

create table if not exists public.inbound_webhook_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  event_key text not null,
  event_type text,
  status text not null default 'accepted',
  payload jsonb,
  result_message text,
  received_at timestamptz not null default now(),
  constraint inbound_webhook_events_status_check check (status in ('accepted', 'ignored', 'rejected')),
  constraint inbound_webhook_events_unique unique (company_id, event_key)
);
create index if not exists inbound_webhook_events_company_idx
  on public.inbound_webhook_events (company_id, received_at desc);

-- 6. Widget de chat para site ---------------------------------------------------------

create table if not exists public.chat_widgets (
  company_id uuid primary key references public.companies (id) on delete cascade,
  public_key text not null unique,
  enabled boolean not null default false,
  title text not null default 'Fale com a gente',
  welcome_message text not null default 'Olá! Como posso ajudar?',
  primary_color text not null default '#1f6f5c',
  position text not null default 'right',
  collect_contact boolean not null default true,
  allowed_origins text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_widgets_color_check check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint chat_widgets_position_check check (position in ('left', 'right')),
  constraint chat_widgets_title_check check (char_length(title) between 1 and 60),
  constraint chat_widgets_welcome_check check (char_length(welcome_message) between 1 and 300)
);

create table if not exists public.widget_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  origin text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists widget_sessions_company_idx on public.widget_sessions (company_id, created_at desc);

-- 7. Vínculo entre registros LAUXAI e registros do CRM externo ------------------------

create table if not exists public.crm_sync_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null,
  entity_type text not null,
  entity_id uuid not null,
  external_id text not null,
  last_synced_at timestamptz not null default now(),
  constraint crm_sync_links_entity_type_check check (entity_type in ('lead', 'client')),
  constraint crm_sync_links_unique unique (company_id, provider, entity_type, entity_id)
);

-- Privilégios: tudo somente service_role ----------------------------------------------

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'integration_secrets', 'integration_logs', 'webhook_endpoints', 'webhook_endpoint_secrets',
    'webhook_deliveries', 'inbound_webhook_endpoints', 'inbound_webhook_events', 'chat_widgets',
    'widget_sessions', 'crm_sync_links'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
  end loop;
end $$;
