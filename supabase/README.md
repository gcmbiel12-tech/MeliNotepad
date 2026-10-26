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

**Estado desta etapa:** a migração está aplicada e validada no Supabase local; não foi aplicada ao banco remoto. A CLI local trabalha com o banco Docker `supabase_db_MeliNotepad`, sem vincular o projeto ao remoto. O cliente frontend e a sincronização por snapshots estão implementados, mas permanecem desativados por padrão enquanto a configuração pública do projeto não for fornecida e o fluxo real não for validado.

## Cliente de autenticação do frontend (26/10/2026)

O frontend tem uma camada REST própria (`js/supabase-auth.js`) para Supabase Auth e RPCs, sem enviar `service_role` ao navegador. O arquivo `js/supabase-config.js` está deliberadamente sem valores por padrão. Antes de ativar o modo autenticado, configure `supabaseUrl` e `supabaseAnonKey` com a URL e a chave pública/publishable (ou anon) do projeto correto. Não coloque senhas nem chaves secret/service-role nesse arquivo.

Quando URL e chave estão configuradas, a tela de login bloqueia a navegação dos módulos até o contexto de funcionário ser validado. O fluxo inclui criar conta, confirmar por e-mail, entrar/sair, recuperar senha, solicitar acesso com código numérico de sete dígitos e revisar solicitações como administrador. A sessão fica em `sessionStorage`, não persiste ao fechar a aba. Configure no Supabase Auth as URLs de site/redirecionamento para o endereço real da aplicação e habilite confirmação de e-mail/CAPTCHA conforme a política de publicação.

**Limite importante:** a autenticação e o fluxo de acesso não significam que os dados operacionais já estejam sincronizados em produção. O frontend agora oferece sincronização opt-in de snapshots JSON versionados para NEX, XPT e Intervalos, com comparação, escolha explícita de versão, backup e proteção contra conflito. Essa camada ainda não foi testada contra um projeto Supabase real, não migra automaticamente os dados locais e não substitui a integração relacional XPT. Mantenha desativada até configurar o projeto remoto e validar o fluxo com usuários de teste.

Testes: `node --test tests/unit/supabase-auth.test.js` e `node tests/e2e/auth-gate.test.js` (o E2E simula as respostas Auth/RPC; não substitui teste contra o projeto Supabase real).

## Modelo XPT (26/10/2026)

A migração `20261026100000_add_xpt_operational_schema.sql` adiciona o modelo relacional para operações, gaiolas/auditorias, veículos, associações gaiola-veículo com histórico de remoção, ocorrências e reauditorias. O esquema mantém códigos legados, quantidades, históricos JSON, vínculos entre registros da mesma operação e restrições de unicidade/validação. As seis tabelas têm RLS habilitada e grants diretos revogados para `PUBLIC`, `anon`, `authenticated` e `service_role`.

O modelo relacional XPT está aplicado e validado apenas no Supabase local; nenhuma tabela remota foi criada e o frontend ainda não grava diretamente nesse esquema relacional. A sincronização frontend implementada nesta etapa usa snapshots JSON versionados por módulo e um bucket privado para fotos XPT, sem migrar automaticamente os registros locais. Antes de ativar em produção, ainda é necessário configurar o projeto remoto, aplicar as migrações autorizadas e testar autenticação, políticas de Storage, concorrência e recuperação com usuários de teste.

Validação transacional: `tests/supabase-xpt-schema-validation.sql`. O teste insere dados sintéticos, valida relações e constraints (inclusive exclusividade da gaiola ativa e preservação da reauditoria original) e faz `ROLLBACK`.

## Autoria e trilha de auditoria (26/10/2026)

A migração `20261026110000_add_operational_audit_triggers.sql` adiciona triggers nas tabelas de identidade e operacionais NEX, Intervalos e XPT. Quando há identidade autenticada, `created_by`/`updated_by` são derivados de `auth.uid()` em vez de confiar no valor enviado pelo navegador; `updated_at` é definido no servidor e a coluna `version` incrementa em atualizações. Eventos `INSERT`, `UPDATE` e `DELETE` registram snapshots `before_data`/`after_data` em `audit_events`. A tabela de auditoria continua fechada aos papéis da aplicação.

Quando uma mudança ocorre por operação administrativa sem JWT, o evento é marcado como `system` e a autoria permanece nula, sem inventar identidade. Os triggers não substituem as RPCs de autorização nem resolvem conflitos concorrentes por si só: as próximas RPCs precisam validar conta/funcionário ativos e a versão esperada antes de gravar.

Validação transacional: `tests/supabase-audit-trigger-validation.sql`, que verifica autoria derivada do JWT, versão, timestamps, snapshots e bloqueio de leitura/escrita direta na trilha; faz `ROLLBACK`.

## Contexto de identidade para o frontend (26/10/2026)

A migração `20261026120000_add_employee_context_rpc.sql` adiciona `get_my_employee_context()`, que retorna apenas o contexto do usuário autenticado (código e nome do funcionário, papel e indicador de administrador principal), sem grants de leitura direta às tabelas de identidade. Usuário autenticado sem associação ativa recebe uma resposta genérica sem detalhes do cadastro. O helper interno `app_private.assert_active_employee()` exige conta e cadastro ativos e bloqueia as linhas durante a operação; ele está inacessível aos papéis da aplicação e deverá ser chamado pelas futuras RPCs operacionais.

Validação transacional: `tests/supabase-employee-context-validation.sql`, cobrindo contexto autorizado, conta desativada e grants; faz `ROLLBACK`.

## Snapshots versionados para sincronização (26/10/2026)

A migração `20261026130000_add_versioned_module_snapshots.sql` adiciona uma camada de compatibilidade com o estado JSON que o frontend já usa. Há um snapshot compartilhado por módulo (`nex`, `xpt`, `intervalos`), protegido por RLS e sem grants diretos; as RPCs `get_module_snapshot` e `save_module_snapshot` exigem conta/funcionário ativos. A gravação usa `expected_version`: conflito concorrente retorna SQLSTATE `40001` em vez de sobrescrever silenciosamente alterações de outro dispositivo. A trilha de auditoria guarda versão e hash do payload, não uma segunda cópia do JSON inteiro.

O frontend agora inclui um painel de sincronização por módulo. A primeira comparação não substitui dados automaticamente: o usuário escolhe se envia a cópia local (preservando antes uma cópia da versão remota), baixa a cópia remota (com backup local antes de substituir) ou mantém o módulo apenas neste aparelho.

### Fotos do XPT

A migração `20261026140000_add_xpt_photo_storage.sql` prepara o bucket privado `xpt-fotos`, limitado a JPEG de até 10 MiB por objeto. Leitura, upload e atualização dependem de uma sessão autenticada vinculada a funcionário autorizado; não há política de exclusão pelo cliente. A sincronização transfere as fotos referenciadas antes de enviar ou aplicar o snapshot XPT e interrompe a operação se uma foto necessária não existir localmente nem na nuvem. O teste `tests/supabase-photo-storage-validation.sql` valida a configuração do bucket e as políticas no banco local.

A migração e o código permanecem locais até validação e publicação autorizadas. Não executar `supabase db push` nem aplicar migrações no projeto remoto sem autorização explícita. Depois de ativado, cada gravação local é enviada com versão esperada; conflito concorrente desativa a sincronização daquele módulo e preserva os dados locais. Ao voltar a abrir a aplicação, alterações remotas podem ser baixadas automaticamente somente quando a cópia local não mudou desde a última sincronização.

O XPT com referências de fotos transfere os arquivos do IndexedDB para o bucket privado antes de sincronizar o snapshot. Os testes de interface simulam as respostas Auth/RPC; ainda é necessário testar contra um projeto Supabase configurado com usuários de teste. O modelo relacional XPT continua disponível como destino para uma migração gradual.

Validação transacional: `tests/supabase-snapshot-rpc-validation.sql`, incluindo os três contratos de módulo, versionamento, conflito, payload inválido e grants. O fluxo frontend é coberto por `tests/e2e/auth-gate.test.js`.

## Dependências de etapas seguintes

- Configurar URL e chave pública do projeto em `js/supabase-config.js`, aplicar as migrações aprovadas ao ambiente remoto e testar Auth/RPC com usuários de teste.
- Estratégia de recuperação/restauração lógica e testes de concorrência e reconciliação antes de migrar dados locais.
- Tokens de ativação/recuperação, caso sejam necessários além do fluxo de senha escolhido pelo usuário no Supabase Auth.
- Limitação por IP/CAPTCHA configurados e testados em Supabase Auth/Edge Function antes de abertura pública.
