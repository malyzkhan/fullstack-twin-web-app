create or replace function public.send_chat_message(
  target_conversation_id uuid,
  message_body text,
  client_message_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  pair_low uuid;
  pair_high uuid;
  existing_message public.chat_messages%rowtype;
  new_message_id uuid;
  recent_message_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if message_body is null
    or char_length(message_body) > 2000
    or btrim(message_body) = ''
    or message_body !~ '[^[:space:]]'
    or client_message_id is null then
    raise exception 'Message must contain 1 to 2000 non-whitespace characters.'
      using errcode = '22023';
  end if;
  select c.user_low, c.user_high
    into pair_low, pair_high
  from public.chat_conversations c
  join public.chat_members m
    on m.conversation_id = c.id
   and m.user_id = current_user_id
  where c.id = target_conversation_id;
  if not found then
    raise exception 'Conversation unavailable.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(pair_low::text || ':' || pair_high::text, 0)
  );
  if not public.can_access_chat_conversation(target_conversation_id) then
    raise exception 'Conversation unavailable.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  select m.* into existing_message
  from public.chat_messages m
  where m.conversation_id = target_conversation_id
    and m.sender_id = current_user_id
    and m.client_message_id = send_chat_message.client_message_id;
  if found then
    if existing_message.body <> btrim(message_body) then
      raise exception 'Message retry did not match the original message.'
        using errcode = '22023';
    end if;
    return existing_message.id;
  end if;

  select count(*) into recent_message_count
  from public.chat_messages m
  where m.sender_id = current_user_id
    and m.created_at > now() - interval '1 minute';
  if recent_message_count >= 30 then
    raise exception 'Message rate limit reached.' using errcode = 'P0001';
  end if;

  insert into public.chat_messages (
    conversation_id, sender_id, client_message_id, body
  )
  values (
    target_conversation_id,
    current_user_id,
    send_chat_message.client_message_id,
    btrim(message_body)
  )
  on conflict on constraint
    chat_messages_conversation_id_sender_id_client_message_id_key
    do nothing
  returning id into new_message_id;

  if new_message_id is null then
    select m.id, m.body into new_message_id, existing_message.body
    from public.chat_messages m
    where m.conversation_id = target_conversation_id
      and m.sender_id = current_user_id
      and m.client_message_id = send_chat_message.client_message_id;
    if existing_message.body <> btrim(message_body) then
      raise exception 'Message retry did not match the original message.'
        using errcode = '22023';
    end if;
    return new_message_id;
  end if;
  return new_message_id;
end;
$$;

revoke all on function public.send_chat_message(uuid, text, uuid)
  from public, anon;
grant execute on function public.send_chat_message(uuid, text, uuid)
  to authenticated;
