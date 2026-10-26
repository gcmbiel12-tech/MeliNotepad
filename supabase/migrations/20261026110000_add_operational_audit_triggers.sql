-- MeliNotepad: autoria confiável, updated_at/version e trilha de auditoria.
-- Tabelas operacionais continuam fechadas; a migração não concede acesso aos clientes.

create function app_private.stamp_operational_row()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_row jsonb;
  v_old jsonb;
begin
  v_row := to_jsonb(new);

  if v_row ? 'updated_at' then
    v_row := v_row || jsonb_build_object('updated_at', v_now);
  end if;

  if tg_op = 'INSERT' then
    if v_actor is not null and v_row ? 'created_by' then
      v_row := v_row || jsonb_build_object('created_by', v_actor);
    end if;
    if v_actor is not null and v_row ? 'updated_by' then
      v_row := v_row || jsonb_build_object('updated_by', v_actor);
    end if;
  else
    v_old := to_jsonb(old);
    if v_row ? 'version' then
      v_row := v_row || jsonb_build_object(
        'version', coalesce((v_old ->> 'version')::integer, 0) + 1
      );
    end if;
    if v_actor is not null and v_row ? 'updated_by' then
      v_row := v_row || jsonb_build_object('updated_by', v_actor);
    end if;
  end if;

  new := jsonb_populate_record(new, v_row);
  return new;
end;
$function$;
alter function app_private.stamp_operational_row() owner to postgres;
revoke all on function app_private.stamp_operational_row()
  from public, anon, authenticated, service_role;

create function app_private.audit_operational_row()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_entity_id uuid;
  v_legacy_id text;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_entity_id := (v_after ->> 'id')::uuid;
    v_legacy_id := coalesce(
      nullif(v_after ->> 'legacy_id', ''),
      nullif(v_after ->> 'employee_code', ''),
      nullif(v_after ->> 'requested_employee_code', '')
    );
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_entity_id := (v_after ->> 'id')::uuid;
    v_legacy_id := coalesce(
      nullif(v_after ->> 'legacy_id', ''),
      nullif(v_after ->> 'employee_code', ''),
      nullif(v_after ->> 'requested_employee_code', '')
    );
  else
    v_before := to_jsonb(old);
    v_entity_id := (v_before ->> 'id')::uuid;
    v_legacy_id := coalesce(
      nullif(v_before ->> 'legacy_id', ''),
      nullif(v_before ->> 'employee_code', ''),
      nullif(v_before ->> 'requested_employee_code', '')
    );
  end if;

  insert into public.audit_events
    (actor_id, action, entity_type, entity_id, entity_legacy_id, occurred_at,
     source, before_data, after_data)
  values
    (v_actor, tg_op, tg_table_name, v_entity_id, v_legacy_id, clock_timestamp(),
     case when v_actor is null then 'system' else 'application' end,
     v_before, v_after);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
alter function app_private.audit_operational_row() owner to postgres;
revoke all on function app_private.audit_operational_row()
  from public, anon, authenticated, service_role;

-- updated_at, autoria e versão são aplicados no servidor, não confiados ao cliente.
create trigger employees_stamp_row
before insert or update on public.employees
for each row execute function app_private.stamp_operational_row();
create trigger employee_accounts_stamp_row
before insert or update on public.employee_accounts
for each row execute function app_private.stamp_operational_row();
create trigger nex_operations_stamp_row
before insert or update on public.nex_operations
for each row execute function app_private.stamp_operational_row();
create trigger nex_occurrences_stamp_row
before insert or update on public.nex_occurrences
for each row execute function app_private.stamp_operational_row();
create trigger interval_records_stamp_row
before insert or update on public.interval_records
for each row execute function app_private.stamp_operational_row();
create trigger xpt_operations_stamp_row
before insert or update on public.xpt_operations
for each row execute function app_private.stamp_operational_row();
create trigger xpt_cages_stamp_row
before insert or update on public.xpt_cages
for each row execute function app_private.stamp_operational_row();
create trigger xpt_vehicles_stamp_row
before insert or update on public.xpt_vehicles
for each row execute function app_private.stamp_operational_row();
create trigger xpt_occurrences_stamp_row
before insert or update on public.xpt_occurrences
for each row execute function app_private.stamp_operational_row();

-- Eventos de auditoria não recebem trigger próprio: isso evita recursão.
create trigger employees_audit_row
after insert or update or delete on public.employees
for each row execute function app_private.audit_operational_row();
create trigger employee_accounts_audit_row
after insert or update or delete on public.employee_accounts
for each row execute function app_private.audit_operational_row();
create trigger access_requests_audit_row
after insert or update or delete on public.access_requests
for each row execute function app_private.audit_operational_row();
create trigger nex_operations_audit_row
after insert or update or delete on public.nex_operations
for each row execute function app_private.audit_operational_row();
create trigger nex_occurrences_audit_row
after insert or update or delete on public.nex_occurrences
for each row execute function app_private.audit_operational_row();
create trigger interval_records_audit_row
after insert or update or delete on public.interval_records
for each row execute function app_private.audit_operational_row();
create trigger xpt_operations_audit_row
after insert or update or delete on public.xpt_operations
for each row execute function app_private.audit_operational_row();
create trigger xpt_cages_audit_row
after insert or update or delete on public.xpt_cages
for each row execute function app_private.audit_operational_row();
create trigger xpt_vehicles_audit_row
after insert or update or delete on public.xpt_vehicles
for each row execute function app_private.audit_operational_row();
create trigger xpt_vehicle_cage_assignments_audit_row
after insert or update or delete on public.xpt_vehicle_cage_assignments
for each row execute function app_private.audit_operational_row();
create trigger xpt_occurrences_audit_row
after insert or update or delete on public.xpt_occurrences
for each row execute function app_private.audit_operational_row();
create trigger xpt_reaudits_audit_row
after insert or update or delete on public.xpt_reaudits
for each row execute function app_private.audit_operational_row();

comment on function app_private.stamp_operational_row() is
  'Define autoria pelo JWT e mantém updated_at/version no servidor; não concede acesso a tabelas.';
comment on function app_private.audit_operational_row() is
  'Registra INSERT/UPDATE/DELETE com antes/depois e autoria do JWT; acesso à trilha permanece fechado.';
