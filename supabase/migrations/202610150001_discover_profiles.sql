create or replace function public.list_discoverable_profiles(
  result_limit integer default 25,
  result_offset integer default 0
)
returns table (profile_id uuid, profile jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, public.get_public_profile(p.id)
  from public.profiles p
  where (select auth.uid()) is not null
    and p.id <> (select auth.uid())
    and p.profile_status = 'active'
    and p.is_discoverable
    and not exists (
      select 1
      from public.blocked_users b
      where (b.blocker_id = (select auth.uid()) and b.blocked_user_id = p.id)
         or (b.blocker_id = p.id and b.blocked_user_id = (select auth.uid()))
    )
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(result_limit, 25), 1), 25)
  offset least(greatest(coalesce(result_offset, 0), 0), 5000);
$$;

revoke all on function public.list_discoverable_profiles(integer, integer)
  from public, anon;
grant execute on function public.list_discoverable_profiles(integer, integer)
  to authenticated;
