-- MeliNotepad: sincroniza o CHECK de categorias do banco com as categorias NEX do frontend.
-- Aditiva e transacional; não altera nem apaga ocorrências existentes.
alter table public.nex_occurrences
  drop constraint if exists nex_occurrences_category_valid;

alter table public.nex_occurrences
  add constraint nex_occurrences_category_valid
  check (category in (
    'avariados',
    'duplicados_inventario',
    'possiveis_duplicados',
    'nao_localizados',
    'despachar_nao_agregados',
    'bingo',
    'faltando'
  )) not valid;

alter table public.nex_occurrences
  validate constraint nex_occurrences_category_valid;

comment on constraint nex_occurrences_category_valid on public.nex_occurrences is
  'Categorias NEX aceitas pela versão atual do frontend; manter sincronizado com js/constants.js.';
