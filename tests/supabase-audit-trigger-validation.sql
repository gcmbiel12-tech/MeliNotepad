-- Validação transacional dos triggers de autoria e auditoria; somente Supabase local.
-- Get-Content -Raw -Encoding UTF8 tests\supabase-audit-trigger-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
begin;

do $test$
declare
  v_actor constant uuid := '10000000-0000-4000-8000-000000000011';
  v_operation uuid;
  v_created_by uuid;
  v_updated_by uuid;
  v_version integer;
  v_created_event integer;
  v_updated_event integer;
  v_deleted_event integer;
  v_old_updated_at timestamptz;
  v_new_updated_at timestamptz;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_actor, 'authenticated', 'authenticated', 'audit-trigger-test@melinotepad.invalid',
    '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.xpt_operations (started_at, operational_date, created_by, updated_by)
  values (clock_timestamp(), current_date, '10000000-0000-4000-8000-000000000099',
          '10000000-0000-4000-8000-000000000099')
  returning id, updated_at into v_operation, v_old_updated_at;

  select created_by, updated_by into v_created_by, v_updated_by
    from public.xpt_operations where id = v_operation;
  if v_created_by <> v_actor or v_updated_by <> v_actor then
    raise exception 'Falha: autoria de criação/atualização foi aceita do cliente em vez do JWT.';
  end if;

  update public.xpt_operations
     set package_qty = 7,
         updated_by = '10000000-0000-4000-8000-000000000099'
   where id = v_operation;

  select version, updated_at, updated_by
    into v_version, v_new_updated_at, v_updated_by
    from public.xpt_operations where id = v_operation;
  if v_version <> 2 then raise exception 'Falha: versão não incrementou automaticamente.'; end if;
  if v_updated_by <> v_actor then raise exception 'Falha: updated_by não foi derivado do JWT.'; end if;
  if v_new_updated_at < v_old_updated_at then raise exception 'Falha: updated_at retrocedeu.'; end if;

  select count(*) into v_created_event
    from public.audit_events
   where entity_type = 'xpt_operations' and entity_id = v_operation
     and action = 'INSERT' and actor_id = v_actor and source = 'application'
     and before_data is null and after_data ->> 'package_qty' is null;

  select count(*) into v_updated_event
    from public.audit_events
   where entity_type = 'xpt_operations' and entity_id = v_operation
     and action = 'UPDATE' and actor_id = v_actor and source = 'application'
     and before_data ->> 'package_qty' is null and after_data ->> 'package_qty' = '7';

  if v_created_event <> 1 or v_updated_event <> 1 then
    raise exception 'Falha: eventos INSERT/UPDATE ou snapshots antes/depois estão incorretos.';
  end if;

  delete from public.xpt_operations where id = v_operation;
  select count(*) into v_deleted_event
    from public.audit_events
   where entity_type = 'xpt_operations' and entity_id = v_operation
     and action = 'DELETE' and actor_id = v_actor and source = 'application'
     and before_data ->> 'package_qty' = '7' and after_data is null;
  if v_deleted_event <> 1 then raise exception 'Falha: evento DELETE não foi preservado.'; end if;

  if has_table_privilege('authenticated', 'public.audit_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.audit_events', 'INSERT')
     or has_table_privilege('anon', 'public.audit_events', 'SELECT') then
    raise exception 'Falha de segurança: trilha de auditoria acessível diretamente.';
  end if;

  raise notice 'OK: autoria do JWT, updated_at, incremento de versão, auditoria antes/depois e trilha fechada.';
end
$test$;

rollback;
