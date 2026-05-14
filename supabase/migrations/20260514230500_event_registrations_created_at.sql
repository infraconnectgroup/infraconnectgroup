alter table public.event_registrations
add column if not exists created_at timestamptz default now();
