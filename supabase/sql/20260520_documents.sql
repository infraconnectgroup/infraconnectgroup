-- Documents feature: table + storage bucket + RLS
-- Toepassen via Supabase Dashboard SQL editor of `supabase db push`.

-- Hergebruikt de bestaande public.is_admin(uuid) functie (parameter heet _user_id).
-- Niet opnieuw aanmaken — andere policies hangen er al aan.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  is_public boolean not null default false,
  member_id uuid references auth.users(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint documents_title_len check (char_length(trim(title)) between 1 and 200),
  constraint documents_visibility_chk check (
    (is_public = true and member_id is null)
    or (is_public = false and member_id is not null)
  )
);

create index if not exists documents_member_id_idx on public.documents(member_id);
create index if not exists documents_is_public_idx on public.documents(is_public);
create index if not exists documents_created_at_idx on public.documents(created_at desc);

alter table public.documents enable row level security;

drop policy if exists "documents_select" on public.documents;
create policy "documents_select" on public.documents
  for select to authenticated
  using (
    public.is_admin(auth.uid())
    or is_public = true
    or member_id = auth.uid()
  );

drop policy if exists "documents_admin_insert" on public.documents;
create policy "documents_admin_insert" on public.documents
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "documents_admin_update" on public.documents;
create policy "documents_admin_update" on public.documents
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "documents_admin_delete" on public.documents;
create policy "documents_admin_delete" on public.documents
  for delete to authenticated
  using (public.is_admin(auth.uid()));

insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

-- Paden:
--   public/<uuid>-<bestandsnaam>
--   private/<member_id>/<uuid>-<bestandsnaam>
drop policy if exists "documents_obj_select" on storage.objects;
create policy "documents_obj_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents' and (
      public.is_admin(auth.uid())
      or (storage.foldername(name))[1] = 'public'
      or (
        (storage.foldername(name))[1] = 'private'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists "documents_obj_admin_insert" on storage.objects;
create policy "documents_obj_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.is_admin(auth.uid()));

drop policy if exists "documents_obj_admin_update" on storage.objects;
create policy "documents_obj_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.is_admin(auth.uid()))
  with check (bucket_id = 'documents' and public.is_admin(auth.uid()));

drop policy if exists "documents_obj_admin_delete" on storage.objects;
create policy "documents_obj_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin(auth.uid()));

-- Rechten voor authenticated rol
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
