-- Fase 2 — Private Storage-bucket voor documenten.
--
-- Padafspraak: <architect_id>/<uuid>-<bestandsnaam>
-- De eerste map bepaalt bij wie het bestand hoort, zodat de Storage-policies
-- exact dezelfde zichtbaarheid kunnen afdwingen als de architect-tabel.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/tiff',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel',
    'text/plain',
    'application/zip',
    'image/vnd.dwg',
    'application/acad'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Veilig de architect-id uit het pad halen; geeft null bij een pad dat niet
-- met een uuid-map begint, zodat de policy dan simpelweg niets toestaat.
create or replace function public.storage_architect_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_first text;
begin
  v_first := split_part(coalesce(p_name, ''), '/', 1);
  if v_first !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return v_first::uuid;
end;
$$;

grant execute on function public.storage_architect_id(text) to authenticated;

create policy documents_bucket_select on storage.objects
for select to authenticated
using (
  bucket_id = 'documents'
  and public.can_see_architect(public.storage_architect_id(name))
);

create policy documents_bucket_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documents'
  and public.can_edit_architect(public.storage_architect_id(name))
);

create policy documents_bucket_update on storage.objects
for update to authenticated
using (
  bucket_id = 'documents'
  and public.can_edit_architect(public.storage_architect_id(name))
)
with check (
  bucket_id = 'documents'
  and public.can_edit_architect(public.storage_architect_id(name))
);

-- Verwijderen van bewijsstukken is voorbehouden aan Koreman.
create policy documents_bucket_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'documents'
  and public.is_admin()
);
