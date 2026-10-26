-- Validação da restrição de categorias NEX.
-- Executar SOMENTE em banco local descartável após supabase db reset.
-- Não aponta para o banco remoto e reverte todos os dados de teste.
begin;

do $test$
declare
  v_operation_id uuid;
  v_count integer;
begin
  insert into public.nex_operations (started_at, sacas, pacotes)
  values (clock_timestamp(), 0, 0)
  returning id into v_operation_id;

  insert into public.nex_occurrences (
    operation_id, code, category, status, created_at, updated_at
  ) values
    (v_operation_id, 'TEST-BINGO', 'bingo', 'pendente', clock_timestamp(), clock_timestamp()),
    (v_operation_id, 'TEST-FALTANDO', 'faltando', 'resolvido', clock_timestamp(), clock_timestamp());

  select count(*) into v_count
    from public.nex_occurrences
   where operation_id = v_operation_id
     and category in ('bingo', 'faltando');

  if v_count <> 2 then
    raise exception 'Falha: as duas novas categorias não foram persistidas.';
  end if;

  raise notice 'OK: Bingo e Faltando são aceitos pela restrição SQL.';
end
$test$;

rollback;
