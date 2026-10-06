-- Conversas e mensagens do WhatsApp por empresa (multi-tenant).
-- Escrita exclusivamente pelo servidor (service_role). O cliente autenticado só pode
-- ler (SELECT) as linhas da própria empresa via current_client_company_id().
-- anon não tem privilégio algum e não existe policy para anon.
-- Não guarda payload bruto do webhook, headers, assinatura nem tokens.

create or replace function public.set_whatsapp_conversation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A identidade da conversa nunca muda: empresa, conexão e contato são fixos.
create or replace function public.prevent_whatsapp_conversation_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id
     or new.whatsapp_connection_id is distinct from old.whatsapp_connection_id
     or new.contact_phone is distinct from old.contact_phone then
    raise exception 'whatsapp_conversation_identity_immutable'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- A conexão informada precisa pertencer à mesma empresa da conversa.
-- (company_id da conexão é imutável, então a checagem na criação basta.)
create or replace function public.check_whatsapp_conversation_connection_company()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.whatsapp_connections c
    where c.id = new.whatsapp_connection_id
      and c.company_id = new.company_id
  ) then
    raise exception 'whatsapp_conversation_connection_company_mismatch'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_whatsapp_message_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.conversation_id is distinct from old.conversation_id
     or new.company_id is distinct from old.company_id
     or new.direction is distinct from old.direction then
    raise exception 'whatsapp_message_identity_immutable'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Atômico com o INSERT da mensagem: atualiza last_message_at (nunca retrocede) e,
-- pelo trigger de updated_at, o updated_at da conversa. Não mexe no status.
create or replace function public.touch_whatsapp_conversation_on_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.whatsapp_conversations
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
   where id = new.conversation_id
     and company_id = new.company_id;
  return new;
end;
$$;

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  whatsapp_connection_id uuid not null references public.whatsapp_connections (id) on delete cascade,
  contact_phone text not null,
  contact_name text,
  status text not null default 'open',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Alvo da chave estrangeira composta das mensagens: garante que a mensagem
  -- tenha o mesmo company_id da conversa.
  constraint whatsapp_conversations_id_company_key unique (id, company_id),
  constraint whatsapp_conversations_connection_contact_key unique (whatsapp_connection_id, contact_phone),
  constraint whatsapp_conversations_status_check
    check (status in ('open', 'closed', 'handoff')),
  constraint whatsapp_conversations_contact_phone_check
    check (contact_phone ~ '^\+?[0-9]{7,20}$'),
  constraint whatsapp_conversations_contact_name_check
    check (contact_name is null or char_length(btrim(contact_name)) between 1 and 256)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  direction text not null,
  message_type text not null,
  whatsapp_message_id text,
  sender_phone text,
  recipient_phone text,
  text_content text,
  status text not null default 'received',
  created_at timestamptz not null default now(),

  constraint whatsapp_messages_conversation_fkey
    foreign key (conversation_id, company_id)
    references public.whatsapp_conversations (id, company_id)
    on delete cascade,
  constraint whatsapp_messages_direction_check
    check (direction in ('inbound', 'outbound')),
  constraint whatsapp_messages_message_type_check
    check (message_type in ('text', 'image', 'audio', 'video', 'document', 'interactive', 'unknown')),
  constraint whatsapp_messages_status_check
    check (status in ('received', 'sent', 'delivered', 'read', 'failed')),
  constraint whatsapp_messages_whatsapp_message_id_check
    check (whatsapp_message_id is null or char_length(btrim(whatsapp_message_id)) between 1 and 256),
  constraint whatsapp_messages_sender_phone_check
    check (sender_phone is null or sender_phone ~ '^\+?[0-9]{7,20}$'),
  constraint whatsapp_messages_recipient_phone_check
    check (recipient_phone is null or recipient_phone ~ '^\+?[0-9]{7,20}$'),
  constraint whatsapp_messages_text_content_check
    check (text_content is null or char_length(text_content) <= 4096),
  -- Mensagem recebida tem remetente e status "received"; enviada tem destinatário.
  constraint whatsapp_messages_direction_consistency_check
    check (
      (direction = 'inbound' and sender_phone is not null and status = 'received')
      or (direction = 'outbound' and recipient_phone is not null and status <> 'received')
    )
);

create index if not exists idx_whatsapp_conversations_company
  on public.whatsapp_conversations (company_id);
create index if not exists idx_whatsapp_conversations_connection
  on public.whatsapp_conversations (whatsapp_connection_id);
create index if not exists idx_whatsapp_conversations_last_message_at
  on public.whatsapp_conversations (last_message_at desc nulls last);

create index if not exists idx_whatsapp_messages_conversation_created
  on public.whatsapp_messages (conversation_id, created_at);
create index if not exists idx_whatsapp_messages_company_created
  on public.whatsapp_messages (company_id, created_at);
-- A Meta pode reenviar eventos: o mesmo wamid nunca gera duas linhas.
create unique index if not exists idx_whatsapp_messages_whatsapp_message_id
  on public.whatsapp_messages (whatsapp_message_id)
  where whatsapp_message_id is not null;

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_conversations force row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_messages force row level security;

revoke all on table public.whatsapp_conversations from public, anon, authenticated;
revoke all on table public.whatsapp_messages from public, anon, authenticated;
grant select on table public.whatsapp_conversations to authenticated;
grant select on table public.whatsapp_messages to authenticated;
grant select, insert, update, delete on table public.whatsapp_conversations to service_role;
grant select, insert, update, delete on table public.whatsapp_messages to service_role;

-- Somente SELECT para o cliente autenticado, e só da própria empresa.
-- Sem policies de INSERT/UPDATE/DELETE e sem policies para anon.
drop policy if exists whatsapp_conversations_select on public.whatsapp_conversations;
create policy whatsapp_conversations_select
  on public.whatsapp_conversations
  for select
  to authenticated
  using (company_id = (select public.current_client_company_id()));

drop policy if exists whatsapp_messages_select on public.whatsapp_messages;
create policy whatsapp_messages_select
  on public.whatsapp_messages
  for select
  to authenticated
  using (company_id = (select public.current_client_company_id()));

revoke all on function public.set_whatsapp_conversation_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_whatsapp_conversation_identity_change() from public, anon, authenticated;
revoke all on function public.check_whatsapp_conversation_connection_company() from public, anon, authenticated;
revoke all on function public.prevent_whatsapp_message_identity_change() from public, anon, authenticated;
revoke all on function public.touch_whatsapp_conversation_on_message() from public, anon, authenticated;

drop trigger if exists whatsapp_conversations_connection_company on public.whatsapp_conversations;
create trigger whatsapp_conversations_connection_company
  before insert on public.whatsapp_conversations
  for each row execute function public.check_whatsapp_conversation_connection_company();

drop trigger if exists whatsapp_conversations_identity_immutable on public.whatsapp_conversations;
create trigger whatsapp_conversations_identity_immutable
  before update on public.whatsapp_conversations
  for each row execute function public.prevent_whatsapp_conversation_identity_change();

drop trigger if exists whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger whatsapp_conversations_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.set_whatsapp_conversation_updated_at();

drop trigger if exists whatsapp_messages_identity_immutable on public.whatsapp_messages;
create trigger whatsapp_messages_identity_immutable
  before update on public.whatsapp_messages
  for each row execute function public.prevent_whatsapp_message_identity_change();

drop trigger if exists whatsapp_messages_touch_conversation on public.whatsapp_messages;
create trigger whatsapp_messages_touch_conversation
  after insert on public.whatsapp_messages
  for each row execute function public.touch_whatsapp_conversation_on_message();
