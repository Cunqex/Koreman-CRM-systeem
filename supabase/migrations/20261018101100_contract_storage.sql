-- Fase 7 — Private bucket voor contract-PDF's.
--
-- De documents-bucket leest de architect uit de eerste map van het pad en kan
-- contracten dus niet huisvesten. Die krijgen een eigen bucket met de agent
-- als eerste map: <agent_id>/<uuid>-<bestandsnaam>.pdf

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contracts',
  'contracts',
  false,
  20971520, -- 20 MB
  array['application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Veilig de agent-id uit het pad halen; null bij een pad dat niet met een
-- uuid-map begint, zodat de policy dan niets toestaat.
create or replace function public.storage_agent_id(p_name text)
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

grant execute on function public.storage_agent_id(text) to authenticated;

-- Een agent leest zijn eigen contract en dat van zijn subagenten.
create policy contracts_bucket_select on storage.objects
for select to authenticated
using (
  bucket_id = 'contracts'
  and public.storage_agent_id(name) in (select public.visible_agent_ids())
);

-- Alleen Koreman beheert contractbestanden.
create policy contracts_bucket_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'contracts' and public.is_admin());

create policy contracts_bucket_update on storage.objects
for update to authenticated
using (bucket_id = 'contracts' and public.is_admin())
with check (bucket_id = 'contracts' and public.is_admin());

create policy contracts_bucket_delete on storage.objects
for delete to authenticated
using (bucket_id = 'contracts' and public.is_admin());
