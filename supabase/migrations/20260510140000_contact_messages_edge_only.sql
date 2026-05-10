-- Contactformulier: alleen Edge Function (service role) mag rijen toevoegen.
-- Voer dit uit na deploy van `contact-submit` en na het instellen van Resend-secrets.

revoke insert on table public.contact_messages from anon, authenticated;

drop policy if exists "contact_messages_insert_anon" on public.contact_messages;
drop policy if exists "contact_messages_insert_authenticated" on public.contact_messages;
