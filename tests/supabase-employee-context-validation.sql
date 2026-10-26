-- Validação transacional do contexto autenticado; somente Supabase local.
-- Get-Content -Raw -Encoding UTF8 tests\supabase-employee-context-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
begin;

do $test$
declare
  v_actor constant uuid := '10000000-0000-4000-8000-000000000021';
  v_employee uuid;
  v_account uuid;
  v_context jsonb;
  v_denied boolean;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_actor, 'authenticated', 'authenticated', 'employee-context-test@melinotepad.invalid',
    '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

  insert into public.employees (employee_code, full_name)
  values ('0000021', 'Funcionário de Teste')
  returning id into v_employee;

  insert into public.employee_accounts
    (employee_id, auth_user_id, status, access_role, is_primary_admin, activated_at)
  values (v_employee, v_actor, 'active', 'operator', false, now())
  returning id into v_account;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_context := public.get_my_employee_context();
  if coalesce((v_context ->> 'authorized')::boolean, false) is not true
     or v_context ->> 'employeeCode' <> '0000021'
     or v_context ->> 'fullName' <> 'Funcionário de Teste'
     or v_context ->> 'role' <> 'operator' then
    raise exception 'Falha: contexto do próprio funcionário ativo está incorreto.';
  end if;

  if app_private.assert_active_employee() <> v_actor then
    raise exception 'Falha: guard interno não retornou a identidade autenticada.';
  end if;

  update public.employee_accounts
     set status = 'disabled', deactivated_at = now()
   where id = v_account;

  v_context := public.get_my_employee_context();
  if coalesce((v_context ->> 'authorized')::boolean, true) is not false then
    raise exception 'Falha: conta desativada continua autorizada no contexto.';
  end if;

  v_denied := false;
  begin
    perform app_private.assert_active_employee();
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Falha de segurança: guard interno aceitou conta desativada.';
  end if;

  if has_function_privilege('anon', 'public.get_my_employee_context()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.get_my_employee_context()', 'EXECUTE')
     or has_function_privilege('authenticated', 'app_private.assert_active_employee()', 'EXECUTE')
     or has_function_privilege('anon', 'app_private.assert_active_employee()', 'EXECUTE') then
    raise exception 'Falha de segurança: contexto/guard interno com grants incorretos.';
  end if;

  raise notice 'OK: contexto mínimo do próprio usuário, bloqueio por desativação e grants de RPC.';
end
$test$;

rollback;
