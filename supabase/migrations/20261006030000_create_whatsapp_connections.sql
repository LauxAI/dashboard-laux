-- Conexões WhatsApp: mapeia cada phone_number_id da Meta para uma empresa LAUXAI.
-- Guarda o access_token (secreto), por isso a tabela é acessível somente pela
-- service_role no servidor. anon e authenticated não têm nenhum privilégio e não
-- existe policy: RLS nega tudo por padrão.
-- Não guarda conteúdo de mensagens.

create or replace function public.set_whatsapp_connection_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Um número pertence a uma única empresa. Impede que um upsert por phone_number_id
-- transfira silenciosamente o número (e o token) para outra empresa.
create or replace function public.prevent_whatsapp_connection_company_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'whatsapp_connection_company_immutable'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  phone_number_id text not null,
  waba_id text,
  display_phone_number text,
  business_name text,
  status text not null default 'active',
  access_token text,
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint whatsapp_connections_phone_number_id_key unique (phone_number_id),
  constraint whatsapp_connections_status_check
    check (status in ('active', 'inactive', 'disconnected')),
  constraint whatsapp_connections_phone_number_id_check
    check (char_length(btrim(phone_number_id)) between 1 and 256 and phone_number_id = btrim(phone_number_id)),
  constraint whatsapp_connections_waba_id_check
    check (waba_id is null or char_length(btrim(waba_id)) between 1 and 256),
  constraint whatsapp_connections_display_phone_check
    check (display_phone_number is null or char_length(display_phone_number) <= 32),
  constraint whatsapp_connections_business_name_check
    check (business_name is null or char_length(business_name) <= 256),
  constraint whatsapp_connections_access_token_check
    check (access_token is null or char_length(access_token) between 1 and 4096)
);

-- phone_number_id já é indexado pela constraint unique.
create index if not exists idx_whatsapp_connections_company
  on public.whatsapp_connections (company_id);

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_connections force row level security;

revoke all on table public.whatsapp_connections from public;
revoke all on table public.whatsapp_connections from anon;
revoke all on table public.whatsapp_connections from authenticated;
grant select, insert, update, delete on table public.whatsapp_connections to service_role;

revoke all on function public.prevent_whatsapp_connection_company_change() from public, anon, authenticated;
revoke all on function public.set_whatsapp_connection_updated_at() from public, anon, authenticated;

drop trigger if exists whatsapp_connections_company_immutable on public.whatsapp_connections;
create trigger whatsapp_connections_company_immutable
  before update on public.whatsapp_connections
  for each row execute function public.prevent_whatsapp_connection_company_change();

drop trigger if exists whatsapp_connections_updated_at on public.whatsapp_connections;
create trigger whatsapp_connections_updated_at
  before update on public.whatsapp_connections
  for each row execute function public.set_whatsapp_connection_updated_at();
