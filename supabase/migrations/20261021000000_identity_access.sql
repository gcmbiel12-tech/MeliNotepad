-- MeliNotepad: identidade, autorização e tokens de acesso.
-- Supabase migration. Não contém dados nem executa autenticação por si só.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
comment on schema app_private is
  'Objetos internos do MeliNotepad; não expor pelo PostgREST.';

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null,
  full_name text not null,
  employment_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  constraint employees_code_format check (employee_code ~ '^[0-9]{7}$'),
  constraint employees_code_unique unique (employee_code),
  constraint employees_id_code_unique unique (id, employee_code),
  constraint employees_name_nonempty check (length(btrim(full_name)) > 0),
  constraint employees_status_valid check (employment_status in ('active', 'inactive'))
);

create table public.employee_accounts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete restrict,
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  status text not null default 'pending_activation',
  access_role text not null default 'operator',
  is_primary_admin boolean not null default false,
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_accounts_status_valid check (status in ('pending_activation', 'active', 'disabled')),
  constraint employee_accounts_role_valid check (access_role in ('operator', 'administrator')),
  constraint employee_accounts_primary_admin_role check (not is_primary_admin or access_role = 'administrator'),
  constraint employee_accounts_state_dates check (
    (status = 'pending_activation' and activated_at is null and deactivated_at is null)
    or (status = 'active' and activated_at is not null and deactivated_at is null)
    or (status = 'disabled' and deactivated_at is not null)
  )
);
create unique index employee_accounts_one_active_primary_admin
  on public.employee_accounts (is_primary_admin)
  where is_primary_admin and status = 'active';

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  requested_employee_code text not null,
  requested_name text,
  employee_id uuid,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict,
  review_note text,
  constraint access_requests_code_format check (requested_employee_code ~ '^[0-9]{7}$'),
  constraint access_requests_status_valid check (status in ('pending', 'approved', 'denied', 'cancelled')),
  constraint access_requests_review_state check (
    (status in ('pending', 'cancelled') and reviewed_at is null and reviewed_by is null)
    or (status in ('approved', 'denied') and reviewed_at is not null and reviewed_by is not null)
  ),
  constraint access_requests_approval_employee check (status <> 'approved' or employee_id is not null),
  constraint access_requests_employee_code_match foreign key (employee_id, requested_employee_code)
    references public.employees(id, employee_code) on delete restrict
);

create unique index access_requests_one_pending_per_code
  on public.access_requests (requested_employee_code)
  where status = 'pending';
create index access_requests_status_requested_at_idx
  on public.access_requests (status, requested_at desc);

create table app_private.account_tokens (
  id uuid primary key default gen_random_uuid(),
  employee_account_id uuid not null references public.employee_accounts(id) on delete restrict,
  token_hash bytea not null unique,
  purpose text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  invalidated_by uuid references auth.users(id) on delete restrict,
  issued_by uuid not null references auth.users(id) on delete restrict,
  constraint account_tokens_hash_sha256 check (octet_length(token_hash) = 32),
  constraint account_tokens_purpose_valid check (purpose in ('activation', 'password_recovery')),
  constraint account_tokens_expiry_after_issue check (expires_at > issued_at),
  constraint account_tokens_invalidation_pair check ((invalidated_at is null) = (invalidated_by is null)),
  constraint account_tokens_terminal_state check (not (consumed_at is not null and invalidated_at is not null))
);
create index account_tokens_account_purpose_idx
  on app_private.account_tokens (employee_account_id, purpose, expires_at desc);
create unique index account_tokens_one_unresolved_per_purpose
  on app_private.account_tokens (employee_account_id, purpose)
  where consumed_at is null and invalidated_at is null;

alter table public.employees enable row level security;
alter table public.employee_accounts enable row level security;
alter table public.access_requests enable row level security;
alter table app_private.account_tokens enable row level security;

-- Sem políticas nesta etapa, os papéis da aplicação não recebem acesso direto.
revoke all on table public.employees, public.employee_accounts, public.access_requests
  from public, anon, authenticated;
revoke all on table app_private.account_tokens from public, anon, authenticated, service_role;

comment on column public.employees.employee_code is
  'Código operacional existente, guardado como texto para preservar zeros à esquerda.';
comment on column public.employee_accounts.auth_user_id is
  'Identidade gerenciada pelo Supabase Auth; não representa senha nem credencial local.';
comment on column app_private.account_tokens.token_hash is
  'Hash SHA-256 de token aleatório; o token original nunca deve ser persistido.';