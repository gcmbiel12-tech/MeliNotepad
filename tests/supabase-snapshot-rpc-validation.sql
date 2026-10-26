-- Validação transacional de snapshots versionados; executar somente no Supabase local.
-- Get-Content -Raw -Encoding UTF8 tests\supabase-snapshot-rpc-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
begin;

do $test$
declare
  v_actor constant uuid := '10000000-0000-4000-8000-000000000031';
  v_employee uuid;
  v_result jsonb;
  v_loaded jsonb;
  v_conflict boolean;
  v_invalid boolean;
  v_count integer;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_actor, 'authenticated', 'authenticated', 'snapshot-test@melinotepad.invalid',
    '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.employees (employee_code, full_name)
  values ('0000031', 'Funcionário Snapshot')
  returning id into v_employee;
  insert into public.employee_accounts
    (employee_id, auth_user_id, status, access_role, is_primary_admin, activated_at)
  values (v_employee, v_actor, 'active', 'operator', false, now());

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_loaded := public.get_module_snapshot('nex');
  if (v_loaded ->> 'version')::integer <> 0 or v_loaded -> 'payload' <> 'null'::jsonb then
    raise exception 'Falha: módulo novo deveria retornar versão zero e payload nulo.';
  end if;

  v_result := public.save_module_snapshot('nex', 0, '{"versao":1,"currentSession":null,"history":[]}'::jsonb);
  if (v_result ->> 'version')::integer <> 1 then raise exception 'Falha: primeira gravação NEX não gerou versão 1.'; end if;

  v_loaded := public.get_module_snapshot('nex');
  if (v_loaded ->> 'version')::integer <> 1
     or v_loaded #>> '{payload,versao}' <> '1'
     or jsonb_typeof(v_loaded #> '{payload,history}') <> 'array' then
    raise exception 'Falha: leitura do snapshot NEX inconsistente.';
  end if;

  v_result := public.save_module_snapshot('nex', 1, '{"versao":1,"currentSession":null,"history":[{"id":"session-1"}]}'::jsonb);
  if (v_result ->> 'version')::integer <> 2 then raise exception 'Falha: atualização NEX não incrementou versão.'; end if;

  v_conflict := false;
  begin
    perform public.save_module_snapshot('nex', 1, '{"versao":1,"currentSession":null,"history":[]}'::jsonb);
  exception when serialization_failure then
    v_conflict := true;
  end;
  if not v_conflict then raise exception 'Falha: versão antiga foi aceita e poderia sobrescrever dados novos.'; end if;

  v_invalid := false;
  begin
    perform public.save_module_snapshot('nex', 2, '{"currentSession":null,"history":[]}'::jsonb);
  exception when sqlstate '22023' then
    v_invalid := true;
  end;
  if not v_invalid then raise exception 'Falha: payload NEX sem versão foi aceito.'; end if;

  v_result := public.save_module_snapshot('xpt', 0, '{"versao":1,"rev":0,"operacoes":[]}'::jsonb);
  if (v_result ->> 'version')::integer <> 1 then raise exception 'Falha: snapshot XPT não foi criado.'; end if;

  v_result := public.save_module_snapshot('intervalos', 0,
    '{"versao":1,"rev":0,"funcionarios":[],"intervalos":[],"setores":["NEX","XPT"]}'::jsonb);
  if (v_result ->> 'version')::integer <> 1 then raise exception 'Falha: snapshot Intervalos não foi criado.'; end if;

  select count(*) into v_count
    from public.audit_events
   where entity_type = 'module_snapshots'
     and entity_legacy_id = 'nex'
     and actor_id = v_actor
     and source = 'application'
     and action in ('INSERT', 'UPDATE')
     and after_data ? 'payload_md5'
     and not (after_data ? 'payload');
  if v_count <> 2 then raise exception 'Falha: auditoria de snapshots deve guardar hashes/metadados, não cópias do payload.'; end if;

  if not (select relrowsecurity from pg_class where oid = 'public.module_snapshots'::regclass)
     or has_table_privilege('anon', 'public.module_snapshots', 'SELECT')
     or has_table_privilege('authenticated', 'public.module_snapshots', 'SELECT')
     or has_table_privilege('authenticated', 'public.module_snapshots', 'INSERT')
     or has_table_privilege('service_role', 'public.module_snapshots', 'SELECT')
     or not has_function_privilege('authenticated', 'public.get_module_snapshot(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.save_module_snapshot(text,integer,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_module_snapshot(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_module_snapshot(text,integer,jsonb)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.get_module_snapshot(text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.save_module_snapshot(text,integer,jsonb)', 'EXECUTE') then
    raise exception 'Falha de segurança: grants/RLS de snapshots incorretos.';
  end if;

  raise notice 'OK: snapshots NEX/XPT/Intervalos, versionamento otimista, conflito, validação do payload, auditoria por hash e isolamento.';
end
$test$;

rollback;
