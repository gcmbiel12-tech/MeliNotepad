-- MeliNotepad: modelo relacional inicial do módulo XPT.
-- As tabelas permanecem fechadas (RLS + sem grants aos papéis da aplicação).
-- Não altera LocalStorage, não migra dados e não ativa sincronização.
-- Quantidades derivadas e estados operacionais continuam sendo validados pela aplicação/RPCs.

create table public.xpt_operations (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  started_at timestamptz not null,
  operational_date date not null,
  loading_finished_at timestamptz,
  ended_at timestamptz,
  package_qty integer,
  bulky_qty integer,
  extra_bulky_qty integer,
  pallet_qty integer,
  network_qty integer,
  total_bk integer,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  constraint xpt_operations_time_order check (
    (loading_finished_at is null or loading_finished_at >= started_at)
    and (ended_at is null or ended_at >= started_at)
    and (ended_at is null or loading_finished_at is null or ended_at >= loading_finished_at)
  ),
  constraint xpt_operations_quantities_nonnegative check (
    (package_qty is null or package_qty >= 0)
    and (bulky_qty is null or bulky_qty >= 0)
    and (extra_bulky_qty is null or extra_bulky_qty >= 0)
    and (pallet_qty is null or pallet_qty >= 0)
    and (network_qty is null or network_qty >= 0)
    and (total_bk is null or total_bk >= 0)
  ),
  constraint xpt_operations_version_positive check (version > 0)
);
create index xpt_operations_date_idx on public.xpt_operations (operational_date desc, started_at desc);
create index xpt_operations_open_idx on public.xpt_operations (started_at desc) where ended_at is null;

create table public.xpt_cages (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.xpt_operations(id) on delete restrict,
  legacy_id text unique,
  code text not null,
  is_vuc boolean not null default false,
  created_at timestamptz not null,
  audit_status text not null default 'nao_iniciada',
  auditor_name text,
  audited_at timestamptz,
  quantity_g integer,
  quantity_v integer,
  quantity_p integer,
  audit_history jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint xpt_cages_id_operation_unique unique (id, operation_id),
  constraint xpt_cages_code_nonempty check (length(btrim(code)) > 0),
  constraint xpt_cages_audit_status_valid check (
    audit_status in ('nao_iniciada', 'pendente', 'auditando', 'concluida',
                     'concluida_sem_divergencia', 'concluida_com_divergencia')
  ),
  constraint xpt_cages_auditor_required check (
    audit_status not in ('concluida', 'concluida_sem_divergencia', 'concluida_com_divergencia')
    or nullif(btrim(auditor_name), '') is not null
  ),
  constraint xpt_cages_quantities_nonnegative check (
    (quantity_g is null or quantity_g >= 0)
    and (quantity_v is null or quantity_v >= 0)
    and (quantity_p is null or quantity_p >= 0)
  ),
  constraint xpt_cages_history_array check (jsonb_typeof(audit_history) = 'array'),
  constraint xpt_cages_version_positive check (version > 0)
);
create unique index xpt_cages_code_per_operation_unique
  on public.xpt_cages (operation_id, upper(btrim(code)));
create index xpt_cages_operation_idx on public.xpt_cages (operation_id, created_at);

create table public.xpt_vehicles (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.xpt_operations(id) on delete restrict,
  legacy_id text unique,
  plate text not null,
  driver_name text,
  routes text[] not null default '{}',
  pallet_qty integer,
  network_qty integer,
  departed_at timestamptz,
  local_photo_id text,
  previous_photos jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  constraint xpt_vehicles_id_operation_unique unique (id, operation_id),
  constraint xpt_vehicles_plate_nonempty check (length(btrim(plate)) > 0),
  constraint xpt_vehicles_quantities_nonnegative check (
    (pallet_qty is null or pallet_qty >= 0)
    and (network_qty is null or network_qty >= 0)
  ),
  constraint xpt_vehicles_previous_photos_array check (jsonb_typeof(previous_photos) = 'array'),
  constraint xpt_vehicles_history_array check (jsonb_typeof(history) = 'array'),
  constraint xpt_vehicles_version_positive check (version > 0)
);
create unique index xpt_vehicles_plate_per_operation_unique
  on public.xpt_vehicles (operation_id, upper(regexp_replace(btrim(plate), '[[:space:]-]', '', 'g')));
create index xpt_vehicles_operation_idx on public.xpt_vehicles (operation_id, created_at);

-- Histórico de associação preserva remoções e impede que a mesma gaiola esteja
-- carregada simultaneamente em mais de um veículo.
create table public.xpt_vehicle_cage_assignments (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  vehicle_id uuid not null,
  cage_id uuid not null,
  loaded_at timestamptz not null,
  removed_at timestamptz,
  legacy_id text unique,
  created_by uuid references auth.users(id) on delete restrict,
  removed_by uuid references auth.users(id) on delete restrict,
  constraint xpt_assignments_vehicle_operation_fk
    foreign key (vehicle_id, operation_id)
    references public.xpt_vehicles(id, operation_id) on delete restrict,
  constraint xpt_assignments_cage_operation_fk
    foreign key (cage_id, operation_id)
    references public.xpt_cages(id, operation_id) on delete restrict,
  constraint xpt_assignments_time_order check (removed_at is null or removed_at >= loaded_at)
);
create unique index xpt_assignments_one_active_vehicle_per_cage
  on public.xpt_vehicle_cage_assignments (cage_id) where removed_at is null;
create unique index xpt_assignments_no_duplicate_active_link
  on public.xpt_vehicle_cage_assignments (vehicle_id, cage_id) where removed_at is null;
create index xpt_assignments_vehicle_history_idx
  on public.xpt_vehicle_cage_assignments (vehicle_id, loaded_at desc);

create table public.xpt_occurrences (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.xpt_operations(id) on delete restrict,
  legacy_id text unique,
  category text not null,
  other_description text,
  product_id text not null,
  product_type text,
  found_cage_code text not null,
  correct_cage_code text,
  identified_by text not null,
  recorded_at timestamptz not null,
  note text,
  status text not null default 'pendente',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  constraint xpt_occurrences_id_operation_unique unique (id, operation_id),
  constraint xpt_occurrences_category_valid check (
    category in ('bingo', 'faltante', 'duplicado', 'avaria', 'retirado', 'outra')
  ),
  constraint xpt_occurrences_other_description_required check (
    category <> 'outra' or nullif(btrim(other_description), '') is not null
  ),
  constraint xpt_occurrences_product_nonempty check (length(btrim(product_id)) > 0),
  constraint xpt_occurrences_found_cage_nonempty check (length(btrim(found_cage_code)) > 0),
  constraint xpt_occurrences_identified_by_nonempty check (length(btrim(identified_by)) > 0),
  constraint xpt_occurrences_status_valid check (status in ('pendente', 'resolvido')),
  constraint xpt_occurrences_history_array check (jsonb_typeof(history) = 'array'),
  constraint xpt_occurrences_version_positive check (version > 0)
);
create index xpt_occurrences_operation_recorded_idx
  on public.xpt_occurrences (operation_id, recorded_at desc);
create index xpt_occurrences_product_idx on public.xpt_occurrences (operation_id, upper(btrim(product_id)));
create index xpt_occurrences_found_cage_idx
  on public.xpt_occurrences (operation_id, upper(btrim(found_cage_code)));

create table public.xpt_reaudits (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  cage_id uuid not null,
  occurrence_id uuid not null,
  legacy_id text unique,
  auditor_name text not null,
  audited_at timestamptz not null,
  quantity_g integer not null,
  quantity_p integer not null,
  result text not null,
  original_auditor_name text not null,
  original_result text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete restrict,
  constraint xpt_reaudits_cage_operation_fk
    foreign key (cage_id, operation_id)
    references public.xpt_cages(id, operation_id) on delete restrict,
  constraint xpt_reaudits_occurrence_operation_fk
    foreign key (occurrence_id, operation_id)
    references public.xpt_occurrences(id, operation_id) on delete restrict,
  constraint xpt_reaudits_auditor_nonempty check (length(btrim(auditor_name)) > 0),
  constraint xpt_reaudits_original_auditor_nonempty check (length(btrim(original_auditor_name)) > 0),
  constraint xpt_reaudits_quantities_nonnegative check (quantity_g >= 0 and quantity_p >= 0),
  constraint xpt_reaudits_result_valid check (result in ('divergencia', 'sem_divergencia')),
  constraint xpt_reaudits_original_result_valid check (original_result in ('divergencia', 'sem_divergencia'))
);
create index xpt_reaudits_cage_time_idx on public.xpt_reaudits (cage_id, audited_at desc);
create index xpt_reaudits_occurrence_idx on public.xpt_reaudits (occurrence_id);

-- Não expor as novas tabelas enquanto as RPCs de autorização operacional
-- e o fluxo de sincronização não forem implementados e testados.
alter table public.xpt_operations enable row level security;
alter table public.xpt_cages enable row level security;
alter table public.xpt_vehicles enable row level security;
alter table public.xpt_vehicle_cage_assignments enable row level security;
alter table public.xpt_occurrences enable row level security;
alter table public.xpt_reaudits enable row level security;

revoke all on table public.xpt_operations, public.xpt_cages, public.xpt_vehicles,
  public.xpt_vehicle_cage_assignments, public.xpt_occurrences, public.xpt_reaudits
  from public, anon, authenticated, service_role;

comment on table public.xpt_operations is
  'Operações XPT; status derivado dos horários de carregamento e encerramento.';
comment on table public.xpt_cages is
  'Gaiolas XPT e estado/quantidades da auditoria; VUC fica explicitamente separado dos totais.';
comment on table public.xpt_vehicle_cage_assignments is
  'Histórico de associação entre gaiolas e veículos, incluindo remoções.';
comment on table public.xpt_occurrences is
  'Ocorrências XPT com histórico de mudanças de status preservado.';
comment on table public.xpt_reaudits is
  'Reauditorias vinculadas à ocorrência e gaiola; não substituem a auditoria original.';
