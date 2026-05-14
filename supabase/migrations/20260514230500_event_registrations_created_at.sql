alter table public.event_registrations
add column if not exists created_at timestamptz default now();

update public.event_registrations
set created_at = now()
where created_at is null;

alter table public.event_registrations
alter column created_at set default now();

alter table public.event_registrations
alter column created_at set not null;
