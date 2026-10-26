-- Validação transacional do modelo XPT. Executar somente no Supabase local descartável.
-- PowerShell:
-- Get-Content -Raw -Encoding UTF8 tests\supabase-xpt-schema-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
-- Todos os registros sintéticos são revertidos ao final.
begin;

do $test$
declare
  v_operation uuid;
  v_cage uuid;
  v_vehicle_a uuid;
  v_vehicle_b uuid;
  v_occurrence uuid;
  v_assignment uuid;
  v_reaudit uuid;
  v_denied boolean;
  v_count integer;
  v_table record;
begin
  insert into public.xpt_operations (started_at, operational_date, package_qty)
  values (clock_timestamp(), current_date, 12)
  returning id into v_operation;

  insert into public.xpt_cages
    (operation_id, code, created_at, audit_status, auditor_name, audited_at, quantity_g, quantity_v, quantity_p)
  values
    (v_operation, 'A1', clock_timestamp(), 'concluida_com_divergencia', 'Auditor Original', clock_timestamp(), 3, 1, 2)
  returning id into v_cage;

  insert into public.xpt_vehicles (operation_id, plate, created_at, pallet_qty)
  values (v_operation, 'ABC-1234', clock_timestamp(), 2)
  returning id into v_vehicle_a;

  insert into public.xpt_vehicles (operation_id, plate, created_at)
  values (v_operation, 'DEF1G23', clock_timestamp())
  returning id into v_vehicle_b;

  insert into public.xpt_vehicle_cage_assignments
    (operation_id, vehicle_id, cage_id, loaded_at)
  values (v_operation, v_vehicle_a, v_cage, clock_timestamp())
  returning id into v_assignment;

  -- Uma gaiola não pode estar ativa em dois veículos simultaneamente.
  v_denied := false;
  begin
    insert into public.xpt_vehicle_cage_assignments
      (operation_id, vehicle_id, cage_id, loaded_at)
    values (v_operation, v_vehicle_b, v_cage, clock_timestamp());
  exception when unique_violation then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Falha: associação simultânea da mesma gaiola foi aceita.';
  end if;

  -- A remoção preserva o vínculo histórico e permite nova associação.
  update public.xpt_vehicle_cage_assignments
     set removed_at = clock_timestamp()
   where id = v_assignment;
  insert into public.xpt_vehicle_cage_assignments
    (operation_id, vehicle_id, cage_id, loaded_at)
  values (v_operation, v_vehicle_b, v_cage, clock_timestamp());

  insert into public.xpt_occurrences
    (operation_id, category, product_id, found_cage_code, correct_cage_code, identified_by, recorded_at)
  values
    (v_operation, 'bingo', 'PKG-100', 'A1', 'A2', 'Conferente Teste', clock_timestamp())
  returning id into v_occurrence;

  insert into public.xpt_reaudits
    (operation_id, cage_id, occurrence_id, auditor_name, audited_at, quantity_g, quantity_p,
     result, original_auditor_name, original_result)
  values
    (v_operation, v_cage, v_occurrence, 'Segundo Auditor', clock_timestamp(), 4, 2,
     'sem_divergencia', 'Auditor Original', 'divergencia')
  returning id into v_reaudit;

  select count(*) into v_count from public.xpt_reaudits
   where id = v_reaudit and cage_id = v_cage and occurrence_id = v_occurrence
     and original_auditor_name = 'Auditor Original' and original_result = 'divergencia';
  if v_count <> 1 then
    raise exception 'Falha: reauditoria não preservou a referência à auditoria original.';
  end if;

  -- As constraints devem recusar categoria inválida, outra sem descrição e quantidades negativas.
  v_denied := false;
  begin
    insert into public.xpt_occurrences
      (operation_id, category, product_id, found_cage_code, identified_by, recorded_at)
    values (v_operation, 'categoria_inventada', 'PKG-101', 'A1', 'Teste', clock_timestamp());
  exception when check_violation then
    v_denied := true;
  end;
  if not v_denied then raise exception 'Falha: categoria XPT inválida foi aceita.'; end if;

  v_denied := false;
  begin
    insert into public.xpt_occurrences
      (operation_id, category, product_id, found_cage_code, identified_by, recorded_at)
    values (v_operation, 'outra', 'PKG-102', 'A1', 'Teste', clock_timestamp());
  exception when check_violation then
    v_denied := true;
  end;
  if not v_denied then raise exception 'Falha: categoria Outra sem descrição foi aceita.'; end if;

  v_denied := false;
  begin
    insert into public.xpt_cages (operation_id, code, created_at, quantity_g)
    values (v_operation, 'A2', clock_timestamp(), -1);
  exception when check_violation then
    v_denied := true;
  end;
  if not v_denied then raise exception 'Falha: quantidade negativa de auditoria foi aceita.'; end if;

  -- RLS e ausência de grants diretos para todos os objetos operacionais XPT.
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('xpt_operations','xpt_cages','xpt_vehicles',
                        'xpt_vehicle_cage_assignments','xpt_occurrences','xpt_reaudits')
      and not c.relrowsecurity
  ) then
    raise exception 'Falha: uma ou mais tabelas XPT estão sem RLS.';
  end if;

  for v_table in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in ('xpt_operations','xpt_cages','xpt_vehicles',
                         'xpt_vehicle_cage_assignments','xpt_occurrences','xpt_reaudits')
  loop
    if has_table_privilege('anon', format('public.%I', v_table.relname), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_table.relname), 'INSERT')
       or has_table_privilege('anon', format('public.%I', v_table.relname), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_table.relname), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', v_table.relname), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', v_table.relname), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table.relname), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table.relname), 'DELETE')
       or has_table_privilege('service_role', format('public.%I', v_table.relname), 'SELECT')
       or has_table_privilege('service_role', format('public.%I', v_table.relname), 'INSERT') then
      raise exception 'Falha: acesso direto inesperado à tabela XPT %.', v_table.relname;
    end if;
  end loop;

  raise notice 'OK: operação, gaiolas, veículos, associação exclusiva/histórica, ocorrência, reauditoria, constraints e isolamento das tabelas XPT.';
end
$test$;

rollback;
