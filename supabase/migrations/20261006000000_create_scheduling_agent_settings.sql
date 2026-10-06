-- Configuração do Agente de Agendamento: uma linha por empresa.
-- Identidade, tom e comportamento ficam em `config` (jsonb); o status fica em coluna própria.
-- A agenda (horários, serviços, intervalos) continua em scheduling_settings,
-- business_hours e scheduling_services.

create table if not exists public.scheduling_agent_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  status text not null default 'inativo' check (status in ('ativo', 'inativo')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.scheduling_agent_settings enable row level security;

-- Acesso somente para usuários autenticados com conta de cliente ativa na empresa.
revoke all on table public.scheduling_agent_settings from anon;

drop policy if exists scheduling_agent_settings_select on public.scheduling_agent_settings;
create policy scheduling_agent_settings_select
  on public.scheduling_agent_settings for select
  to authenticated
  using (company_id = (select public.current_client_company_id()));

drop policy if exists scheduling_agent_settings_insert on public.scheduling_agent_settings;
create policy scheduling_agent_settings_insert
  on public.scheduling_agent_settings for insert
  to authenticated
  with check (company_id = (select public.current_client_company_id()));

drop policy if exists scheduling_agent_settings_update on public.scheduling_agent_settings;
create policy scheduling_agent_settings_update
  on public.scheduling_agent_settings for update
  to authenticated
  using (company_id = (select public.current_client_company_id()))
  with check (company_id = (select public.current_client_company_id()));

drop trigger if exists scheduling_agent_settings_updated_at on public.scheduling_agent_settings;
create trigger scheduling_agent_settings_updated_at
  before update on public.scheduling_agent_settings
  for each row execute function public.set_scheduling_updated_at();
