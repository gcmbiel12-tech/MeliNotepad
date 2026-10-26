-- Corrige o tipo retornado pelo Supabase Auth (varchar) para corresponder
-- ao contrato RPC declarado (text). A migração original permanece imutável.
create or replace function public.list_pending_access_requests()
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
           ar.requested_by, u.email::text
      from public.access_requests ar
      join auth.users u on u.id = ar.requested_by
     where ar.status = 'pending' and ar.requested_by is not null
     order by ar.requested_at, ar.id;
end;
$function$;

-- CREATE OR REPLACE preserva o dono e as permissões da função existente.
