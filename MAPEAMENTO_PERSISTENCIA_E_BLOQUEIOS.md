# Mapeamento técnico — persistência e próximos passos

**Data da inspeção:** 2026-10-25  
**Escopo:** análise sem alteração funcional, sem migração de dados e sem publicação.

## 1. Estado confirmado no frontend

| Módulo | Persistência atual | Chave/armazenamento | Observações |
|---|---|---|---|
| NEX | LocalStorage | `melinotepad_data_v1` | `js/storage.js` centraliza validação, leitura, gravação e backup JSON. Modelo contém `currentSession` e `history`. |
| XPT | LocalStorage | `melinotepad_xpt_v1` | `js/modulo-store.js` e `js/xpt-regras.js`; coleção principal inclui operações e dados relacionados. Sem sincronização remota. |
| Intervalos | LocalStorage | `melinotepad_intervalos_v1` | Usa `js/modulo-store.js` e regras em `js/intervalos-regras.js`. Não usa o indicador global de salvamento da mesma forma que NEX/XPT. |
| Fotos XPT | IndexedDB | Banco `melinotepad_fotos_v1`, object store `fotos` | `js/fotos.js`; fotos são locais ao dispositivo. Não há Supabase Storage conectado. |

O HTML carrega scripts locais diretamente. A inspeção não encontrou inicialização de cliente Supabase no frontend.

## 2. Estado confirmado no banco

Migrações existentes:
- Identidade e acesso: funcionários, contas vinculadas e solicitações.
- Dados operacionais: NEX, ocorrências NEX, Intervalos e eventos de auditoria.
- Fluxo de solicitação/aprovação e bootstrap do administrador.
- Correção de tipo da RPC de listagem de solicitações pendentes.

O modelo SQL ainda não possui tabelas operacionais específicas para XPT. RLS está habilitada nas tabelas existentes, mas as tabelas permanecem fechadas para acesso direto do cliente. Isso é uma condição segura enquanto a autorização operacional não estiver implementada; o frontend não deve ser conectado por meio de permissões amplas.

## 3. Administrador inicial

O código informado para o administrador inicial é `2517361`, preservado como identificador numérico existente de sete dígitos.

Esse código, sozinho, não basta para ativar o administrador. O bootstrap atual exige:
1. Um registro ativo do funcionário em `public.employees`, com esse código e nome.
2. Uma identidade real já criada no Supabase Auth, identificada por UUID.
3. Execução do bootstrap administrativo por via controlada; a RPC não é acessível ao cliente autenticado.

Nenhum funcionário, conta Auth ou administrador foi criado. Não foi inventado nome, e-mail ou identidade. Essa etapa fica pendente até haver os dados mínimos reais para vincular a conta correta.

## 4. Sequência técnica recomendada

### Pode avançar sem decisões de regra de negócio
1. Preservar os adaptadores locais e documentar contratos de leitura/gravação.
2. Mapear os formatos completos de dados de XPT e fotos antes de desenhar tabelas definitivas.
3. Criar e testar a camada de configuração/cliente Supabase sem incluir chave secreta; não habilitar gravação remota ainda.
4. Preparar testes de autorização e migração em ambiente local descartável.
5. Definir uma estratégia de migração piloto que compare contagens e identificadores, mantendo os dados locais intactos.

### Deve esperar as alterações funcionais anunciadas
1. Congelar o modelo definitivo de XPT, principalmente estados de auditoria, quantidades G/V/P por rota, consolidação por veículo, cancelamento/finalização e relatórios.
2. Criar tabelas, constraints e RPCs definitivas de XPT.
3. Migrar a persistência dos módulos operacionais para o Supabase.
4. Remover ou alterar as chaves locais — somente após reconciliação, teste de recuperação e aprovação explícita.

## 5. Riscos que não devem ser introduzidos

- Não considerar o QR de sete dígitos, isoladamente, como autenticação.
- Não expor `service_role`, senha ou segredo administrativo no navegador ou no Git.
- Não conceder acesso amplo às tabelas para acelerar a integração.
- Não declarar dados salvos na nuvem enquanto a gravação remota não tiver sido confirmada.
- Não apagar LocalStorage/IndexedDB, nem importar os dados automaticamente para produção antes de validar mapeamentos e duplicidades.
- Não publicar nem enviar alterações ao GitHub sem autorização explícita.

## 6. Verificações executadas nesta inspeção

- `git diff --check`: passou.
- `node --check` em `storage.js`, `modulo-store.js`, `save-status.js`, `xpt.js` e `intervalos.js`: passou.
- Nenhum arquivo funcional foi alterado nesta inspeção.
- Nenhum commit, push, deploy ou publicação foi realizado.

## Conclusão

O trabalho seguro agora é preparar a integração e fechar o inventário, não conectar o aplicativo diretamente ao banco. Como haverá alterações internas nas regras, a implementação definitiva do modelo operacional deve esperar essas instruções para evitar retrabalho e incompatibilidades. A persistência local permanece intacta.
