-- XPT: bucket privado para fotos HAND + lacre, compartilhadas apenas com funcionários ativos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('xpt-fotos', 'xpt-fotos', false, 10485760, array['image/jpeg']::text[])
on conflict (id) do update
  set name = excluded.name,
      public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "melinotepad active employees read xpt photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'xpt-fotos'
  and coalesce((public.get_my_employee_context() ->> 'authorized')::boolean, false)
);

create policy "melinotepad active employees upload xpt photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'xpt-fotos'
  and coalesce((public.get_my_employee_context() ->> 'authorized')::boolean, false)
);

create policy "melinotepad active employees update xpt photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'xpt-fotos'
  and coalesce((public.get_my_employee_context() ->> 'authorized')::boolean, false)
)
with check (
  bucket_id = 'xpt-fotos'
  and coalesce((public.get_my_employee_context() ->> 'authorized')::boolean, false)
);

comment on policy "melinotepad active employees read xpt photos" on storage.objects is
  'Leitura de fotos XPT somente por funcionário com vínculo ativo no MeliNotepad.';
comment on policy "melinotepad active employees upload xpt photos" on storage.objects is
  'Upload de fotos XPT somente por funcionário com vínculo ativo no MeliNotepad.';
comment on policy "melinotepad active employees update xpt photos" on storage.objects is
  'Atualização/upsert de fotos XPT somente por funcionário com vínculo ativo no MeliNotepad.';
