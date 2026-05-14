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

alter table public.event_registrations enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Admins view all event registrations" on public.event_registrations;
create policy "Admins view all event registrations"
  on public.event_registrations
  as permissive
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins view profile names for events" on public.profiles;
create policy "Admins view profile names for events"
  on public.profiles
  as permissive
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
