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
  v_table record;
  v_attempt integer;
  v_limited boolean := false;
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

  -- Limite por identidade: cinco chamadas aceitas na janela; a sexta é recusada.
  -- A chamada inicial acima já consumiu uma tentativa para esta identidade.
  for v_attempt in 1..4 loop
    perform public.request_employee_access('0000002');
  end loop;
  begin
    perform public.request_employee_access('0000002');
  exception when raise_exception then
    v_limited := true;
  end;
  if not v_limited then
    raise exception 'Falha: a sexta solicitação não foi limitada.';
  end if;

  -- Chamadas anônimas não podem executar a RPC protegida.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  v_denied := false;
  begin
    perform public.request_employee_access('0000002');
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Falha de segurança: identidade anônima executou a RPC de solicitação.';
  end if;

  -- Toda tabela operacional/de identidade precisa manter RLS e negar acesso
  -- direto a anon/authenticated. Acesso aos dados deve ocorrer por RPC autorizada.
  for v_table in
    select n.nspname, c.relname, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p')
       and n.nspname in ('public', 'app_private')
  loop
    if not v_table.relrowsecurity then
      raise exception 'Falha de segurança: RLS desativada em %.%', v_table.nspname, v_table.relname;
    end if;
    if has_table_privilege('anon', format('%I.%I', v_table.nspname, v_table.relname), 'SELECT')
       or has_table_privilege('anon', format('%I.%I', v_table.nspname, v_table.relname), 'INSERT')
       or has_table_privilege('anon', format('%I.%I', v_table.nspname, v_table.relname), 'UPDATE')
       or has_table_privilege('anon', format('%I.%I', v_table.nspname, v_table.relname), 'DELETE')
       or has_table_privilege('authenticated', format('%I.%I', v_table.nspname, v_table.relname), 'SELECT')
       or has_table_privilege('authenticated', format('%I.%I', v_table.nspname, v_table.relname), 'INSERT')
       or has_table_privilege('authenticated', format('%I.%I', v_table.nspname, v_table.relname), 'UPDATE')
       or has_table_privilege('authenticated', format('%I.%I', v_table.nspname, v_table.relname), 'DELETE') then
      raise exception 'Falha de segurança: acesso direto inesperado em %.%', v_table.nspname, v_table.relname;
    end if;
  end loop;

  if has_schema_privilege('anon', 'app_private', 'USAGE')
     or has_schema_privilege('authenticated', 'app_private', 'USAGE') then
    raise exception 'Falha de segurança: schema app_private acessível pelos clientes.';
  end if;
  if has_function_privilege('anon', 'public.request_employee_access(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_pending_access_requests()', 'EXECUTE')
     or has_function_privilege('anon', 'public.approve_employee_access(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.deny_employee_access(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.request_employee_access(text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.list_pending_access_requests()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.approve_employee_access(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.deny_employee_access(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'app_private.bootstrap_first_administrator(text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'app_private.bootstrap_first_administrator(text,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'app_private.bootstrap_first_administrator(text,uuid)', 'EXECUTE') then
    raise exception 'Falha de segurança: privilégios inesperados em RPC de acesso ou bootstrap.';
  end if;

  raise notice 'OK: solicitação/aprovação, limite por identidade, negação anônima, RLS/grants em todas as tabelas e bootstrap validados.';
end
$test$;

rollback;
