-- Validação de configuração do bucket XPT; somente Supabase local.
-- Get-Content -Raw -Encoding UTF8 tests\supabase-photo-storage-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
begin;

do $test$
declare
  v_public boolean;
  v_limit bigint;
  v_mime text[];
  v_select integer;
  v_insert integer;
  v_update integer;
  v_delete integer;
begin
  select public, file_size_limit, allowed_mime_types
    into v_public, v_limit, v_mime
    from storage.buckets where id = 'xpt-fotos';

  if not found then raise exception 'Falha: bucket privado xpt-fotos não foi criado.'; end if;
  if v_public is distinct from false then raise exception 'Falha de segurança: bucket XPT deve ser privado.'; end if;
  if v_limit <> 10485760 then raise exception 'Falha: limite de arquivo do bucket deve ser 10 MiB.'; end if;
  if v_mime is distinct from array['image/jpeg']::text[] then
    raise exception 'Falha: bucket deve aceitar apenas image/jpeg.';
  end if;

  select count(*) filter (where cmd = 'SELECT'),
         count(*) filter (where cmd = 'INSERT'),
         count(*) filter (where cmd = 'UPDATE')
    into v_select, v_insert, v_update
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in (
       'melinotepad active employees read xpt photos',
       'melinotepad active employees upload xpt photos',
       'melinotepad active employees update xpt photos'
     )
     and roles @> array['authenticated']::name[]
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%xpt-fotos%'
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%get_my_employee_context%';

  select count(*) into v_delete
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%xpt-fotos%';

  if v_select <> 1 or v_insert <> 1 or v_update <> 1 or v_delete <> 0 then
    raise exception 'Falha: políticas do bucket devem permitir SELECT/INSERT/UPDATE autenticados ativos, sem política DELETE.';
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'melinotepad active employees % xpt photos'
       and (roles @> array['anon']::name[] or roles @> array['public']::name[])
  ) then
    raise exception 'Falha de segurança: políticas de fotos não podem incluir anon/public.';
  end if;

  raise notice 'OK: bucket privado, MIME/limite corretos, acesso somente a funcionários ativos e sem política de exclusão.';
end
$test$;

rollback;
