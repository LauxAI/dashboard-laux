-- Eventos recebidos no webhook da WhatsApp Cloud API (idempotência e auditoria).
-- Guarda apenas metadados: nunca o payload completo, o texto da mensagem
-- nem o número do cliente. O hash identifica o evento sem expor seu conteúdo.
--
-- O webhook é server-side e grava com a service role (que ignora RLS).
-- Nenhuma política é criada de propósito: anon e authenticated não leem nem escrevem.

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  whatsapp_business_account_id text,
  phone_number_id text not null,
  whatsapp_message_id text,
  event_type text not null,
  dedupe_key text not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received',
  error_message text,

  constraint whatsapp_webhook_events_dedupe_key_key unique (dedupe_key),
  constraint whatsapp_webhook_events_type_check
    check (event_type in ('message', 'status')),
  constraint whatsapp_webhook_events_status_check
    check (status in ('received', 'processed', 'ignored', 'failed')),
  constraint whatsapp_webhook_events_hash_check
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint whatsapp_webhook_events_error_length
    check (error_message is null or char_length(error_message) <= 500)
);

create index if not exists idx_whatsapp_webhook_events_company_received
  on public.whatsapp_webhook_events (company_id, received_at desc)
  where company_id is not null;
create index if not exists idx_whatsapp_webhook_events_phone_received
  on public.whatsapp_webhook_events (phone_number_id, received_at desc);
create index if not exists idx_whatsapp_webhook_events_message
  on public.whatsapp_webhook_events (whatsapp_message_id)
  where whatsapp_message_id is not null;

alter table public.whatsapp_webhook_events enable row level security;
revoke all on table public.whatsapp_webhook_events from anon, authenticated;
