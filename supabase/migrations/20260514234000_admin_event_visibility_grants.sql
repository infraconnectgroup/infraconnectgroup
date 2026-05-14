-- Ensure admin can read event registrations + member profiles, and that
-- every authenticated user can read their own roles (so useAuth resolves
-- the admin role on the client).

grant usage on schema public to authenticated;
grant select on public.event_registrations to authenticated;
grant select on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.events to authenticated, anon;

alter table public.event_registrations enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists "Users can read own roles" on public.user_roles;
create policy "Users can read own roles"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role::text = _role
  )
$$;

grant execute on function public.has_role(uuid, text) to authenticated, anon;

drop policy if exists "Admins view all event registrations" on public.event_registrations;
create policy "Admins view all event registrations"
  on public.event_registrations
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users see own event registrations" on public.event_registrations;
create policy "Users see own event registrations"
  on public.event_registrations
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users insert own event registrations" on public.event_registrations;
create policy "Users insert own event registrations"
  on public.event_registrations
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users delete own event registrations" on public.event_registrations;
create policy "Users delete own event registrations"
  on public.event_registrations
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins view profiles" on public.profiles;
create policy "Admins view profiles"
  on public.profiles
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users view own profile" on public.profiles;
create policy "Users view own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());
