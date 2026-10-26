# Fluxo local de acesso

## Decisão de arquitetura

Solicitar, listar e aprovar acesso usa RPCs PostgreSQL `SECURITY DEFINER`. O banco recebe a identidade pelo contexto JWT (`auth.uid()`), verifica no servidor se o aprovador continua sendo administrador ativo e grava associação e aprovação na mesma transação. Os clientes não recebem grants diretos nas tabelas. A conta Auth e sua senha são criadas pelo próprio funcionário pelo Supabase Auth; o banco operacional guarda apenas o UUID da identidade.

Uma Edge Function pode ser acrescentada para CAPTCHA, limitação por IP e entrega de notificações. Não é necessária para a atomicidade do vínculo e não foi criada nesta etapa. O limite SQL atual é cinco solicitações por identidade autenticada por hora, com resposta genérica para não confirmar códigos. Configure também confirmação de e-mail, CAPTCHA e limites do Supabase Auth antes de disponibilizar o cadastro publicamente; contas Auth descartáveis podem contornar limites por identidade.

## Primeiro administrador

1. Cadastre o funcionário autorizado em `public.employees` por um canal administrativo controlado.
2. O próprio administrador cria sua conta no Supabase Auth e define a senha. Não existe senha padrão.
3. Em ambiente local ou no SQL Editor autenticado como proprietário `postgres`, execute uma única vez, substituindo o código e o UUID reais:

```sql
select app_private.bootstrap_first_administrator('0000123', 'UUID-DO-AUTH-USER');
```

A migração transfere explicitamente a propriedade da função para `postgres` e revoga execução de `PUBLIC`, `anon`, `authenticated` e `service_role`. O proprietário conserva execução por regra do PostgreSQL; portanto, a segurança depende de `postgres` ser um papel administrativo confiável, acessível somente por operadores autorizados. Se o papel que executa a migração não puder transferir a propriedade para `postgres`, a migração falha e não deve ser contornada removendo essa transferência.

Depois de aplicar em Supabase local, confirme proprietário e modo `SECURITY DEFINER`:

```sql
select n.nspname,
       p.proname,
       pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer,
       p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.oid = 'app_private.bootstrap_first_administrator(text,uuid)'::regprocedure;
```

O resultado esperado é `owner = postgres`, `security_definer = true` e `search_path` fixo. Confirme também que os papéis da aplicação não têm execução:

```sql
select has_function_privilege('anon', 'app_private.bootstrap_first_administrator(text,uuid)', 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', 'app_private.bootstrap_first_administrator(text,uuid)', 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('service_role', 'app_private.bootstrap_first_administrator(text,uuid)', 'EXECUTE') as service_role_can_execute;
```

Todos os três resultados devem ser `false`. Não conceda `EXECUTE` a papéis da aplicação; não use credenciais de `postgres` no navegador. O bootstrap não cria usuário Auth ou senha, e não deve ser chamado por uma rota da aplicação.

### Pedidos legados

Ao aplicar esta migração, pedidos que ainda estejam `pending` e não tenham `requested_by` são atualizados para `cancelled`. A linha e seus demais dados são preservados, e `review_note` recebe a razão da transição sem apagar uma nota anterior. Nenhum usuário é atribuído por inferência. O novo `CHECK` impede que pedidos futuros permaneçam pendentes sem identidade registrada. Se for necessária revisão humana dos pedidos antigos, faça isso antes de aplicar a migração e por canal administrativo controlado; depois da transição eles não aparecem como pendentes nas RPCs.

## Fluxo

1. O funcionário cria sua própria credencial pelo Supabase Auth e, já autenticado, chama `request_employee_access(codigo_texto)`. O código deve ser texto para preservar zeros à esquerda.
2. A resposta não confirma se o código existe ou se outra solicitação já o utiliza. No máximo uma solicitação pendente por identidade e por código é armazenada.
3. Um administrador ativo lista pendências com `list_pending_access_requests()`, que mostra código, horário e identidade Auth (UUID/e-mail) do solicitante. O administrador confirma a identidade do funcionário por um canal organizacional confiável e então aprova por `approve_employee_access(request_id)` ou recusa por `deny_employee_access(request_id)`.
4. A função verifica novamente autorização, estado do funcionário e pedido pendente; cria a associação como `operator` ativo e marca a solicitação aprovada numa única transação. Unicidades existentes impedem associação duplicada.

O código por si só não prova que o solicitante é o funcionário. A aprovação requer a verificação humana da identidade pelo administrador; a confirmação de e-mail do Supabase Auth deve estar habilitada para o método por e-mail.

Não envie `service_role` ao navegador. Use a chave pública/anon apenas com sessão Auth; as tabelas não têm acesso direto concedido. Não habilite publicação antes de políticas e validações de autorização para os demais dados do sistema.

## Validação local

As migrações pressupõem Supabase Auth (`auth.users`, `auth.uid()`) e papéis `anon`, `authenticated`, `service_role` e `postgres`; PostgreSQL puro não comprova esses comportamentos. Com Supabase CLI e Docker já instalados e projeto local configurado, aplique as migrações **somente no ambiente local descartável** (`supabase start` e `supabase db reset`) e teste:

- chamadas anônimas negadas e RPC de solicitação sem acesso direto às tabelas;
- resposta indistinguível para código inexistente, ocupado ou solicitação já pendente;
- limite de seis chamadas na mesma janela e concorrência de chamadas;
- listagem/aprovação negadas a operador, conta desativada e funcionário inativo;
- aprovação válida associa o UUID solicitante ao funcionário e define `operator`;
- segunda aprovação, funcionário já associado e identidade já vinculada a outro funcionário falham sem estado parcial;
- recusa autorizada finaliza solicitação mesmo quando o código não corresponde a funcionário ativo;
- bootstrap único pelo papel proprietário; chamadas por `anon`, `authenticated` e `service_role` falham;
- introspecção de grants efetivos e confirmação de que `app_private` não está exposto pelo PostgREST.

## Migração de categorias NEX (26/10/2026)

O frontend agora inclui as categorias `bingo` e `faltando`. A migração `20261026000000_add_nex_bingo_faltando_categories.sql` atualiza a restrição `nex_occurrences_category_valid` para aceitar essas categorias sem apagar ou reescrever ocorrências existentes. Ela usa `NOT VALID` seguido de `VALIDATE CONSTRAINT` para explicitar a validação da restrição.

Validação automatizada do contrato frontend/SQL: `node --test tests/unit/supabase-nex-schema.test.js`. Para testar inserções reais, depois de aplicar as migrações num Supabase local descartável, execute `tests/supabase-nex-category-validation.sql`; o script insere dados sintéticos dentro de uma transação e faz `ROLLBACK`.

**Estado desta etapa:** a migração está aplicada e validada no Supabase local; não foi aplicada ao banco remoto. A CLI local está configurada para trabalhar com o banco Docker `supabase_db_MeliNotepad`, sem vincular o projeto local ao remoto. A integração frontend permanece desativada enquanto as políticas operacionais e a autenticação não forem concluídas.

## Modelo XPT (26/10/2026)

A migração `20261026100000_add_xpt_operational_schema.sql` adiciona o modelo relacional para operações, gaiolas/auditorias, veículos, associações gaiola-veículo com histórico de remoção, ocorrências e reauditorias. O esquema mantém códigos legados, quantidades, históricos JSON, vínculos entre registros da mesma operação e restrições de unicidade/validação. As seis tabelas têm RLS habilitada e grants diretos revogados para `PUBLIC`, `anon`, `authenticated` e `service_role`.

O modelo está aplicado e validado apenas no Supabase local. Nenhum dado local foi migrado, nenhuma tabela remota foi criada e o frontend ainda não grava nesse esquema. Fotos continuam no IndexedDB local; a integração futura exigirá Supabase Storage e migração explícita dos arquivos. Antes de habilitar a sincronização, ainda são necessárias RPCs transacionais, autorização por funcionário ativo, auditoria de autoria/versão e testes de conflito concorrente.

Validação transacional: `tests/supabase-xpt-schema-validation.sql`. O teste insere dados sintéticos, valida relações e constraints (inclusive exclusividade da gaiola ativa e preservação da reauditoria original) e faz `ROLLBACK`.

## Dependências de etapas seguintes

- Políticas RLS e autorização para dados operacionais compartilhados, com bloqueio efetivo de conta desativada em cada operação protegida.
- Auditoria automática de criação, alteração, exclusão e restauração, autoria confiável, `updated_at` e controle concorrente por versão.
- Tokens de ativação/recuperação; esta etapa usa a senha escolhida pelo usuário no Supabase Auth e não implementa tokens próprios.
- Integração do frontend e migração/sincronização dos dados NEX e Intervalos.
- Limitação por IP/CAPTCHA configurados e testados em Supabase Auth/Edge Function antes de abertura pública.
