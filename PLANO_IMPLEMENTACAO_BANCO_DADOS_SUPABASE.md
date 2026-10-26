# Plano de Implementação do Banco de Dados — MeliNotepad

**Status:** planejamento inicial — não executar migração para produção ainda.  
**Objetivo:** definir uma direção técnica gratuita, segura e evolutiva para centralizar os dados do MeliNotepad, sem bloquear mudanças futuras nas regras de negócio.

## 1. Decisão inicial

- **Banco principal proposto:** Supabase (PostgreSQL), começando pelo plano gratuito.
- **Frontend atual:** HTML, CSS e JavaScript puro/PWA; preservar a arquitetura simples sempre que possível.
- **Google Planilhas:** opcional para exportações e análises, não como banco principal.
- **Google Apps Script:** não é necessário para a arquitetura proposta.
- **Persistência local atual:** não remover nem substituir até a migração ser projetada, testada e aprovada.
- **Custo:** objetivo de R$ 0 durante desenvolvimento e início de uso, respeitando as cotas gratuitas. Verificar preços e limites vigentes antes da publicação.
- **Este documento é vivo:** atualizar quando a lógica operacional, os requisitos ou a arquitetura mudarem.

## 2. Estado conhecido e cautelas

- O projeto é uma PWA em JavaScript puro.
- O README indica que os módulos operacionais ainda usam armazenamento local e que a sincronização entre dispositivos não está implementada.
- Já existem migrações SQL em `supabase/migrations/`. Antes de criar tabelas ou migrações novas, revisar integralmente o conteúdo, o histórico Git e o estado do projeto Supabase para evitar duplicação ou incompatibilidade.
- Há arquivos de backup locais não rastreados no Git. Preservá-los; não incluí-los em commits sem avaliar sua finalidade.
- As regras NEX e XPT ainda podem mudar. Nesta etapa, planejar e mapear; não presumir que o modelo de dados final está fechado.
- Não inserir chaves secretas, senhas, tokens ou credenciais no frontend, neste documento ou no repositório.

## 3. Arquitetura proposta

```
Funcionário
    |
    v
MeliNotepad PWA (HTML/CSS/JavaScript)
    |
    +--> Interface e regras de negócio
    |
    +--> Camada de acesso a dados (repository/adapters)
    |       |
    |       +--> Adaptador local atual (preservação/transição)
    |       |
    |       +--> Adaptador Supabase (futuro)
    |
    v
Supabase
    +--> Auth: identidade e sessão do usuário
    +--> PostgreSQL: dados operacionais relacionais
    +--> RLS: autorização por tabela/linha
    +--> Storage: fotos/arquivos, somente se necessário
    +--> Migrations SQL versionadas no repositório
    |
    v
Exportação/relatórios (PDF e, se necessário, Google Planilhas/CSV)
```

### Princípios arquiteturais

1. A interface não deve espalhar chamadas diretas ao banco por todos os arquivos. Centralizar acesso em módulos de dados bem definidos.
2. Separar autenticação de autorização: estar autenticado não significa ter acesso a todas as operações.
3. Ativar políticas RLS nas tabelas expostas pela API e testar acessos permitidos e negados.
4. Nunca colocar a chave `service_role` ou qualquer segredo administrativo no navegador. Usar apenas a chave pública apropriada, com RLS corretamente configurado.
5. Criar restrições, chaves estrangeiras, índices e transações no banco quando adequados; não depender apenas da validação da interface.
6. Usar identificadores estáveis e operações idempotentes para evitar duplicidade em cliques repetidos, reenvios e concorrência.
7. Definir estados operacionais válidos e transições permitidas, incluindo em andamento, pré-encerrada, encerrada e cancelada, conforme as regras finais.
8. Mostrar “Salvo” somente após confirmação real da persistência. Erros e gravações pendentes devem ficar visíveis e permitir recuperação.
9. Não prometer operação offline sincronizada até definir e testar uma estratégia para conflitos, fila de gravação e reconciliação.
10. O banco deve ser a fonte única para totais e relatórios compartilhados, evitando cálculos divergentes em telas diferentes.

## 4. Plano passo a passo

### Fase A — Descoberta e inventário (sem mudança funcional)
- [ ] Ler o planejamento funcional mais recente de NEX/XPT e registrar dúvidas abertas.
- [ ] Inspecionar todos os arquivos de migração existentes e verificar o que já foi implementado.
- [ ] Mapear chaves do LocalStorage, IndexedDB (se houver), modelos de dados e funções de leitura/gravação.
- [ ] Identificar quais módulos já possuem salvamento automático e quais não possuem.
- [ ] Mapear relações: funcionário, acesso, operação, rota, veículo, auditoria, ocorrência, histórico e anexos.
- [ ] Confirmar ambiente Supabase existente, projetos, migrações aplicadas e políticas configuradas, sem expor credenciais.
- [ ] Registrar estado Git e preservar alterações preexistentes.
- **Saída:** inventário do estado real, riscos e lista de decisões pendentes.

### Fase B — Fechar regras de negócio e modelo conceitual
- [ ] Estabilizar as regras principais de NEX e XPT antes de definir restrições rígidas.
- [ ] Definir o ciclo de vida de cada operação e as diferenças entre cancelar e encerrar.
- [ ] Definir se dados cancelados serão excluídos, preservados ou registrados em auditoria técnica.
- [ ] Definir unicidade de operação, rota e auditoria e o que caracteriza uma duplicata.
- [ ] Definir o relacionamento entre rotas, veículos, gaiolas, quantidades G/V/P, redes, paletes e ocorrências.
- [ ] Definir os papéis de acesso e quais dados cada papel pode consultar ou alterar.
- [ ] Definir a necessidade real de fotos/anexos e sua retenção.
- **Saída:** modelo conceitual revisado; não congelar decisões que ainda dependam de alterações funcionais.

### Fase C — Modelo relacional e segurança
- [ ] Revisar as tabelas existentes e reutilizar o que estiver correto.
- [ ] Elaborar o diagrama de entidades e relacionamentos.
- [ ] Definir colunas, tipos, chaves primárias/estrangeiras, restrições únicas, índices e timestamps.
- [ ] Definir vínculo seguro entre identidade autenticada e funcionário.
- [ ] Projetar políticas RLS de menor privilégio para leitura, inserção, atualização e exclusão.
- [ ] Planejar migrações SQL incrementais, reversíveis quando possível, e compatíveis com os dados existentes.
- [ ] Criar dados de teste não sensíveis para validar o modelo.
- **Saída:** esquema e políticas revisados antes de conectar os fluxos reais.

### Fase D — Camada de acesso a dados no frontend
- [ ] Criar uma camada única de acesso a dados, separada da interface e das regras de negócio.
- [ ] Definir contratos claros para criar, consultar, atualizar, finalizar e cancelar operações.
- [ ] Manter o adaptador local enquanto a migração estiver em andamento.
- [ ] Implementar tratamento de erro, timeout, estados de salvamento e repetição segura.
- [ ] Impedir dupla submissão e proteger contra concorrência usando também garantias do banco.
- [ ] Evitar que dados sensíveis ou credenciais sejam escritos em logs.
- **Saída:** integração isolada e testável, sem espalhar dependências pelo aplicativo.

### Fase E — Autenticação, permissões e cadastro
- [ ] Definir o fluxo de login compatível com a operação real.
- [ ] Integrar os identificadores de funcionários já existentes (incluindo QR numérico de sete dígitos, se essa regra permanecer).
- [ ] Não assumir que o QR, sozinho, é uma credencial segura; definir como autenticar e autorizar o usuário.
- [ ] Implementar permissões no banco e na interface, sempre considerando a RLS como barreira de segurança.
- [ ] Testar acesso permitido e negado para cada papel.
- **Saída:** usuários identificados e acessos efetivamente controlados.

### Fase F — Migração e sincronização gradual
- [ ] Definir como os dados locais existentes serão preservados e migrados.
- [ ] Criar exportação/backup antes de qualquer migração destrutiva.
- [ ] Validar contagens, identificadores, datas, relações e duplicidades.
- [ ] Testar migração em ambiente de teste; nunca experimentar primeiro sobre dados operacionais importantes.
- [ ] Definir como evitar que uma operação seja gravada duas vezes durante a transição.
- [ ] Só habilitar a persistência remota para um módulo depois de passar pelos testes e pela revisão.
- [ ] Manter plano de retorno ao armazenamento anterior até validar a migração.
- **Saída:** migração verificável, com reconciliação e plano de recuperação.

### Fase G — Testes de integridade, concorrência e uso real
- [ ] Testar criar, editar, recarregar, retomar, encerrar e cancelar.
- [ ] Testar dois usuários alterando dados ao mesmo tempo.
- [ ] Testar duplo clique, reenvio, rede instável, timeout e erro de persistência.
- [ ] Testar políticas RLS com usuários de diferentes permissões.
- [ ] Testar consistência dos totais e relatórios de NEX/XPT.
- [ ] Testar desktop, Android, instalação PWA e comportamento offline definido.
- [ ] Testar backup e restauração, não apenas a criação do arquivo de backup.
- [ ] Executar a suíte de regressão antes de cada aprovação.
- **Saída:** evidências reais de testes; não declarar aprovação com testes críticos pendentes.

### Fase H — Operação, monitoramento e publicação
- [ ] Conferir limites e preços vigentes do plano gratuito.
- [ ] Monitorar tamanho do banco, transferência, autenticação e armazenamento de arquivos.
- [ ] Implementar backup independente e documentar a recuperação.
- [ ] Revisar políticas RLS, configuração de chaves, exposição de dados e logs.
- [ ] Definir procedimento para incidentes e restauração.
- [ ] Fazer publicação somente após autorização explícita.
- **Saída:** checklist de entrada em produção aprovado.

## 5. Modelo de dados preliminar (não definitivo)

Os nomes abaixo são conceituais. Não criar tabelas novas antes de comparar com as migrações existentes.

- **Funcionários/perfis:** vínculo entre usuário autenticado, funcionário e permissões.
- **Operações NEX:** identificador, status, datas e metadados da conferência.
- **Operações XPT:** identificador, status, início/fim e metadados do carregamento.
- **Rotas:** código, tipo e vínculos com a operação.
- **Veículos:** placa, motorista e demais atributos realmente necessários.
- **Auditorias:** rota/operação, auditor, quantidades G/V/P, estado e timestamps.
- **Ocorrências:** produto, categoria, origem, gaiola correta, situação e resolução.
- **Histórico de eventos:** eventos críticos e alterações que precisem de rastreabilidade.
- **Anexos:** metadados e referência a arquivos no Storage, somente se fotos/documentos forem necessários.

Avaliar se NEX e XPT devem compartilhar tabelas ou ter tabelas específicas com entidades comuns. A decisão depende do modelo real e não deve ser tomada apenas para reduzir o número de tabelas.

## 6. Regras de segurança e integridade

- Não expor chaves secretas no código do navegador ou no Git.
- Aplicar RLS a todas as tabelas acessíveis pela API e verificar cada política.
- Aplicar privilégio mínimo: cada usuário só pode realizar ações autorizadas.
- Não confiar apenas em filtros ou botões escondidos na interface.
- Usar constraints e transações para invariantes que precisam ser garantidas no banco.
- Registrar timestamps de forma consistente e apresentar datas no fuso esperado da operação.
- Definir retenção e acesso ao histórico conforme as regras finais.
- Evitar guardar dados pessoais que não sejam necessários à operação.
- Não executar migrações destrutivas sem backup validado, plano de retorno e autorização.
- Não fazer push, deploy ou publicação sem autorização explícita.

## 7. Plano de custo zero

- Começar no plano gratuito do Supabase e monitorar as cotas reais.
- Evitar arquivos grandes no banco relacional; se necessário, avaliar Supabase Storage e seus limites.
- Reduzir consultas redundantes e carregar somente os dados necessários.
- Não assumir disponibilidade contínua, backups automáticos ou armazenamento ilimitado no plano gratuito.
- Documentar o que acontecerá se o projeto atingir cotas ou for pausado.
- Reavaliar custo antes de publicar e sempre que o volume de uso aumentar.

## 8. Critérios para avançar entre fases

Cada fase deve seguir o ciclo: **análise → implementação → testes direcionados → regressão → revisão do diff → documentação → aprovação**.

Não avançar se:
- houver falha crítica;
- houver perda ou divergência de dados;
- permissões não estiverem comprovadas;
- um teste essencial não puder ser executado sem que a limitação esteja resolvida;
- a alteração depender de uma regra de negócio ainda não decidida.

Se houver bloqueio que exija decisão do responsável, apresentar o problema, evidências, alternativas, riscos e recomendação técnica. Não fazer escolhas irreversíveis silenciosamente.

## 9. Como manter este plano atualizado

Sempre que a lógica do aplicativo mudar:
1. Atualizar o planejamento funcional correspondente.
2. Identificar impacto no modelo de dados, nas permissões, nas migrações e nos relatórios.
3. Marcar os itens afetados neste documento como “revisar”.
4. Registrar decisões confirmadas e perguntas ainda abertas.
5. Não executar migração de produção antes de revisar os impactos.

### Registro de decisões

| Data | Decisão/alteração | Estado |
|---|---|---|
| 2026-10-25 | Supabase/PostgreSQL proposto como banco principal; Google Planilhas opcional para exportações; não depender de Apps Script. | Proposta inicial, sujeita à revisão após inventário e estabilização das regras. |

## 10. Referências oficiais

- Supabase: https://supabase.com/
- Preços e cotas: https://supabase.com/pricing
- Segurança e RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Migrações: https://supabase.com/docs/guides/deployment/database-migrations
- Autenticação: https://supabase.com/docs/guides/auth
- Storage: https://supabase.com/docs/guides/storage
