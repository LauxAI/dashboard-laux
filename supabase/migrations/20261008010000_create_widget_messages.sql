-- Mensagens trocadas no widget de chat do site. Somente service_role acessa.

create table if not exists public.widget_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  session_id uuid not null references public.widget_sessions (id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint widget_messages_role_check check (role in ('visitor', 'agent')),
  constraint widget_messages_content_check check (char_length(content) between 1 and 4000)
);
create index if not exists widget_messages_session_idx on public.widget_messages (session_id, created_at);

alter table public.widget_messages enable row level security;
revoke all on public.widget_messages from anon, authenticated;
grant all on public.widget_messages to service_role;
