-- MeliNotepad: solicitação e aprovação segura de acesso.
-- O usuário cria sua própria credencial pelo Supabase Auth. Esta migração
-- associa a identidade autenticada ao cadastro do funcionário após aprovação.

alter table public.access_requests
  add column requested_by uuid references auth.users(id) on delete restrict;

-- Pedidos anteriores não registravam a identidade que os enviou. Não é seguro
-- associá-los a um usuário atual: cancele-os preservando a linha e o histórico.
update public.access_requests
   set status = 'cancelled',
       review_note = concat_ws(
         E'\n',
         nullif(btrim(review_note), ''),
         'Cancelada pela migração: solicitante não registrado. Envie uma nova solicitação.'
       )
 where status = 'pending'
   and requested_by is null;

alter table public.access_requests
  add constraint access_requests_pending_requester_required
  check (status <> 'pending' or requested_by is not null);

create unique index access_requests_one_pending_per_requester
  on public.access_requests (requested_by)
  where status = 'pending' and requested_by is not null;

-- Limite por identidade autenticada. A linha é atualizada atomicamente por
-- UPSERT, evitando que chamadas concorrentes ultrapassem a janela.
create table app_private.access_request_limits (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null,
  constraint access_request_limits_count check (request_count > 0)
);
alter table app_private.access_request_limits enable row level security;
revoke all on table app_private.access_request_limits
  from public, anon, authenticated, service_role;

create function app_private.assert_active_administrator()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Ação não autorizada';
  end if;
  -- O lock impede que a desativação concorrente passe despercebida antes de
  -- terminar a operação administrativa.
  perform 1
      from public.employee_accounts ea
      join public.employees e on e.id = ea.employee_id
     where ea.auth_user_id = v_actor
       and ea.status = 'active'
       and ea.access_role = 'administrator'
       and e.employment_status = 'active'
     for share of ea, e;
  if not found then
    raise exception using errcode = '42501', message = 'Ação não autorizada';
  end if;
  return v_actor;
end;
$function$;
revoke all on function app_private.assert_active_administrator()
  from public, anon, authenticated, service_role;

create function public.request_employee_access(p_employee_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_allowed boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Autenticação necessária';
  end if;
  if p_employee_code is null or p_employee_code !~ '^[0-9]{7}$' then
    raise exception using errcode = '22023', message = 'Código inválido';
  end if;

  insert into app_private.access_request_limits as limits
    (auth_user_id, window_started_at, request_count)
  values (v_actor, v_now, 1)
  on conflict (auth_user_id) do update
    set window_started_at = case
          when limits.window_started_at <= v_now - interval '1 hour' then v_now
          else limits.window_started_at
        end,
        request_count = case
          when limits.window_started_at <= v_now - interval '1 hour' then 1
          else limits.request_count + 1
        end;

  select limits.request_count <= 5
    into v_allowed
    from app_private.access_request_limits limits
   where limits.auth_user_id = v_actor;
  if not v_allowed then
    raise exception using errcode = 'P0001', message = 'Limite temporário de solicitações atingido';
  end if;

  -- Uma identidade já vinculada ou com solicitação pendente não abre outra.
  -- A resposta continua idêntica, sem revelar a existência do código ou vínculo.
  if not exists (
    select 1 from public.employee_accounts ea where ea.auth_user_id = v_actor
  ) and not exists (
    select 1 from public.access_requests ar
     where ar.requested_by = v_actor and ar.status = 'pending'
  ) then
    insert into public.access_requests
      (requested_employee_code, requested_by, status)
    values (p_employee_code, v_actor, 'pending')
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'message', 'Se os dados forem elegíveis, a solicitação será analisada.'
  );
end;
$function$;
revoke all on function public.request_employee_access(text)
  from public, anon, service_role;
grant execute on function public.request_employee_access(text) to authenticated;

create function public.list_pending_access_requests()
returns table (
  request_id uuid,
  employee_code text,
  requested_at timestamptz,
  requester_id uuid,
  requester_email text
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
begin
  perform app_private.assert_active_administrator();
  return query
    select ar.id, ar.requested_employee_code, ar.requested_at,
           ar.requested_by, u.email
      from public.access_requests ar
      join auth.users u on u.id = ar.requested_by
     where ar.status = 'pending' and ar.requested_by is not null
     order by ar.requested_at, ar.id;
end;
$function$;
revoke all on function public.list_pending_access_requests()
  from public, anon, service_role;
grant execute on function public.list_pending_access_requests() to authenticated;

create function public.approve_employee_access(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_actor uuid;
  v_request public.access_requests%rowtype;
  v_employee_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  v_actor := app_private.assert_active_administrator();

  select ar.* into v_request
    from public.access_requests ar
   where ar.id = p_request_id
   for update;
  if not found or v_request.status <> 'pending' or v_request.requested_by is null then
    raise exception using errcode = '22023', message = 'Solicitação indisponível';
  end if;

  select e.id into v_employee_id
    from public.employees e
   where e.employee_code = v_request.requested_employee_code
     and e.employment_status = 'active'
   for update;
  if not found then
    raise exception using errcode = '22023', message = 'Solicitação indisponível';
  end if;

  -- Ambas as unicidades (funcionário e auth user) e a mudança do pedido
  -- fazem parte da mesma transação PostgreSQL.
  insert into public.employee_accounts
    (employee_id, auth_user_id, status, access_role, is_primary_admin, activated_at)
  values
    (v_employee_id, v_request.requested_by, 'active', 'operator', false, v_now);

  update public.access_requests
     set employee_id = v_employee_id,
         status = 'approved',
         reviewed_at = v_now,
         reviewed_by = v_actor
   where id = v_request.id;
end;
$function$;
revoke all on function public.approve_employee_access(uuid)
  from public, anon, service_role;
grant execute on function public.approve_employee_access(uuid) to authenticated;

create function public.deny_employee_access(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_actor uuid;
  v_request public.access_requests%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  v_actor := app_private.assert_active_administrator();
  select ar.* into v_request
    from public.access_requests ar
   where ar.id = p_request_id
   for update;
  if not found or v_request.status <> 'pending' or v_request.requested_by is null then
    raise exception using errcode = '22023', message = 'Solicitação indisponível';
  end if;

  update public.access_requests
     set status = 'denied',
         reviewed_at = v_now,
         reviewed_by = v_actor
   where id = v_request.id;
end;
$function$;
revoke all on function public.deny_employee_access(uuid)
  from public, anon, service_role;
grant execute on function public.deny_employee_access(uuid) to authenticated;

-- Bootstrap deliberadamente disponível somente ao proprietário da migração
-- (postgres/SQL Editor controlado). Não cria usuário Auth nem senha.
create function app_private.bootstrap_first_administrator(
  p_employee_code text,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_employee_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  if p_employee_code is null or p_employee_code !~ '^[0-9]{7}$'
     or p_auth_user_id is null then
    raise exception using errcode = '22023', message = 'Parâmetros inválidos';
  end if;
  if exists (
    select 1 from public.employee_accounts ea
     where ea.status = 'active' and ea.is_primary_admin
  ) then
    raise exception using errcode = '42501', message = 'Bootstrap já realizado';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_auth_user_id) then
    raise exception using errcode = '22023', message = 'Usuário Auth inexistente';
  end if;
  select e.id into v_employee_id
    from public.employees e
   where e.employee_code = p_employee_code
     and e.employment_status = 'active'
   for update;
  if not found then
    raise exception using errcode = '22023', message = 'Funcionário inexistente ou inativo';
  end if;

  insert into public.employee_accounts
    (employee_id, auth_user_id, status, access_role, is_primary_admin, activated_at)
  values
    (v_employee_id, p_auth_user_id, 'active', 'administrator', true, v_now);
end;
$function$;
-- O proprietário de SECURITY DEFINER sempre conserva capacidade de execução.
-- Fixe-o explicitamente; se o executor não puder transferir para postgres, a
-- migração deve falhar em vez de deixar o bootstrap sob um dono inesperado.
alter function app_private.bootstrap_first_administrator(text, uuid) owner to postgres;
revoke all on function app_private.bootstrap_first_administrator(text, uuid)
  from public, anon, authenticated, service_role;

comment on column public.access_requests.requested_by is
  'Supabase Auth identity that submitted the request; set only by request_employee_access.';
