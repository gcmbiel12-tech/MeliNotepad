-- Validação transacional local das migrações MeliNotepad.
-- Executar somente no banco local descartável, pelo PowerShell:
-- Get-Content -Raw -Encoding UTF8 tests\supabase-security-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
-- Toda a massa de teste é revertida no final.
begin;

do $test$
declare
  v_admin constant uuid := '10000000-0000-4000-8000-000000000001';
  v_operator constant uuid := '10000000-0000-4000-8000-000000000002';
  v_request_id uuid;
  v_count integer;
  v_result jsonb;
  v_denied boolean := false;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_admin, 'authenticated', 'authenticated', 'admin-test@melinotepad.invalid',
     '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_operator, 'authenticated', 'authenticated', 'operator-test@melinotepad.invalid',
     '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.employees (employee_code, full_name)
  values ('0000001', 'Administrador de Teste'),
         ('0000002', 'Operador de Teste');

  -- Bootstrap disponível apenas ao proprietário da migração.
  perform app_private.bootstrap_first_administrator('0000001', v_admin);

  -- Solicitação feita por identidade autenticada.
  perform set_config('request.jwt.claim.sub', v_operator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  v_result := public.request_employee_access('0000002');
  if coalesce((v_result ->> 'accepted')::boolean, false) is not true then
    raise exception 'Falha: solicitação de acesso não foi aceita.';
  end if;

  select ar.id into v_request_id
    from public.access_requests ar
   where ar.requested_by = v_operator and ar.status = 'pending';
  if v_request_id is null then
    raise exception 'Falha: pedido pendente não foi persistido.';
  end if;

  -- Somente administrador ativo pode listar e aprovar.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select count(*) into v_count from public.list_pending_access_requests();
  if v_count <> 1 then
    raise exception 'Falha: administrador não recebeu a lista pendente esperada.';
  end if;

  perform public.approve_employee_access(v_request_id);
  if not exists (
    select 1 from public.employee_accounts ea
     where ea.employee_id = (select e.id from public.employees e where e.employee_code = '0000002')
       and ea.auth_user_id = v_operator
       and ea.status = 'active'
       and ea.access_role = 'operator'
  ) then
    raise exception 'Falha: aprovação não criou vínculo ativo de operador.';
  end if;
  if not exists (
    select 1 from public.access_requests ar
     where ar.id = v_request_id and ar.status = 'approved'
       and ar.reviewed_by = v_admin and ar.reviewed_at is not null
  ) then
    raise exception 'Falha: aprovação não concluiu o pedido com auditoria.';
  end if;

  -- Operador não pode listar pedidos administrativos.
  perform set_config('request.jwt.claim.sub', v_operator::text, true);
  begin
    perform public.list_pending_access_requests();
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Falha de segurança: operador conseguiu listar pedidos administrativos.';
  end if;

  -- Verifica grants diretos, RLS e isolamento do schema privado.
  if has_table_privilege('anon', 'public.employees', 'SELECT')
     or has_table_privilege('authenticated', 'public.employees', 'SELECT')
     or has_table_privilege('anon', 'public.nex_operations', 'SELECT')
     or has_table_privilege('authenticated', 'public.nex_operations', 'SELECT') then
    raise exception 'Falha de segurança: acesso direto inesperado às tabelas.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.employees'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.nex_operations'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.interval_records'::regclass) then
    raise exception 'Falha de segurança: RLS desativada em tabela operacional.';
  end if;
  if has_function_privilege('anon', 'app_private.bootstrap_first_administrator(text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'app_private.bootstrap_first_administrator(text,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'app_private.bootstrap_first_administrator(text,uuid)', 'EXECUTE') then
    raise exception 'Falha de segurança: bootstrap administrativo exposto.';
  end if;

  raise notice 'OK: solicitação, aprovação, bloqueio de operador, RLS/grants e bootstrap validados.';
end
$test$;

rollback;
