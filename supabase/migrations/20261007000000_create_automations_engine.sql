-- Motor de automações por empresa (multi-tenant).
--
-- Reaproveita a tabela public.automations que já existe (sem linhas) e a estende.
-- Tabelas novas: automation_steps, automation_runs, automation_run_steps.
--
-- Quem escreve o quê:
--   * authenticated: CRUD em automations e automation_steps, só da própria empresa
--     (current_client_company_id()). SELECT em automation_runs e automation_run_steps.
--   * service_role (motor no servidor): escreve execuções e etapas de execução.
--   * anon: nenhum privilégio e nenhuma policy.
--
-- Os templates da biblioteca ficam versionados no código (lib/automations/templates.ts)
-- e não em tabela: assim são testáveis e não dependem de dados no banco.

-- ---------------------------------------------------------------------------
-- 1. automations (já existente)
-- ---------------------------------------------------------------------------

-- Valores legados -> novo vocabulário.
update public.automations set status = case status
  when 'ativa' then 'active'
  when 'pausada' then 'paused'
  when 'rascunho' then 'draft'
  when 'inativa' then 'draft'
  when 'erro' then 'paused'
  else status
end;

alter table public.automations
  add column if not exists trigger_type text,
  add column if not exists category text,
  add column if not exists config jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid references auth.users (id) on delete set null default auth.uid(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_run_at timestamptz,
  add column if not exists errors_count integer not null default 0;

alter table public.automations alter column status set default 'draft';

alter table public.automations
  add constraint automations_status_check check (status in ('active', 'paused', 'draft')),
  add constraint automations_name_length check (char_length(btrim(name)) between 1 and 120),
  add constraint automations_category_check
    check (category is null or category in ('atendimento', 'vendas', 'agendamento', 'relacionamento', 'geral')),
  add constraint automations_trigger_type_length check (trigger_type is null or char_length(trigger_type) <= 80),
  add constraint automations_active_requires_trigger check (status <> 'active' or trigger_type is not null),
  add constraint automations_counters_check check (executions_count >= 0 and errors_count >= 0),
  add constraint automations_id_company_key unique (id, company_id);

create index if not exists idx_automations_company_status on public.automations (company_id, status);
create index if not exists idx_automations_company_trigger
  on public.automations (company_id, trigger_type) where status = 'active';

create or replace function public.set_automation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_automation_company_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'automation_company_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists automations_set_updated_at on public.automations;
create trigger automations_set_updated_at
  before update on public.automations
  for each row execute function public.set_automation_updated_at();

drop trigger if exists automations_company_immutable on public.automations;
create trigger automations_company_immutable
  before update on public.automations
  for each row execute function public.prevent_automation_company_change();

-- Policies recriadas só para authenticated, com WITH CHECK também no UPDATE
-- (a policy antiga permitia mover a linha para outra empresa).
drop policy if exists automations_select on public.automations;
drop policy if exists automations_insert on public.automations;
drop policy if exists automations_update on public.automations;
drop policy if exists automations_delete on public.automations;

create policy automations_select on public.automations
  for select to authenticated
  using (company_id = (select public.current_client_company_id()));
create policy automations_insert on public.automations
  for insert to authenticated
  with check (company_id = (select public.current_client_company_id()));
create policy automations_update on public.automations
  for update to authenticated
  using (company_id = (select public.current_client_company_id()))
  with check (company_id = (select public.current_client_company_id()));
create policy automations_delete on public.automations
  for delete to authenticated
  using (company_id = (select public.current_client_company_id()));

alter table public.automations enable row level security;
alter table public.automations force row level security;

revoke all on table public.automations from anon;
revoke truncate, references, trigger on table public.automations from authenticated;
grant select, insert, update, delete on table public.automations to authenticated;
grant all on table public.automations to service_role;

-- ---------------------------------------------------------------------------
-- 2. automation_steps: condições, ações e esperas, em ordem.
--    parent_step_id + branch deixam o modelo pronto para ramificação SIM/NÃO
--    (a v1 usa só a trilha linear: parent_step_id nulo).
-- ---------------------------------------------------------------------------

create table public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  step_order integer not null check (step_order between 0 and 49),
  step_type text not null check (step_type in ('condition', 'action', 'delay')),
  config jsonb not null default '{}'::jsonb,
  parent_step_id uuid references public.automation_steps (id) on delete cascade,
  branch text check (branch in ('yes', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_steps_automation_fkey
    foreign key (automation_id, company_id)
    references public.automations (id, company_id) on delete cascade,
  constraint automation_steps_order_key unique (automation_id, step_order) deferrable initially deferred,
  constraint automation_steps_branch_requires_parent check ((parent_step_id is null) = (branch is null))
);

create index idx_automation_steps_automation on public.automation_steps (automation_id, step_order);
create index idx_automation_steps_company on public.automation_steps (company_id);

create trigger automation_steps_set_updated_at
  before update on public.automation_steps
  for each row execute function public.set_automation_updated_at();

alter table public.automation_steps enable row level security;
alter table public.automation_steps force row level security;

create policy automation_steps_select on public.automation_steps
  for select to authenticated
  using (company_id = (select public.current_client_company_id()));
create policy automation_steps_insert on public.automation_steps
  for insert to authenticated
  with check (company_id = (select public.current_client_company_id()));
create policy automation_steps_update on public.automation_steps
  for update to authenticated
  using (company_id = (select public.current_client_company_id()))
  with check (company_id = (select public.current_client_company_id()));
create policy automation_steps_delete on public.automation_steps
  for delete to authenticated
  using (company_id = (select public.current_client_company_id()));

revoke all on table public.automation_steps from anon;
revoke truncate, references, trigger on table public.automation_steps from authenticated;
grant select, insert, update, delete on table public.automation_steps to authenticated;
grant all on table public.automation_steps to service_role;

-- Troca atômica das etapas de uma automação. SECURITY INVOKER: o RLS do chamador
-- vale, e company_id vem da própria automação (nunca do argumento).
create or replace function public.replace_automation_steps(p_automation_id uuid, p_steps jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company uuid;
begin
  if jsonb_typeof(p_steps) is distinct from 'array' then
    raise exception 'automation_steps_invalid' using errcode = 'P0001';
  end if;

  select a.company_id into v_company from public.automations a where a.id = p_automation_id;
  if v_company is null then
    raise exception 'automation_not_found' using errcode = 'P0002';
  end if;

  delete from public.automation_steps where automation_id = p_automation_id;

  insert into public.automation_steps (automation_id, company_id, step_order, step_type, config)
  select
    p_automation_id,
    v_company,
    (item.ord - 1)::int,
    item.value ->> 'step_type',
    coalesce(item.value -> 'config', '{}'::jsonb)
  from jsonb_array_elements(p_steps) with ordinality as item (value, ord);
end;
$$;

revoke all on function public.replace_automation_steps(uuid, jsonb) from public, anon;
grant execute on function public.replace_automation_steps(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. automation_runs: uma linha por (automação, evento). A UNIQUE é a
--    idempotência: o mesmo evento entregue duas vezes gera uma execução só.
-- ---------------------------------------------------------------------------

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  trigger_event_id text not null check (char_length(trigger_event_id) between 1 and 200),
  trigger_type text not null,
  status text not null default 'running'
    check (status in ('running', 'waiting', 'success', 'failed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  -- Contexto mínimo do evento (ids e campos curtos), necessário para retomar após um delay.
  context jsonb not null default '{}'::jsonb,
  next_step_order integer not null default 0,
  resume_at timestamptz,
  -- Atualizado quando a execução começa ou é retomada; detecta execuções presas em 'running'.
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint automation_runs_automation_fkey
    foreign key (automation_id, company_id)
    references public.automations (id, company_id) on delete cascade,
  constraint automation_runs_idempotency_key unique (automation_id, trigger_event_id),
  constraint automation_runs_id_company_key unique (id, company_id),
  constraint automation_runs_waiting_has_resume check (status <> 'waiting' or resume_at is not null)
);

create index idx_automation_runs_history on public.automation_runs (company_id, automation_id, started_at desc);
create index idx_automation_runs_due on public.automation_runs (resume_at) where status = 'waiting';
create index idx_automation_runs_running on public.automation_runs (last_activity_at) where status = 'running';

alter table public.automation_runs enable row level security;
alter table public.automation_runs force row level security;

create policy automation_runs_select on public.automation_runs
  for select to authenticated
  using (company_id = (select public.current_client_company_id()));

revoke all on table public.automation_runs from anon, authenticated;
grant select on table public.automation_runs to authenticated;
grant all on table public.automation_runs to service_role;

-- ---------------------------------------------------------------------------
-- 4. automation_run_steps: o que aconteceu em cada etapa de uma execução.
-- ---------------------------------------------------------------------------

create table public.automation_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  step_order integer not null check (step_order >= -1),
  step_type text not null check (step_type in ('trigger', 'condition', 'action', 'delay')),
  status text not null check (status in ('success', 'failed', 'skipped', 'waiting')),
  label text not null check (char_length(label) <= 200),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint automation_run_steps_run_fkey
    foreign key (run_id, company_id)
    references public.automation_runs (id, company_id) on delete cascade,
  constraint automation_run_steps_order_key unique (run_id, step_order)
);

create index idx_automation_run_steps_company on public.automation_run_steps (company_id);

alter table public.automation_run_steps enable row level security;
alter table public.automation_run_steps force row level security;

create policy automation_run_steps_select on public.automation_run_steps
  for select to authenticated
  using (company_id = (select public.current_client_company_id()));

revoke all on table public.automation_run_steps from anon, authenticated;
grant select on table public.automation_run_steps to authenticated;
grant all on table public.automation_run_steps to service_role;

-- ---------------------------------------------------------------------------
-- 5. Encerramento atômico de uma execução + contadores da automação.
--    Só avança runs em 'running'/'waiting': nunca reabre nem conta duas vezes.
-- ---------------------------------------------------------------------------

create or replace function public.finish_automation_run(
  p_run_id uuid,
  p_status text,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.automation_runs;
begin
  if p_status not in ('success', 'failed', 'cancelled') then
    raise exception 'automation_run_status_invalid' using errcode = 'P0001';
  end if;

  update public.automation_runs
     set status = p_status,
         completed_at = now(),
         resume_at = null,
         error_code = left(p_error_code, 80),
         error_message = left(p_error_message, 300)
   where id = p_run_id
     and status in ('running', 'waiting')
  returning * into v_run;

  if v_run.id is null then
    return false;
  end if;

  update public.automations
     set executions_count = executions_count + 1,
         errors_count = errors_count + case when p_status = 'failed' then 1 else 0 end,
         last_run_at = now()
   where id = v_run.automation_id
     and company_id = v_run.company_id;

  return true;
end;
$$;

revoke all on function public.finish_automation_run(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.finish_automation_run(uuid, text, text, text) to service_role;
