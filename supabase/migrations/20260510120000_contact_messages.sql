-- Contactformulier: berichten landen in deze tabel (in te zien in Supabase Table Editor).
-- Toepassen: Supabase Dashboard → SQL → plakken en runnen, of: supabase db push

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  message text not null,
  constraint contact_messages_name_len check (char_length(trim(name)) between 1 and 200),
  constraint contact_messages_email_len check (char_length(trim(email)) between 3 and 320),
  constraint contact_messages_message_len check (char_length(trim(message)) between 1 and 4000)
);

comment on table public.contact_messages is 'Website contactformulier; alleen inserts vanaf de publieke site.';

alter table public.contact_messages enable row level security;

drop policy if exists "contact_messages_insert_anon" on public.contact_messages;
create policy "contact_messages_insert_anon"
  on public.contact_messages
  for insert
  to anon
  with check (true);

drop policy if exists "contact_messages_insert_authenticated" on public.contact_messages;
create policy "contact_messages_insert_authenticated"
  on public.contact_messages
  for insert
  to authenticated
  with check (true);

grant insert on table public.contact_messages to anon, authenticated;
