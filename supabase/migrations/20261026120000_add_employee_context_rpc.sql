-- MeliNotepad: contexto de acesso do usuário autenticado e guard interno para RPCs operacionais.

create function app_private.assert_active_employee()
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

  -- Bloqueia a associação e o cadastro durante a operação para que uma
  -- desativação concorrente não passe despercebida antes do commit.
  perform 1
    from public.employee_accounts ea
    join public.employees e on e.id = ea.employee_id
   where ea.auth_user_id = v_actor
     and ea.status = 'active'
     and e.employment_status = 'active'
   for share of ea, e;

  if not found then
    raise exception using errcode = '42501', message = 'Ação não autorizada';
  end if;
  return v_actor;
end;
$function$;
alter function app_private.assert_active_employee() owner to postgres;
revoke all on function app_private.assert_active_employee()
  from public, anon, authenticated, service_role;

create function public.get_my_employee_context()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $function$
declare
  v_actor uuid := auth.uid();
  v_context jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Autenticação necessária';
  end if;

  select jsonb_build_object(
           'authorized', true,
           'employeeId', e.id,
           'employeeCode', e.employee_code,
           'fullName', e.full_name,
           'role', ea.access_role,
           'isPrimaryAdmin', ea.is_primary_admin
         )
    into v_context
    from public.employee_accounts ea
    join public.employees e on e.id = ea.employee_id
   where ea.auth_user_id = v_actor
     and ea.status = 'active'
     and e.employment_status = 'active';

  if v_context is null then
    return jsonb_build_object(
      'authorized', false,
      'message', 'Acesso ainda não habilitado. Solicite acesso ao administrador.'
    );
  end if;

  return v_context;
end;
$function$;
alter function public.get_my_employee_context() owner to postgres;
revoke all on function public.get_my_employee_context()
  from public, anon, service_role;
grant execute on function public.get_my_employee_context() to authenticated;

comment on function public.get_my_employee_context() is
  'Retorna somente o contexto do próprio usuário autenticado; não expõe tabelas de identidade.';
comment on function app_private.assert_active_employee() is
  'Guard interno para RPCs operacionais: exige conta e cadastro de funcionário ativos.';
