-- MeliNotepad: operações compartilhadas, exclusão lógica e trilha de auditoria.
-- Instantes são armazenados como timestamptz. A aplicação deve agrupar e filtrar
-- datas operacionais no fuso IANA America/Sao_Paulo.

create table public.nex_operations (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null default 'em_andamento',
  sacas integer not null default 0,
  pacotes integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete restrict,
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete restrict,
  constraint nex_operations_status_valid check (status in ('em_andamento', 'finalizada')),
  constraint nex_operations_state_time check (
    (status = 'em_andamento' and ended_at is null)
    or (status = 'finalizada' and ended_at is not null)
  ),
  constraint nex_operations_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint nex_operations_totals_nonnegative check (sacas >= 0 and pacotes >= 0),
  constraint nex_operations_version_positive check (version > 0),
  constraint nex_operations_deleted_pair check ((deleted_at is null) = (deleted_by is null)),
  constraint nex_operations_restored_pair check ((restored_at is null) = (restored_by is null))
);
create index nex_operations_started_at_idx on public.nex_operations (started_at desc);
create index nex_operations_active_started_at_idx
  on public.nex_operations (started_at desc) where deleted_at is null;

create table public.nex_occurrences (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  operation_id uuid not null references public.nex_operations(id) on delete restrict,
  code text not null,
  category text not null,
  status text not null,
  note text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete restrict,
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete restrict,
  constraint nex_occurrences_code_nonempty check (length(btrim(code)) > 0),
  constraint nex_occurrences_category_valid check (category in (
    'avariados', 'duplicados_inventario', 'possiveis_duplicados',
    'nao_localizados', 'despachar_nao_agregados'
  )),
  constraint nex_occurrences_status_valid check (status in ('pendente', 'resolvido')),
  constraint nex_occurrences_version_positive check (version > 0),
  constraint nex_occurrences_deleted_pair check ((deleted_at is null) = (deleted_by is null)),
  constraint nex_occurrences_restored_pair check ((restored_at is null) = (restored_by is null))
);
create index nex_occurrences_operation_idx on public.nex_occurrences (operation_id);
create index nex_occurrences_code_idx on public.nex_occurrences (code);
create index nex_occurrences_active_operation_idx
  on public.nex_occurrences (operation_id) where deleted_at is null;

create table public.interval_records (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  employee_id uuid references public.employees(id) on delete restrict,
  legacy_employee_id text,
  employee_name_snapshot text not null,
  sector_snapshot text,
  released_at timestamptz not null,
  saida_at timestamptz not null,
  duracao_prevista_min integer not null,
  retorno_previsto_at timestamptz not null,
  retorno_real_at timestamptz,
  status text not null,
  legacy_change_history jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete restrict,
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete restrict,
  constraint interval_records_employee_reference check (employee_id is not null or legacy_employee_id is not null),
  constraint interval_records_employee_name_nonempty check (length(btrim(employee_name_snapshot)) > 0),
  constraint interval_records_duration_positive check (duracao_prevista_min > 0),
  constraint interval_records_status_valid check (status in ('ativo', 'encerrado')),
  constraint interval_records_return_state check (
    (status = 'ativo' and retorno_real_at is null)
    or (status = 'encerrado' and retorno_real_at is not null)
  ),
  constraint interval_records_expected_return_after_exit check (retorno_previsto_at > saida_at),
  constraint interval_records_actual_return_after_exit check (retorno_real_at is null or retorno_real_at >= saida_at),
  constraint interval_records_change_history_array check (jsonb_typeof(legacy_change_history) = 'array'),
  constraint interval_records_version_positive check (version > 0),
  constraint interval_records_deleted_pair check ((deleted_at is null) = (deleted_by is null)),
  constraint interval_records_restored_pair check ((restored_at is null) = (restored_by is null))
);
create index interval_records_saida_at_idx on public.interval_records (saida_at desc);
create index interval_records_employee_saida_idx on public.interval_records (employee_id, saida_at desc);
create index interval_records_active_saida_idx
  on public.interval_records (saida_at desc) where deleted_at is null;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_legacy_id text,
  occurred_at timestamptz not null default clock_timestamp(),
  source text not null default 'application',
  before_data jsonb,
  after_data jsonb,
  constraint audit_events_action_nonempty check (length(btrim(action)) > 0),
  constraint audit_events_entity_nonempty check (length(btrim(entity_type)) > 0),
  constraint audit_events_source_valid check (source in ('application', 'legacy_import', 'system')),
  constraint audit_events_entity_reference check (entity_id is not null or entity_legacy_id is not null),
  constraint audit_events_no_unattributed_application check (actor_id is not null or source <> 'application')
);
create index audit_events_entity_time_idx
  on public.audit_events (entity_type, entity_id, occurred_at desc);
create index audit_events_actor_time_idx on public.audit_events (actor_id, occurred_at desc);

alter table public.nex_operations enable row level security;
alter table public.nex_occurrences enable row level security;
alter table public.interval_records enable row level security;
alter table public.audit_events enable row level security;

-- RLS está habilitada, mas as políticas e os privilégios operacionais pertencem
-- à etapa de autorização. A auditoria não recebe escrita direta pelos clientes.
revoke all on table public.nex_operations, public.nex_occurrences,
  public.interval_records, public.audit_events from public, anon, authenticated;
revoke update, delete, truncate on table public.audit_events
  from anon, authenticated, service_role;

comment on column public.nex_operations.started_at is
  'Equivalente ao startTime legado; data operacional do NEX.';
comment on column public.interval_records.saida_at is
  'Equivalente ao saidaAt legado; data operacional do histórico de Intervalos.';
comment on column public.interval_records.employee_id is
  'Vínculo opcional até que a correspondência do cadastro local legado seja validada.';
comment on column public.interval_records.legacy_change_history is
  'Histórico alteracoes legado preservado na importação; novas mudanças devem gerar audit_events.';
comment on column public.audit_events.actor_id is
  'Nulo somente quando a autoria histórica não é conhecida; nunca preencher por inferência.';
comment on column public.audit_events.occurred_at is
  'Timestamp oficial do servidor; exibição operacional usa America/Sao_Paulo.';