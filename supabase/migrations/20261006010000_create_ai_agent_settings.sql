-- Configuração dos agentes de IA de Atendimento, Vendas e Suporte.
-- Uma linha por empresa e por tipo de agente.
-- O Agendamento continua em scheduling_agent_settings.

create or replace function public.set_ai_agent_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) Configuração dos agentes
create table if not exists public.ai_agent_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  agent_type text not null,
  status text not null default 'inativo',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  constraint ai_agent_settings_company_type_key unique (company_id, agent_type),
  constraint ai_agent_settings_type_check
    check (agent_type in ('atendimento', 'vendas', 'suporte')),
  constraint ai_agent_settings_status_check
    check (status in ('ativo', 'inativo')),
  constraint ai_agent_settings_config_is_object
    check (jsonb_typeof(config) = 'object'),
  constraint ai_agent_settings_config_size
    check (octet_length(config::text) <= 65536)
);

alter table public.ai_agent_settings enable row level security;
revoke all on table public.ai_agent_settings from anon;
revoke delete on table public.ai_agent_settings from authenticated;

drop policy if exists ai_agent_settings_select on public.ai_agent_settings;
create policy ai_agent_settings_select
  on public.ai_agent_settings for select
  to authenticated
  using (company_id = (select public.current_client_company_id()));

drop policy if exists ai_agent_settings_insert on public.ai_agent_settings;
create policy ai_agent_settings_insert
  on public.ai_agent_settings for insert
  to authenticated
  with check (company_id = (select public.current_client_company_id()));

drop policy if exists ai_agent_settings_update on public.ai_agent_settings;
create policy ai_agent_settings_update
  on public.ai_agent_settings for update
  to authenticated
  using (company_id = (select public.current_client_company_id()))
  with check (company_id = (select public.current_client_company_id()));

drop trigger if exists ai_agent_settings_updated_at on public.ai_agent_settings;
create trigger ai_agent_settings_updated_at
  before update on public.ai_agent_settings
  for each row execute function public.set_ai_agent_updated_at();

-- 2) Registro de uso (só metadados; nunca guarda o texto das mensagens)
create table if not exists public.ai_agent_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  agent_type text not null,
  source text not null default 'playground',
  status text not null,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now(),

  constraint ai_agent_usage_type_check
    check (agent_type in ('atendimento', 'vendas', 'suporte')),
  constraint ai_agent_usage_source_check
    check (source in ('playground', 'conversation')),
  constraint ai_agent_usage_status_check
    check (status in ('success', 'error')),
  constraint ai_agent_usage_tokens_check
    check (coalesce(input_tokens, 0) >= 0 and coalesce(output_tokens, 0) >= 0),
  constraint ai_agent_usage_latency_check
    check (coalesce(latency_ms, 0) >= 0)
);

create index if not exists idx_ai_agent_usage_user_created
  on public.ai_agent_usage (user_id, created_at desc);
create index if not exists idx_ai_agent_usage_company_created
  on public.ai_agent_usage (company_id, created_at desc);

alter table public.ai_agent_usage enable row level security;
revoke all on table public.ai_agent_usage from anon;
revoke update, delete on table public.ai_agent_usage from authenticated;

drop policy if exists ai_agent_usage_select on public.ai_agent_usage;
create policy ai_agent_usage_select
  on public.ai_agent_usage for select
  to authenticated
  using (company_id = (select public.current_client_company_id()));

drop policy if exists ai_agent_usage_insert on public.ai_agent_usage;
create policy ai_agent_usage_insert
  on public.ai_agent_usage for insert
  to authenticated
  with check (
    company_id = (select public.current_client_company_id())
    and user_id = (select auth.uid())
  );
