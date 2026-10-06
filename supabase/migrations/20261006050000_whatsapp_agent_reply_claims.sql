-- Respostas automáticas do agente no WhatsApp.
-- 1) whatsapp_messages aceita o status 'pending' (resposta reservada, ainda não enviada).
-- 2) reply_to_message_id liga a resposta outbound à mensagem inbound que a originou.
-- 3) Índice único parcial: cada mensagem recebida tem no máximo UMA resposta outbound.
--    O INSERT da reserva é o "claim" atômico que impede resposta duplicada, mesmo com
--    reenvio da Meta ou processamento concorrente.
-- 4) Trigger valida que o alvo é inbound, da mesma conversa e da mesma empresa.
-- Não altera RLS, grants nem policies existentes: a escrita continua só pela service_role.

alter table public.whatsapp_messages
  drop constraint if exists whatsapp_messages_status_check;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_status_check
  check (status in ('received', 'pending', 'sent', 'delivered', 'read', 'failed'));

alter table public.whatsapp_messages
  add column if not exists reply_to_message_id uuid
  references public.whatsapp_messages (id) on delete set null;

create unique index if not exists idx_whatsapp_messages_reply_to_outbound
  on public.whatsapp_messages (reply_to_message_id)
  where direction = 'outbound' and reply_to_message_id is not null;

create or replace function public.validate_whatsapp_message_reply()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target record;
begin
  if new.reply_to_message_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.reply_to_message_id is distinct from old.reply_to_message_id then
      raise exception 'whatsapp_message_reply_immutable' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.direction <> 'outbound' then
    raise exception 'whatsapp_message_reply_requires_outbound' using errcode = 'P0001';
  end if;

  select m.direction, m.conversation_id, m.company_id
    into target
    from public.whatsapp_messages m
   where m.id = new.reply_to_message_id;

  if not found
     or target.direction <> 'inbound'
     or target.conversation_id <> new.conversation_id
     or target.company_id <> new.company_id then
    raise exception 'whatsapp_message_reply_target_mismatch' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_whatsapp_message_reply() from public, anon, authenticated;

drop trigger if exists whatsapp_messages_validate_reply on public.whatsapp_messages;
create trigger whatsapp_messages_validate_reply
  before insert or update of reply_to_message_id on public.whatsapp_messages
  for each row execute function public.validate_whatsapp_message_reply();
