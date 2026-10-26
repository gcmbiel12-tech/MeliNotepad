# Auditoria inicial da integração Supabase — MeliNotepad

**Data:** 2026-10-25  
**Estado:** diagnóstico local inicial; integração funcional ainda não ativada.  
**Projeto Supabase vinculado localmente:** `tllmihednkqlbtfhabwu` (referência, não credencial).

## 1. Estado do repositório

- Repositório local: `C:\Users\gcmbi\Documents\Projetos\MeliNotepad`.
- Branch: `main`, alinhada com `origin/main` na verificação.
- Arquivos locais não rastreados preservados: `PLANO_IMPLEMENTACAO_BANCO_DADOS_SUPABASE.md`, `js/xpt-regras.js.pre-auditoria-contadores.bak`, `js/xpt.js.pre-auditoria-contadores.bak`.
- Nenhum commit, push para Git ou deploy do aplicativo foi realizado. Uma única migração corretiva aditiva foi aplicada ao banco Supabase remoto depois de validar o dry-run e testar localmente.

## 2. Configuração de ferramentas

- A pasta `supabase/` tem migrações SQL e README.
- `supabase/.temp/project-ref` existe e corresponde ao projeto informado.
- Supabase CLI disponível por `npx supabase` (sem instalação global).
- Criado `supabase/config.toml` para desenvolvimento local, com portas próprias para não interferir no stack Supabase já existente do projeto QR Ops.
- A conexão de leitura confirmou as três migrações iniciais; após a correção testada, a migração `20261025000000` também foi aplicada e a versão remota foi conferida.
- A validação identificou e corrigiu uma falha de tipo na RPC `list_pending_access_requests`; a correção foi adicionada em nova migração incremental `20261025000000_fix_pending_access_email_type.sql` e aplicada ao remoto após teste local.
- Não foi encontrado cliente Supabase inicializado no frontend; os módulos continuam usando armazenamento local.

## 3. Migrações existentes

1. `20261021000000_identity_access.sql`: funcionários, associação de contas, solicitações de acesso e objetos privados de tokens.
2. `20261021000100_operational_data.sql`: operações NEX, ocorrências NEX, registros de Intervalos e eventos de auditoria.
3. `20261021000200_access_workflow.sql`: funções RPC para solicitar, listar, aprovar e recusar acesso, além do fluxo de bootstrap do primeiro administrador.
4. `20261025000000_fix_pending_access_email_type.sql`: corrige o tipo de e-mail retornado pela RPC administrativa sem alterar dados.

### Segurança confirmada no banco remoto

Todas as tabelas operacionais e de identidade examinadas têm RLS habilitada, sem políticas, e não concedem `SELECT` direto a `anon` ou `authenticated`. As funções RPC de acesso são `SECURITY DEFINER`, pertencem a `postgres`, e as permissões verificadas negam execução anônima e `service_role`; o bootstrap administrativo também nega execução a `authenticated`. Isso mantém as tabelas fechadas, mas significa que a interface ainda não consegue usar dados operacionais. Não criar consultas diretas antes de implementar políticas e grants de menor privilégio.

A migração corretiva `20261025000000_fix_pending_access_email_type.sql` foi aplicada e verificada no remoto. O lint local passa sem erros e o fluxo de solicitação/aprovação foi validado em banco local descartável. A consulta de contagens confirmou que o banco remoto ainda não tem funcionários, contas Auth, administradores ativos ou pedidos de acesso; portanto, o bootstrap inicial depende de cadastrar a primeira identidade real e associá-la ao código de funcionário correto de sete dígitos.

### Cobertura incompleta do modelo operacional

As migrações atuais incluem NEX e Intervalos, mas não apresentam tabelas específicas de XPT. Como as regras de XPT ainda estão em evolução, o modelo desse módulo deve ser mapeado antes de criar estruturas definitivas.

## 4. Persistência atual do frontend

- NEX usa LocalStorage.
- XPT usa LocalStorage e IndexedDB para fotos.
- Intervalos usa LocalStorage.
- Os comentários e o README indicam que os dados operacionais ainda são locais e não sincronizam entre dispositivos.
- O Service Worker armazena arquivos estáticos; não é o banco dos dados operacionais.

## 5. Próximas etapas recomendadas

1. Completar o modelo de dados do XPT, incluindo referências a fotos/arquivos sem colocar imagens no banco relacional.
2. Definir as permissões operacionais por papel e criar políticas RLS/grants para NEX, XPT e Intervalos; manter as tabelas fechadas até concluir testes de leitura e escrita autorizadas/negadas.
3. Integrar Supabase Auth ao PWA e configurar somente a chave pública de cliente. A chave `service_role` nunca pode ir para o navegador.
4. Preparar o bootstrap do primeiro administrador com o código numérico existente de sete dígitos e uma identidade Auth verificada, sem credenciais padrão.
5. Implementar sincronização gradual com controle de versão/conflito, mantendo LocalStorage e IndexedDB como recuperação até reconciliar os dados.
6. Testar os fluxos no app real e executar uma migração-piloto com dados não críticos antes de habilitar os módulos operacionais.
7. Não remover dados locais nem publicar o app até passar pelos testes de segurança, integridade e recuperação.

## 6. Testes executados nesta rodada

- 61 testes unitários: todos passaram.
- Testes E2E existentes: NEX 31/31, Intervalos 18/18, leitura/normalização de QR 7/7 e XPT: aprovado.
- Banco Supabase local: as quatro migrações aplicam com sucesso; `supabase db lint --local --fail-on error` não encontrou erros.
- Validação SQL transacional: solicitação de acesso, aprovação pelo administrador, bloqueio de operador na listagem administrativa, grants diretos, RLS e restrição do bootstrap passaram; dados de teste foram revertidos.
- Banco remoto: histórico de migrações e definição/permissões da RPC corrigida foram verificados.

## 7. Conclusão e próximos passos

O banco remoto contém as migrações de identidade e dados para NEX/Intervalos, mas o frontend ainda não está integrado. As tabelas seguem fechadas por segurança. Antes de ativar sincronização, é necessário definir/testar políticas de acesso operacional, mapear XPT (ainda sem tabelas próprias), adicionar autenticação/configuração pública segura no PWA e planejar migração/reconciliação dos dados locais. Nenhum dado operacional foi migrado, nenhum dado local foi removido, e não houve push para Git nem publicação do app.
