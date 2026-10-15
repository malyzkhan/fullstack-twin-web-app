create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  check (user_low < user_high),
  unique (user_low, user_high)
);

create table if not exists public.chat_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  pair_low uuid generated always as (least(requester_id, recipient_id)) stored,
  pair_high uuid generated always as (greatest(requester_id, recipient_id)) stored,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id),
  unique (pair_low, pair_high)
);

create table if not exists public.chat_members (
  conversation_id uuid not null
    references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.chat_conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  client_message_id uuid not null,
  body text not null
    check (
      char_length(body) between 1 and 2000
      and body ~ '[^[:space:]]'
    ),
  created_at timestamptz not null default now(),
  unique (conversation_id, sender_id, client_message_id)
);

create index if not exists chat_conversations_activity_idx
  on public.chat_conversations (last_activity_at desc, id);
create index if not exists chat_requests_incoming_idx
  on public.chat_requests (recipient_id, created_at desc)
  where status = 'pending';
create index if not exists chat_requests_outgoing_idx
  on public.chat_requests (requester_id, created_at desc);
create index if not exists chat_members_user_idx
  on public.chat_members (user_id, conversation_id);
create index if not exists chat_messages_conversation_order_idx
  on public.chat_messages (conversation_id, created_at desc, id desc);
create index if not exists chat_messages_sender_rate_idx
  on public.chat_messages (sender_id, created_at desc);

alter table public.chat_conversations enable row level security;
alter table public.chat_requests enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

create or replace function public.can_access_chat_conversation(
  target_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.chat_conversations c
      join public.chat_members m
        on m.conversation_id = c.id
       and m.user_id = (select auth.uid())
      where c.id = target_conversation_id
        and not exists (
          select 1
          from public.blocked_users b
          where (b.blocker_id = c.user_low and b.blocked_user_id = c.user_high)
             or (b.blocker_id = c.user_high and b.blocked_user_id = c.user_low)
        )
    );
$$;

create or replace function public.can_access_chat_request(
  target_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.chat_requests r
      where r.id = target_request_id
        and (r.requester_id = (select auth.uid())
          or r.recipient_id = (select auth.uid()))
        and not exists (
          select 1
          from public.blocked_users b
          where (b.blocker_id = r.requester_id and b.blocked_user_id = r.recipient_id)
             or (b.blocker_id = r.recipient_id and b.blocked_user_id = r.requester_id)
        )
    );
$$;

revoke all on function public.can_access_chat_conversation(uuid)
  from public, anon;
grant execute on function public.can_access_chat_conversation(uuid)
  to authenticated;
revoke all on function public.can_access_chat_request(uuid)
  from public, anon;
grant execute on function public.can_access_chat_request(uuid)
  to authenticated;

create or replace function public.lock_chat_pair_for_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_user_id uuid;
  second_user_id uuid;
begin
  if tg_op = 'DELETE' then
    first_user_id := old.blocker_id;
    second_user_id := old.blocked_user_id;
  else
    first_user_id := new.blocker_id;
    second_user_id := new.blocked_user_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(first_user_id, second_user_id)::text || ':' ||
      greatest(first_user_id, second_user_id)::text,
      0
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists blocked_users_lock_chat_pair on public.blocked_users;
create trigger blocked_users_lock_chat_pair
  before insert or delete on public.blocked_users
  for each row execute function public.lock_chat_pair_for_block();

revoke all on function public.lock_chat_pair_for_block()
  from public, anon, authenticated;

create or replace function public.decline_chat_requests_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_requests
  set status = 'declined', updated_at = now()
  where status = 'pending'
    and pair_low = least(new.blocker_id, new.blocked_user_id)
    and pair_high = greatest(new.blocker_id, new.blocked_user_id);
  return new;
end;
$$;

drop trigger if exists blocked_users_decline_chat_requests on public.blocked_users;
create trigger blocked_users_decline_chat_requests
  after insert on public.blocked_users
  for each row execute function public.decline_chat_requests_on_block();

revoke all on function public.decline_chat_requests_on_block()
  from public, anon, authenticated;

drop policy if exists "Members can read unblocked conversations"
  on public.chat_conversations;
create policy "Members can read unblocked conversations"
  on public.chat_conversations for select to authenticated
  using (public.can_access_chat_conversation(id));

drop policy if exists "Users can read only their own chat membership"
  on public.chat_members;
create policy "Users can read only their own chat membership"
  on public.chat_members for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Participants can read unblocked chat requests"
  on public.chat_requests;
create policy "Participants can read unblocked chat requests"
  on public.chat_requests for select to authenticated
  using (public.can_access_chat_request(id));

drop policy if exists "Members can read unblocked conversation messages"
  on public.chat_messages;
create policy "Members can read unblocked conversation messages"
  on public.chat_messages for select to authenticated
  using (public.can_access_chat_conversation(conversation_id));

revoke all on public.chat_conversations from anon, authenticated;
revoke all on public.chat_requests from anon, authenticated;
revoke all on public.chat_members from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_conversations to authenticated;
grant select on public.chat_requests to authenticated;
grant select on public.chat_members to authenticated;
grant select on public.chat_messages to authenticated;

create or replace function public.get_chat_request_status(target_user_id uuid)
returns table (
  request_status text,
  request_id uuid,
  conversation_id uuid,
  request_direction text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_request public.chat_requests%rowtype;
  has_existing_request boolean;
begin
  if current_user_id is null
    or target_user_id is null
    or target_user_id = current_user_id then
    return query select 'unavailable'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if exists (
    select 1
    from public.blocked_users b
    where (b.blocker_id = current_user_id and b.blocked_user_id = target_user_id)
       or (b.blocker_id = target_user_id and b.blocked_user_id = current_user_id)
  ) then
    return query select 'unavailable'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  select r.* into existing_request
  from public.chat_requests r
  where r.pair_low = least(current_user_id, target_user_id)
    and r.pair_high = greatest(current_user_id, target_user_id);
  has_existing_request := found;

  if has_existing_request and existing_request.status = 'accepted' then
    return query
      select 'accepted'::text, existing_request.id, c.id, null::text
      from public.chat_conversations c
      where c.user_low = least(current_user_id, target_user_id)
        and c.user_high = greatest(current_user_id, target_user_id);
    return;
  end if;

  if has_existing_request and existing_request.status = 'pending' then
    return query
      select
        'pending'::text,
        existing_request.id,
        null::uuid,
        case when existing_request.requester_id = current_user_id
          then 'outgoing' else 'incoming' end;
    return;
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = target_user_id
      and p.profile_status = 'active'
      and p.is_discoverable
  ) or not exists (
    select 1 from public.profiles p
    where p.id = current_user_id
      and p.profile_status = 'active'
      and p.is_discoverable
  ) then
    return query select 'unavailable'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  return query
    select
      case when has_existing_request then 'declined' else 'none' end,
      case when has_existing_request then existing_request.id else null::uuid end,
      null::uuid,
      case when has_existing_request and existing_request.requester_id = current_user_id
        then 'outgoing'
        when has_existing_request then 'incoming'
        else null::text end;
end;
$$;

create or replace function public.create_chat_request(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_request public.chat_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'This person cannot receive a chat request.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(
      least(current_user_id, target_user_id)::text || ':' ||
      greatest(current_user_id, target_user_id)::text,
      0
    )
  );
  if exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = current_user_id and b.blocked_user_id = target_user_id)
       or (b.blocker_id = target_user_id and b.blocked_user_id = current_user_id)
  ) then
    raise exception 'Chat requests are unavailable.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = current_user_id
      and p.profile_status = 'active'
      and p.is_discoverable
  ) or not exists (
    select 1 from public.profiles p
    where p.id = target_user_id
      and p.profile_status = 'active'
      and p.is_discoverable
  ) then
    raise exception 'Both profiles must be active and discoverable.' using errcode = '42501';
  end if;

  select r.* into existing_request
  from public.chat_requests r
  where r.pair_low = least(current_user_id, target_user_id)
    and r.pair_high = greatest(current_user_id, target_user_id)
  for update;

  if found then
    if existing_request.status = 'accepted'
      or existing_request.status = 'pending' then
      return existing_request.id;
    end if;

    update public.chat_requests
    set requester_id = current_user_id,
        recipient_id = target_user_id,
        status = 'pending',
        created_at = now(),
        updated_at = now()
    where id = existing_request.id
    returning * into existing_request;
    return existing_request.id;
  end if;

  insert into public.chat_requests (requester_id, recipient_id)
  values (current_user_id, target_user_id)
  on conflict (pair_low, pair_high) do update
    set updated_at = public.chat_requests.updated_at
  returning * into existing_request;
  return existing_request.id;
end;
$$;

create or replace function public.accept_chat_request(target_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  selected_request public.chat_requests%rowtype;
  new_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select r.* into selected_request
  from public.chat_requests r
  where r.id = target_request_id
    and r.recipient_id = current_user_id
    and r.status = 'pending';
  if not found then
    raise exception 'This chat request is no longer available.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(selected_request.requester_id, selected_request.recipient_id)::text || ':' ||
      greatest(selected_request.requester_id, selected_request.recipient_id)::text,
      0
    )
  );

  select r.* into selected_request
  from public.chat_requests r
  where r.id = target_request_id
    and r.recipient_id = current_user_id
    and r.status = 'pending'
  for update;
  if not found then
    raise exception 'This chat request is no longer available.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = selected_request.requester_id
      and b.blocked_user_id = selected_request.recipient_id)
       or (b.blocker_id = selected_request.recipient_id
      and b.blocked_user_id = selected_request.requester_id)
  ) then
    raise exception 'This chat request is no longer available.' using errcode = '42501';
  end if;

  insert into public.chat_conversations (user_low, user_high)
  values (
    least(selected_request.requester_id, selected_request.recipient_id),
    greatest(selected_request.requester_id, selected_request.recipient_id)
  )
  on conflict (user_low, user_high) do update
    set last_activity_at = public.chat_conversations.last_activity_at
  returning id into new_conversation_id;

  insert into public.chat_members (conversation_id, user_id)
  values
    (new_conversation_id, selected_request.requester_id),
    (new_conversation_id, selected_request.recipient_id)
  on conflict (conversation_id, user_id) do nothing;

  update public.chat_requests
  set status = 'accepted', updated_at = now()
  where id = selected_request.id;

  return new_conversation_id;
end;
$$;

create or replace function public.decline_chat_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.chat_requests
  set status = 'declined', updated_at = now()
  where id = target_request_id
    and recipient_id = current_user_id
    and status = 'pending'
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = requester_id and b.blocked_user_id = recipient_id)
         or (b.blocker_id = recipient_id and b.blocked_user_id = requester_id)
    );
  if not found then
    raise exception 'This chat request is no longer available.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.list_incoming_chat_requests()
returns table (
  request_id uuid,
  requester_id uuid,
  profile jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.requester_id,
    coalesce(
      public.get_public_profile(r.requester_id),
      jsonb_build_object(
        'display_name', 'Twin member',
        'age', null,
        'city', null,
        'headline', null,
        'photos', '[]'::jsonb
      )
    ),
    r.created_at
  from public.chat_requests r
  where r.recipient_id = (select auth.uid())
    and r.status = 'pending'
    and (select auth.uid()) is not null
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = r.requester_id and b.blocked_user_id = r.recipient_id)
         or (b.blocker_id = r.recipient_id and b.blocked_user_id = r.requester_id)
    )
  order by r.created_at desc
  limit 100;
$$;

create or replace function public.list_my_chat_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  profile jsonb,
  latest_message_body text,
  latest_message_created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    other_user.id,
    coalesce(
      public.get_public_profile(other_user.id),
      jsonb_build_object(
        'display_name', 'Twin member',
        'age', null,
        'city', null,
        'headline', null,
        'photos', '[]'::jsonb
      )
    ),
    latest.body,
    latest.created_at
  from public.chat_conversations c
  join public.chat_members mine
    on mine.conversation_id = c.id
   and mine.user_id = (select auth.uid())
  join public.chat_members other_member
    on other_member.conversation_id = c.id
   and other_member.user_id <> (select auth.uid())
  join auth.users other_user on other_user.id = other_member.user_id
  left join lateral (
    select m.body, m.created_at
    from public.chat_messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  where (select auth.uid()) is not null
    and not exists (
      select 1
      from public.blocked_users b
      where (b.blocker_id = c.user_low and b.blocked_user_id = c.user_high)
         or (b.blocker_id = c.user_high and b.blocked_user_id = c.user_low)
    )
  order by c.last_activity_at desc, c.id desc
  limit 200;
$$;

create or replace function public.get_chat_conversation(
  target_conversation_id uuid
)
returns table (
  conversation_id uuid,
  other_user_id uuid,
  profile jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    other_member.user_id,
    coalesce(
      public.get_public_profile(other_member.user_id),
      jsonb_build_object(
        'display_name', 'Twin member',
        'age', null,
        'city', null,
        'headline', null,
        'photos', '[]'::jsonb
      )
    )
  from public.chat_conversations c
  join public.chat_members other_member
    on other_member.conversation_id = c.id
   and other_member.user_id <> (select auth.uid())
  where c.id = target_conversation_id
    and (select auth.uid()) is not null
    and public.can_access_chat_conversation(c.id);
$$;

create or replace function public.get_chat_messages(
  target_conversation_id uuid,
  before_created_at timestamptz default null,
  before_message_id uuid default null,
  result_limit integer default 31
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz,
  client_message_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if (before_created_at is null) <> (before_message_id is null) then
    raise exception 'Invalid message cursor.' using errcode = '22023';
  end if;
  if not public.can_access_chat_conversation(target_conversation_id) then
    raise exception 'Conversation unavailable.' using errcode = '42501';
  end if;

  return query
    select m.id, m.conversation_id, m.sender_id, m.body, m.created_at, m.client_message_id
    from public.chat_messages m
    where m.conversation_id = target_conversation_id
      and (
        before_created_at is null
        or (m.created_at, m.id) < (before_created_at, before_message_id)
      )
    order by m.created_at desc, m.id desc
    limit least(greatest(coalesce(result_limit, 31), 1), 31);
end;
$$;

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
  on conflict (conversation_id, sender_id, client_message_id) do nothing
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

create or replace function public.update_chat_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_conversations
  set last_activity_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_update_activity on public.chat_messages;
create trigger chat_messages_update_activity
  after insert on public.chat_messages
  for each row execute function public.update_chat_activity();

revoke all on function public.get_chat_request_status(uuid)
  from public, anon;
grant execute on function public.get_chat_request_status(uuid)
  to authenticated;
revoke all on function public.create_chat_request(uuid)
  from public, anon;
grant execute on function public.create_chat_request(uuid)
  to authenticated;
revoke all on function public.accept_chat_request(uuid)
  from public, anon;
grant execute on function public.accept_chat_request(uuid)
  to authenticated;
revoke all on function public.decline_chat_request(uuid)
  from public, anon;
grant execute on function public.decline_chat_request(uuid)
  to authenticated;
revoke all on function public.list_incoming_chat_requests()
  from public, anon;
grant execute on function public.list_incoming_chat_requests()
  to authenticated;
revoke all on function public.list_my_chat_conversations()
  from public, anon;
grant execute on function public.list_my_chat_conversations()
  to authenticated;
revoke all on function public.get_chat_conversation(uuid)
  from public, anon;
grant execute on function public.get_chat_conversation(uuid)
  to authenticated;
revoke all on function public.get_chat_messages(uuid, timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.get_chat_messages(uuid, timestamptz, uuid, integer)
  to authenticated;
revoke all on function public.send_chat_message(uuid, text, uuid)
  from public, anon;
grant execute on function public.send_chat_message(uuid, text, uuid)
  to authenticated;
revoke all on function public.update_chat_activity()
  from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;
