-- Camada de compatibilidade para sincronizar os estados JSON atuais sem perder campos
-- enquanto a migração dos módulos para CRUD relacional é feita por etapas.
-- Um snapshot compartilhado por módulo, com controle de versão otimista.

create table public.module_snapshots (
  module_name text primary key check (module_name in ('nex', 'xpt', 'intervalos')),
  payload jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete restrict
);
alter table public.module_snapshots enable row level security;
revoke all on table public.module_snapshots from public, anon, authenticated, service_role;

create trigger module_snapshots_stamp_row
before insert or update on public.module_snapshots
for each row execute function app_private.stamp_operational_row();

create function app_private.audit_module_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_module text;
begin
  if tg_op = 'INSERT' then
    v_module := new.module_name;
    v_after := jsonb_build_object(
      'version', new.version,
      'payload_md5', md5(new.payload::text)
    );
  elsif tg_op = 'UPDATE' then
    v_module := new.module_name;
    v_before := jsonb_build_object(
      'version', old.version,
      'payload_md5', md5(old.payload::text)
    );
    v_after := jsonb_build_object(
      'version', new.version,
      'payload_md5', md5(new.payload::text)
    );
  else
    v_module := old.module_name;
    v_before := jsonb_build_object(
      'version', old.version,
      'payload_md5', md5(old.payload::text)
    );
  end if;

  insert into public.audit_events
    (actor_id, action, entity_type, entity_id, entity_legacy_id, occurred_at,
     source, before_data, after_data)
  values
    (v_actor, tg_op, 'module_snapshots', null, v_module, clock_timestamp(),
     case when v_actor is null then 'system' else 'application' end,
     v_before, v_after);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
alter function app_private.audit_module_snapshot() owner to postgres;
revoke all on function app_private.audit_module_snapshot()
  from public, anon, authenticated, service_role;
create trigger module_snapshots_audit_row
after insert or update or delete on public.module_snapshots
for each row execute function app_private.audit_module_snapshot();

create function public.get_module_snapshot(p_module_name text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_snapshot public.module_snapshots%rowtype;
begin
  perform app_private.assert_active_employee();
  if p_module_name is null or p_module_name not in ('nex', 'xpt', 'intervalos') then
    raise exception using errcode = '22023', message = 'Módulo inválido';
  end if;

  select * into v_snapshot
    from public.module_snapshots
   where module_name = p_module_name;

  if not found then
    return jsonb_build_object(
      'module', p_module_name,
      'version', 0,
      'payload', null,
      'updatedAt', null
    );
  end if;

  return jsonb_build_object(
    'module', v_snapshot.module_name,
    'version', v_snapshot.version,
    'payload', v_snapshot.payload,
    'updatedAt', v_snapshot.updated_at
  );
end;
$function$;
alter function public.get_module_snapshot(text) owner to postgres;
revoke all on function public.get_module_snapshot(text) from public, anon, service_role;
grant execute on function public.get_module_snapshot(text) to authenticated;

create function public.save_module_snapshot(
  p_module_name text,
  p_expected_version integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_actor uuid;
  v_version integer;
  v_updated_at timestamptz;
begin
  v_actor := app_private.assert_active_employee();

  if p_module_name is null or p_module_name not in ('nex', 'xpt', 'intervalos') then
    raise exception using errcode = '22023', message = 'Módulo inválido';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception using errcode = '22023', message = 'Versão esperada inválida';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'Dados do módulo inválidos';
  end if;
  if octet_length(p_payload::text) > 10000000 then
    raise exception using errcode = '22023', message = 'O snapshot excede o limite de 10 MB';
  end if;

  -- Validação de contrato para impedir payload de outro módulo ou estrutura quebrada.
  if p_module_name = 'nex' and (
       jsonb_typeof(p_payload -> 'versao') is distinct from 'number'
       or not (p_payload ? 'currentSession')
       or jsonb_typeof(p_payload -> 'history') is distinct from 'array'
     ) then
    raise exception using errcode = '22023', message = 'Estrutura NEX inválida';
  elsif p_module_name = 'xpt' and (
       jsonb_typeof(p_payload -> 'versao') is distinct from 'number'
       or jsonb_typeof(p_payload -> 'rev') is distinct from 'number'
       or jsonb_typeof(p_payload -> 'operacoes') is distinct from 'array'
     ) then
    raise exception using errcode = '22023', message = 'Estrutura XPT inválida';
  elsif p_module_name = 'intervalos' and (
       jsonb_typeof(p_payload -> 'versao') is distinct from 'number'
       or jsonb_typeof(p_payload -> 'funcionarios') is distinct from 'array'
       or jsonb_typeof(p_payload -> 'intervalos') is distinct from 'array'
       or jsonb_typeof(p_payload -> 'setores') is distinct from 'array'
     ) then
    raise exception using errcode = '22023', message = 'Estrutura Intervalos inválida';
  end if;

  if p_expected_version = 0 then
    begin
      insert into public.module_snapshots (module_name, payload, updated_by)
      values (p_module_name, p_payload, v_actor)
      returning version, updated_at into v_version, v_updated_at;
    exception when unique_violation then
      raise exception using errcode = '40001', message = 'CONFLICT: o módulo já foi salvo em outro dispositivo';
    end;
  else
    update public.module_snapshots
       set payload = p_payload,
           updated_by = v_actor
     where module_name = p_module_name
       and version = p_expected_version
    returning version, updated_at into v_version, v_updated_at;

    if not found then
      raise exception using errcode = '40001', message = 'CONFLICT: os dados mudaram em outro dispositivo; recarregue antes de salvar';
    end if;
  end if;

  return jsonb_build_object(
    'module', p_module_name,
    'version', v_version,
    'updatedAt', v_updated_at
  );
end;
$function$;
alter function public.save_module_snapshot(text, integer, jsonb) owner to postgres;
revoke all on function public.save_module_snapshot(text, integer, jsonb) from public, anon, service_role;
grant execute on function public.save_module_snapshot(text, integer, jsonb) to authenticated;

comment on table public.module_snapshots is
  'Camada de compatibilidade versionada para sincronizar o JSON atual de cada módulo enquanto os fluxos são migrados para CRUD relacional. Um snapshot por módulo.';
comment on function public.save_module_snapshot(text, integer, jsonb) is
  'Salva snapshot somente com conta/funcionário ativos e versão esperada; conflitos concorrentes retornam SQLSTATE 40001.';
