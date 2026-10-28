# MeliNotepad — Plano Mestre

> Documento consolidado por assunto. Reúne os requisitos funcionais de NEX/XPT, o plano de persistência/Supabase e o protocolo de execução. As seções de origem foram preservadas integralmente para não perder critérios de aceite nem decisões históricas.

## Situação da consolidação — 27/10/2026

- Pasta organizada em dois documentos por assunto.
- A suíte unitária executada nesta sessão: **79 aprovados, 0 falhas**.
- Sintaxe validada em **23 arquivos JavaScript de produção**; git diff --check sem erros (há apenas avisos de conversão LF/CRLF).
- O repositório já tinha alterações locais em css/modulos.css, index.html, js/nex-tabs.js, service-worker.js e 	ests/e2e/nex-abas.test.js; elas foram preservadas e não fazem parte desta consolidação.
- Nenhum push, deploy, commit ou migração remota foi realizado por esta organização.


---

## Fonte consolidada: `PLANEJAMENTO_MELHORIAS_NEX_XPT.md` 

# MeliNotepad — Planejamento de mudanças do NEX e XPT

**Status:** planejamento e análise; implementação ainda não autorizada.

**Escopo deste arquivo:** consolidar os requisitos informados para NEX e XPT. A criação deste documento não altera o código da aplicação. Nenhuma mudança funcional deve ser feita até autorização explícita.

## Regras gerais para a futura implementação

- Antes de iniciar as alterações de código, analisar o estado atual do repositório e criar um commit de segurança/checkpoint do estado aprovado, sem incluir alterações alheias ou arquivos temporários sem autorização.
- Preservar alterações preexistentes do usuário; não descartar nem misturar mudanças não relacionadas.
- Investigar a implementação atual antes de decidir como alterar cada funcionalidade.
- Implementar por fases independentes, com critérios de aceite e testes antes de avançar para a fase seguinte, validando os fluxos em computador e celular quando possível.
- Não fazer push nem publicação sem autorização explícita.
- Registrar e corrigir regressões identificadas nos testes.

---

# 1. NEX — Conferências, salvamento e relatórios

## 1.1 Criação e salvamento automático

- Ao iniciar uma conferência, criar imediatamente um registro no histórico com identificador próprio, data de criação e status **Em andamento**.
- Salvar automaticamente cada alteração, sem botão manual de salvar.
- Permitir sair e retomar a mesma conferência posteriormente, sem criar duplicatas.
- Evitar gravações desnecessárias quando houver mudanças rápidas, garantindo que a última alteração também seja persistida.
- Implementar proteção contra duplicidade na camada de aplicação e, quando compatível com a arquitetura de persistência, também no banco: identificadores estáveis, operações idempotentes, restrições/índices únicos e controle de concorrência conforme os dados atuais permitirem.
- Evitar que toques repetidos, reenvios após falha de rede ou duas tentativas simultâneas criem registros ou somem quantidades mais de uma vez.

## 1.2 Indicador visual de salvamento

Exibir um indicador discreto e permanente no topo da tela, com três estados:

- **Salvando:** círculo animado enquanto os dados estão sendo gravados.
- **Salvo:** círculo com ✓ somente após confirmação real da persistência.
- **Erro ao salvar:** alerta visível e possibilidade de tentar novamente.

Nunca indicar que os dados estão salvos quando a gravação não foi confirmada.

## 1.3 Etapas da conferência

### Em andamento
- Permitir registrar e alterar informações normalmente.
- Salvar automaticamente.
- Permitir retomar a conferência posteriormente.
- Permitir cancelar uma conferência ativa mediante confirmação.

### Pré-encerramento
- Ao avançar para o pré-encerramento, apresentar o relatório completo apenas para leitura.
- Não permitir editar o relatório nem os dados nessa etapa.
- Disponibilizar **Copiar**, **Gerar PDF** e **Compartilhar**.
- Exibir **Finalizar conferência** abaixo das opções do relatório.
- Se necessário continuar o preenchimento, disponibilizar uma ação explícita para voltar à conferência em andamento.

### Confirmação e finalização
- Ao tocar em **Finalizar conferência**, perguntar:  
  “Deseja finalizar esta conferência? Após a finalização, não será possível alterar os dados.”
- Antes de finalizar, garantir que não existam alterações pendentes de salvamento.
- Não finalizar se o salvamento dos dados falhar.
- Depois da finalização, marcar o registro como finalizado e direcionar o usuário para iniciar uma nova conferência vazia.

## 1.4 Histórico e cancelamento

- **Em andamento:** pode ser retomada ou cancelada.
- **Em pré-encerramento:** relatório somente para leitura; pode retornar explicitamente à etapa de preenchimento ou ser cancelada enquanto ainda não finalizada.
- **Finalizada:** somente consulta, cópia, PDF e compartilhamento; não pode ser editada nem cancelada.
- Conferências finalizadas devem preservar os dados e a data de encerramento.
- O cancelamento de uma conferência ativa deve exigir confirmação em duas etapas. A segunda confirmação deve identificar a conferência, por exemplo: **“Você deseja cancelar [identificação da conferência]?”** e explicar que os dados serão descartados e a conferência não poderá ser retomada.
- **Ponto a definir antes de implementar:** se registros cancelados serão excluídos definitivamente ou preservados em registro técnico para auditoria.

## 1.5 PDF e compartilhamento

- Investigar e corrigir o problema atual que impede gerar o PDF do NEX.
- Garantir relatório legível em computador e celular.
- Permitir gerar PDF tanto no pré-encerramento quanto no histórico.
- Adicionar **Compartilhar**, usando o compartilhamento nativo do dispositivo para enviar o arquivo PDF real quando suportado.
- Permitir escolher WhatsApp, e-mail ou outro aplicativo compatível.
- Se o compartilhamento de arquivos não estiver disponível, oferecer alternativa para baixar o PDF.
- Em caso de falha na geração, mostrar mensagem clara e permitir nova tentativa.
- A falha de PDF, por si só, não deve impedir a finalização se os dados estiverem salvos com segurança.

## 1.6 Proteção e critérios de aceite do NEX

- Evitar registros duplicados ao iniciar ou retomar conferências.
- Não permitir finalizar com dados pendentes de gravação.
- Manter o histórico de finalizadas imutável também na camada responsável por salvar os dados, e não apenas na interface.
- Validar salvamento, retomada, cancelamento, pré-encerramento, finalização, nova conferência, PDF, compartilhamento e falhas de conexão.

---

# 2. XPT — Gaiolas e Auditoria

## 2.1 Tipo de gaiola

- Ao adicionar uma gaiola, permitir indicar se ela é **Convencional** ou **VUC**.
- Na tabela, impedir que o campo **Tipo** entre em edição por um clique acidental. A edição, se permitida, deve exigir uma ação explícita e segura.
- Na tabela de gaiolas, renomear a coluna **Código** para **Rota**.

## 2.2 Status e conclusão da auditoria

- Ao iniciar uma auditoria, registrar o nome da pessoa que está auditando.
- Enquanto a auditoria estiver em curso, exibir **Auditando** como novo status da gaiola.
- O botão **Auditar** passa a se chamar **Concluir** depois que o auditor for informado.
- Sempre que a pessoa tocar em **Auditar**, solicitar o nome do auditor e abrir o formulário para informar as quantidades de **G (gaiolas), V (gaiolas de Volumoso) e P (paletes)** referentes à rota selecionada. O nome do responsável e o andamento da auditoria devem ficar visíveis.
- Enquanto estiver em execução, o status será **Auditando**. A ação de finalizar/concluir a auditoria confirma os dados e altera o status para **Concluído** ou **Concluído com divergência**.
- As quantidades G/V/P ficam vinculadas à **rota**. Quando a rota for atribuída a um caminhão, as quantidades acompanham a rota e entram na consolidação daquele veículo.
- Na tabela **Gaiolas e Auditoria**, substituir a coluna **Tipo** pela coluna **Qnts**, exibindo as quantidades de forma compacta (G, V e P). A informação de tipo Convencional/VUC continua disponível no cadastro e nos filtros, sem ocupar essa coluna.
- Depois de concluída a auditoria da rota, permitir **editar** os dados da auditoria/quantidades mediante ação explícita. A edição deve atualizar o registro existente, não criar uma nova auditoria duplicada; registrar ou atualizar o estado de salvamento e recalcular os totais e relatórios afetados.
- Ao encontrar divergência, o auditor registra uma **ocorrência** vinculada à gaiola/rota correspondente. Havendo ocorrência de divergência registrada, o resultado será **Concluído com divergência**; sem ocorrência, será **Concluído**. A regra precisa considerar corretamente ocorrências pendentes/resolvidas conforme a semântica atual, a ser verificada na análise técnica.
- Somente depois de confirmar e persistir os dados dessa etapa a auditoria será finalizada.
- Não exibir “Concluída sem divergência” como status normal.
- Ajustar também a funcionalidade **Auditar em Lote** para respeitar os novos status, campos e etapas de conclusão.

## 2.3 Quantidades por rota, redes de proteção e consolidação por veículo

- As quantidades informadas na finalização da auditoria são associadas à rota selecionada, não diretamente a um total digitado separadamente para o caminhão.
- Ao associar uma ou mais rotas a um caminhão, consolidar os valores G/V/P das rotas atribuídas ao veículo, sem duplicar valores se a interface for atualizada, a operação for reenviada ou a rota for reaberta.
- A quantidade de **Redes de Proteção** por veículo é calculada como **Gaiolas convencionais + Gaiolas de Volumoso**, conforme definido pelo usuário. Não incluir paletes nessa soma. Confirmar na análise técnica como distinguir as gaiolas convencionais das VUCs e como o dado de Volumoso é armazenado, para que a fórmula seja aplicada sem inferências indevidas.
- Exibir a quantidade de Redes no resumo do veículo e nos relatórios, mesmo que o campo **Redes (total)** seja removido da aba Quantidades e o campo de redes seja removido da aba Veículos e Carregamento. A quantidade deve ser calculada a partir da fonte de dados definida, e não mantida em campos duplicados divergentes.

## 2.4 Busca e filtros de gaiolas

- Na área que lista as gaiolas, substituir o rótulo/abordagem atual por um campo **Buscador**.
- Remover o filtro separado **Auditoria Código**.
- O Buscador deverá filtrar por:
  - Código/rota;
  - Tipo;
  - Status da auditoria;
  - Auditor;
  - Veículo.
- Caprichar na usabilidade dos filtros, mantendo-os claros, combináveis quando apropriado e adequados para telas pequenas.

## 2.5 Janela que se move ao selecionar veículo

- Corrigir o comportamento em que a janela/tela se desloca automaticamente para cima ao selecionar um veículo.
- A janela deve permanecer estável, sem deslocamento inesperado.
- Validar em computador; o comportamento em Android ainda não foi testado e precisa ser verificado.

---

# 3. XPT — Quantidades

- Remover desta aba **Paletes (total)**.
- Remover desta aba **Redes (total)**.
- Essas informações serão tratadas em outro local do sistema, a definir durante a análise técnica.

---

# 4. XPT — Veículos e Carregamento

Remover desta aba os campos:
- Quantidade de paletes;
- Quantidade de redes;
- Horário de saída;
- Foto do hand.

Essas informações serão feitas/tratadas em outro local. O local correto e a origem dos dados deverão ser identificados antes de implementar; não presumir nem duplicar campos.

---

# 5. XPT — Ocorrências

- Remover o texto explicativo: “A ocorrência fica vinculada à gaiola onde o produto foi encontrado (POO). As resolvidas permanecem no histórico; identificadores repetidos são sinalizados.”
- Remover o campo/informação **POO** da seção **Ocorrências da operação**.
- Corrigir o deslocamento inesperado da tela ao usar **Reabrir** e **Registrar Resolução**. A janela deve permanecer estável.
- A observação de deslocamento foi feita para computador; validar também no Android antes de concluir.

---

# 6. XPT — Pré-encerramento, relatórios e salvamento automático

## 6.1 Salvamento automático da operação

- Adotar comportamento equivalente ao planejado para o NEX: criar o registro da operação assim que a conferência/operação começar e salvar automaticamente cada mudança.
- Incluir indicador visual com estados **Salvando**, **Salvo** (círculo com ✓ após confirmação real) e **Erro ao salvar**, com nova tentativa.
- Permitir sair e retomar a mesma operação sem duplicá-la.
- Não encerrar enquanto houver dados pendentes de gravação.
- Investigar o mecanismo atual de armazenamento antes de implementar.

## 6.2 Pré-encerramento e finalização

- Ao encerrar, não finalizar diretamente: primeiro abrir o **pré-encerramento**, direcionando para o relatório.
- O relatório é gerado automaticamente e não pode ser editado.
- Disponibilizar botão **Compartilhar**.
- Ao confirmar o encerramento, finalizar a operação e sair da página atual, direcionando diretamente para uma nova operação/conferência vazia.
- Permitir cancelar uma operação aberta mediante confirmação em duas etapas. A segunda confirmação deve identificar a operação, por exemplo: **“Você deseja cancelar [identificação da operação]?”**, e deixar explícito que ela será cancelada e não poderá ser retomada. A operação cancelada não deve ser confundida com uma operação encerrada/finalizada.
- Na área **Operações**, mostrar somente operações abertas/ativas, caso existam. Operações encerradas não devem aparecer nessa lista; o local de consulta do histórico deverá ser identificado durante a análise.
- A confirmação de encerramento deve evitar ações acidentais.
- Garantir que o registro finalizado seja imutável.

## 6.3 Relatório completo em PDF

O PDF completo deverá seguir a estrutura e os dados fornecidos pelo usuário, com alinhamento consistente e formatação organizada:

1. Cabeçalho **MeliNotepad — Expedição XPT** e data da operação.
2. Horário de início e fim do carregamento. Não incluir “Operação aberta” no relatório finalizado.
3. Quantidades:
   - Pacotes;
   - Volumosos;
   - Extra volumosos;
   - Total de produtos;
   - Total de gaiolas.
4. Veículos, incluindo:
   - Placa;
   - Motorista;
   - Quantidade de gaiolas;
   - Quantidade de gaiolas de Volumoso;
   - Quantidade de paletes;
   - Quantidade de redes de proteção;
   - Horário de saída;
   - Relação das rotas/gaiolas transportadas por veículo.
5. Auditoria:
   - Total concluído e percentual;
   - Quantidade sem divergência;
   - Quantidade com divergência;
   - Quantidade não realizada.
6. Relação de gaiolas, com status e auditor responsável.
7. Para gaiolas com divergência, incluir os dados relevantes da ocorrência, como produto, categoria, pessoa que encontrou, gaiola correta e situação (pendente/resolvida).
8. Encerramento com **XPT — Carregamento encerrado**.

### Regra para redes de proteção
- A quantidade de **Redes de Proteção** por veículo deve ser calculada pela soma de **Gaiolas + Gaiolas de Volumoso**, conforme orientação fornecida.
- Não contar paletes nessa soma, salvo nova orientação explícita.
- Mostrar a lista de rotas/gaiolas atribuídas a cada veículo, com espaçamento e alinhamento consistentes.

### Regras dos status no relatório
- Gaiola sem divergência: **Concluída**.
- Gaiola com divergência: **Concluída com divergência**.
- Incluir a informação de ocorrência sob a gaiola correspondente.
- O relatório deve refletir os dados registrados; não inventar valores ausentes.

## 6.4 Relatório básico

Criar também uma versão básica, mais curta, com:
- Cabeçalho e data da operação;
- Início e fim do carregamento;
- Pacotes, Volumosos, Extra volumosos, total de produtos e gaiolas;
- Resumo dos veículos, incluindo quantidades e rotas conforme a regra de carregamento;
- Resumo da auditoria: concluídas, total e percentual;
- Encerramento.

O relatório básico não precisa listar individualmente cada gaiola nem detalhar ocorrências.

## 6.5 Compartilhamento

- Disponibilizar **Compartilhar** para os relatórios.
- Preferir o compartilhamento nativo do celular/sistema operacional, enviando o PDF real quando suportado.
- Oferecer alternativa para baixar o PDF quando o compartilhamento nativo não estiver disponível.
- Confirmar na análise se o botão permitirá escolher entre relatório completo e básico, ou se serão ações separadas.

---

# 7. Pontos que exigem análise antes de implementar

1. Verificar a estrutura atual de armazenamento e o histórico do NEX e XPT.
2. Investigar a falha de geração de PDF do NEX e a forma atual de gerar relatórios no XPT.
3. Identificar onde passarão a ser informados/armazenados paletes, redes de proteção, horário de saída e foto do hand removidos das abas atuais do XPT.
4. Confirmar como o sistema identifica as gaiolas de Volumoso e contabiliza quantidades por veículo.
5. Definir onde consultar operações encerradas, já que não deverão aparecer em **Operações**.
6. Definir se relatórios completos e básicos serão selecionados pelo usuário no momento de compartilhar.
7. Avaliar o comportamento de cancelamento de conferências/operações ativas no XPT; a regra de cancelamento foi explicitamente definida para o NEX, mas não detalhada para o XPT.
8. Verificar se a alteração do status de uma gaiola pode afetar dados ou relatórios históricos.
9. Testar os comportamentos de deslocamento da tela em computador e Android.
10. Verificar a compatibilidade do compartilhamento nativo de arquivos nos navegadores/dispositivos utilizados.

---

# 8. Plano de implementação dividido em fases

A ordem abaixo é preliminar. A análise técnica pode ajustar dependências, mas cada fase deverá ter escopo fechado, critérios de aceite e testes antes de avançar.

## Fase 0 — Inspeção e preparação segura
- Inspecionar o repositório, estado do Git, arquivos modificados/não rastreados e implementações atuais de NEX e XPT.
- Não descartar nem misturar alterações preexistentes.
- Criar commit de segurança/checkpoint somente depois de revisar o conteúdo e garantir que não inclua alterações alheias ou arquivos temporários sem autorização.
- Mapear a persistência atual, os identificadores, os estados das operações, as funções de relatório e as dependências.

**Aceite:** estado inicial documentado; checkpoint criado com escopo revisado; nenhuma alteração funcional iniciada sem autorização.

## Fase 1 — Segurança da persistência e salvamento automático
- Implementar ou corrigir o salvamento automático em NEX e XPT, incluindo estados reais **Salvando**, **Salvo** e **Erro ao salvar**.
- Garantir que alterações rápidas não percam a última gravação e que falhas possam ser repetidas.
- Aplicar mecanismos de prevenção de duplicidade em operações de criação, atualização, finalização, cancelamento e consolidação: identificadores estáveis, operações idempotentes, proteção contra duplo toque/reenvio, restrições únicas e transações/controle de concorrência quando suportados pela arquitetura.
- Definir como retomar operações existentes sem criar uma nova instância por engano.

**Aceite:** retomada sem duplicidade; falha de persistência nunca aparece como “Salvo”; reenvio ou duplo toque não cria registros nem soma quantidades duas vezes.

## Fase 2 — Auditoria XPT e quantidades por rota
- Ajustar estados **Pendente**, **Auditando**, **Concluído** e **Concluído com divergência**, respeitando a estrutura atual.
- Solicitar auditor e quantidades G/V/P ao iniciar o fluxo de auditoria; definir claramente o momento de confirmar/finalizar.
- Registrar ocorrência quando houver divergência e derivar o status da auditoria dessa ocorrência.
- Permitir editar explicitamente uma auditoria concluída, atualizando o registro existente e recalculando dados derivados sem duplicar auditorias.
- Trocar a coluna **Tipo** por **Qnts** na tabela, mantendo tipo Convencional/VUC no cadastro/filtro.
- Ajustar **Auditar em Lote** para seguir as mesmas regras.
- Vincular G/V/P à rota e preservar a relação quando ela for atribuída ao caminhão.

**Aceite:** auditoria individual e em lote consistentes; edição pós-conclusão funciona sem duplicação; ocorrências e status batem; quantidades da rota aparecem corretamente.

## Fase 3 — Consolidação de veículos e interface XPT
- Consolidar as quantidades de rotas por caminhão sem contagem duplicada.
- Calcular **Redes de Proteção = gaiolas convencionais + gaiolas de Volumoso**, excluindo paletes.
- Definir uma única fonte de verdade para quantidades e redes; exibir o valor de redes nos locais e relatórios necessários, sem campos independentes que possam divergir.
- Ajustar Buscador/filtros, renomear **Código** para **Rota** e remover o filtro **Auditoria Código**.
- Ajustar as abas Quantidades e Veículos e Carregamento, definindo primeiro onde os campos removidos serão mantidos.
- Remover o texto e o campo POO conforme solicitado.
- Corrigir deslocamentos inesperados de janelas e formulários.

**Aceite:** rota associada a caminhão contribui uma única vez; cálculo de redes validado com casos de teste; filtros e telas funcionam em desktop e mobile.

## Fase 4 — Pré-encerramento, cancelamento e histórico
- Implementar pré-encerramento somente para leitura em NEX e XPT.
- Confirmar que dados estão persistidos antes de finalizar.
- Implementar finalização imutável na interface e na camada de persistência.
- Implementar cancelamento com duas confirmações identificando a conferência/operação e explicando que não poderá ser retomada.
- Definir o tratamento de registros cancelados e o local de consulta de operações encerradas.
- Após finalizar, direcionar diretamente para uma nova conferência/operação vazia; manter a lista **Operações** limitada às operações abertas, conforme solicitado.

**Aceite:** nenhuma finalização com gravação pendente; cancelamento não é confundido com encerramento; itens finalizados não são alteráveis por ações normais; nova operação começa vazia.

## Fase 5 — Relatórios, PDF e compartilhamento
- Investigar e corrigir a falha de PDF do NEX.
- Implementar/ajustar relatório XPT completo e relatório básico, ambos derivados da mesma fonte consolidada.
- Garantir os campos e regras definidos neste documento, incluindo auditoria, rotas, veículos, redes e ocorrências.
- Implementar compartilhamento do PDF real quando suportado e alternativa de download.
- Garantir que erro de PDF seja informado e permita nova tentativa, sem bloquear encerramento quando os dados estiverem salvos.
- Disponibilizar os dois relatórios separadamente.

**Aceite:** PDFs legíveis em desktop/mobile, valores consistentes com os dados salvos, relatório básico sem detalhamento individual de gaiolas/ocorrências e completo com o detalhamento solicitado.

## Fase 6 — Validação integrada e regressão
- Testar fluxos completos de NEX e XPT, incluindo criar, salvar, sair, retomar, editar auditoria concluída, registrar ocorrência, associar rotas a caminhões, pré-encerrar, cancelar, finalizar e consultar histórico.
- Testar perda/recuperação de conexão, duplo toque, reenvio, concorrência e gravações fora de ordem.
- Validar PDFs e compartilhamento em navegadores/dispositivos suportados.
- Testar desktop e Android; revisar acessibilidade e layout mobile.
- Executar testes automatizados e revisar o diff, os arquivos alterados e o estado do Git.

**Aceite:** sem perda de dados, duplicidade, soma repetida, regressões críticas ou discrepâncias entre interface, persistência e relatórios.

## Fase 7 — Fechamento técnico
- Registrar os resultados dos testes, limitações conhecidas e eventuais pendências.
- Revisar o commit final e garantir que só inclua mudanças aprovadas.
- Não fazer push ou publicação sem autorização explícita.

---

# 9. Critérios gerais de conclusão

- As mudanças solicitadas estão implementadas sem remover funcionalidades não relacionadas.
- Salvamento automático e indicador refletem o estado real da persistência.
- Operações abertas podem ser retomadas sem duplicidade.
- Relatórios são gerados automaticamente, consistentes, alinhados e somente para leitura.
- O PDF completo contém os dados detalhados; o básico contém apenas o resumo especificado.
- O compartilhamento envia o arquivo correto ou oferece alternativa de download.
- Finalizar direciona para uma nova operação vazia.
- Operações encerradas não aparecem na lista de **Operações**.
- Os filtros de gaiolas contemplam código/rota, tipo, auditoria, auditor e veículo.
- A auditoria individual e em lote seguem as mesmas regras de status e conclusão.
- Os deslocamentos inesperados das janelas são corrigidos e verificados nos dispositivos suportados.
- Testes não indicam perda de dados, duplicidade nem regressões.

**Estado final deste planejamento:** documentação criada; nenhuma alteração funcional implementada. A execução dependerá de autorização explícita.


---

## Fonte consolidada: `PLANO_IMPLEMENTACAO_BANCO_DADOS_SUPABASE.md` 

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
| 2026-10-26 | Identificada divergência entre categorias NEX no frontend e CHECK SQL; criada migração aditiva para permitir `bingo` e `faltando`, com testes de contrato. | Migração versionada, ainda não aplicada nem validada em banco local/remoto; Docker indisponível no ambiente. |

## 10. Referências oficiais

- Supabase: https://supabase.com/
- Preços e cotas: https://supabase.com/pricing
- Segurança e RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Migrações: https://supabase.com/docs/guides/deployment/database-migrations
- Autenticação: https://supabase.com/docs/guides/auth
- Storage: https://supabase.com/docs/guides/storage


---

## Fonte consolidada: `PROMPT_DEV_IMPLEMENTACAO_NEX_XPT.md` 

# PROMPT PARA DEV — IMPLEMENTAÇÃO INTEGRAL DO PLANEJAMENTO NEX + XPT

## Contexto e arquivos oficiais

Projeto: `C:\Users\gcmbi\Documents\Projetos\MeliNotepad`

Documento obrigatório de requisitos e planejamento:
`C:\Users\gcmbi\Documents\Projetos\MeliNotepad\PLANEJAMENTO_MELHORIAS_NEX_XPT.md`

Trabalhe na cópia oficial do projeto acima. O documento `PLANEJAMENTO_MELHORIAS_NEX_XPT.md` é a fonte de verdade para escopo, regras de negócio e critérios gerais. Leia-o integralmente antes de alterar qualquer código e volte a consultá-lo durante toda a execução.

O usuário autorizou explicitamente o uso do Remote Desktop e autorizou executar o trabalho da Fase 0 até a Fase 7 em sequência, sem pausas para pedir autorização entre fases, exceto se houver necessidade especial real.

## Objetivo e regra de continuidade

Execute o plano completo, da **Fase 0 à Fase 7**, em ordem, com autonomia técnica. Não pare depois de apenas analisar, propor ou implementar uma parte. Ao concluir uma fase, faça análise, testes, correções e nova validação. **Só avance para a fase seguinte quando todos os critérios aplicáveis da fase atual estiverem aprovados e os testes relevantes passarem integralmente.**

Interprete “100% certo” como: todos os testes executados e aprovados, critérios de aceite satisfeitos, nenhuma falha conhecida relacionada ao escopo, nenhuma regressão identificada e evidências registradas. Não declare sucesso se testes necessários foram ignorados, não puderam ser executados ou falharam.

Se uma fase falhar:
1. Investigue a causa.
2. Corrija o problema.
3. Execute novamente os testes afetados e a regressão pertinente.
4. Repita até aprovação, desde que seja seguro e tecnicamente viável.

Não interrompa para pedir confirmação rotineira entre fases. Pare e informe o usuário somente se houver uma necessidade especial que realmente impeça continuar com segurança, por exemplo: risco concreto de perda/corrupção de dados, conflito impossível de resolver sem decisão de negócio, credencial/permissão essencial ausente, serviço indisponível que bloqueie validação crítica, operação irreversível fora do escopo, ou requisito contraditório que não possa ser resolvido pelo documento. Antes de parar, conclua e documente tudo que puder ser feito com segurança.

## Regras obrigatórias de segurança e execução

1. **Inspecione antes de modificar.** Analise a estrutura, os arquivos, a arquitetura, a persistência, as migrações, os testes e os fluxos existentes de NEX e XPT.
2. **Git antes de código.** Na Fase 0, inspecione `git status`, branch, commits recentes, diff de arquivos rastreados e arquivos não rastreados. Há possibilidade de existirem alterações anteriores do usuário. Preserve-as.
3. Crie um commit de segurança/checkpoint antes de começar alterações funcionais, conforme o planejamento, mas **não inclua indiscriminadamente alterações preexistentes, backups temporários ou arquivos sem relação**. Revise cada arquivo e o conteúdo staged. Se não for possível criar um checkpoint seguro sem incluir trabalho alheio, não descarte nem misture mudanças: documente o bloqueio e use um método seguro de isolamento/backup aprovado tecnicamente, sem apagar dados.
4. Faça commits pequenos e coerentes por fase ou marco relevante, com mensagens claras. Nunca inclua segredos, tokens, credenciais, arquivos de backup temporários ou dados sensíveis.
5. **Não faça push, publicação, deploy ou migração destrutiva remota sem autorização explícita.** A autorização para executar o plano e usar Remote Desktop não é autorização para publicar.
6. Não apague, resete, reverta ou sobrescreva alterações preexistentes do usuário sem autorização.
7. Não afirme que algo foi salvo, testado, commitado ou concluído sem verificar o resultado real.
8. Não enfraqueça testes, não remova assertions e não esconda erros para fazer a suíte passar.
9. Não use dados de produção para testes destrutivos. Prefira ambiente de teste, fixtures, mocks ou cópia local isolada.
10. Respeite as regras de negócio documentadas. Se a análise revelar conflito entre a implementação atual e o documento, mantenha o requisito aprovado e registre a decisão técnica.
11. Faça alterações mínimas e focadas, preservando funcionalidades não relacionadas.
12. Se encontrar risco de segurança, falha de integridade ou exposição de dados, priorize a contenção e documente o impacto.

## Fase 0 — Inspeção e preparação segura

- Leia integralmente `PLANEJAMENTO_MELHORIAS_NEX_XPT.md`.
- Inspecione Git, branch, status, diff, arquivos não rastreados, histórico recente e estrutura do projeto.
- Mapeie arquitetura e fluxos atuais de NEX e XPT, incluindo criação, atualização, retomada, auditoria, ocorrências, veículos, encerramento, histórico, geração de PDF e compartilhamento.
- Identifique a fonte de verdade para cada dado, a forma de persistência, as chaves/identificadores e os pontos onde podem ocorrer duplicidade ou gravação fora de ordem.
- Inspecione migrações e mecanismos atuais de autorização/imutabilidade.
- Identifique os testes existentes e como executá-los.
- Crie o commit de segurança/checkpoint somente depois de revisar o escopo, sem incorporar mudanças alheias.
- Registre um plano técnico detalhado, dependências, riscos e comandos de teste. Não pare ao produzir o plano: continue para a Fase 1.

**Portão de aprovação:** estado inicial documentado; alterações preexistentes preservadas; checkpoint seguro criado ou alternativa segura documentada; arquitetura e testes compreendidos; nenhum risco impeditivo sem tratamento.

## Fase 1 — Segurança da persistência e salvamento automático

Implemente/corrija, conforme o planejamento:
- Salvamento automático em NEX e XPT.
- Estados visuais reais: **Salvando**, **Salvo** somente após confirmação da persistência e **Erro ao salvar**, com possibilidade de tentar novamente.
- Tratamento de mudanças rápidas, gravações assíncronas, falhas de rede e última alteração pendente.
- Retomada da mesma conferência/operação sem criar registros duplicados.
- Proteção contra duplicidade e concorrência, na camada adequada: identificadores estáveis, atualizações idempotentes, proteção contra duplo toque e reenvio, restrições únicas, transações e controle de concorrência quando suportados pela arquitetura.
- Integridade entre interface, estado local e dados persistidos.

**Testes obrigatórios:** gravação normal; falha de gravação; nova tentativa; perda/recuperação de conexão quando testável; alterações rápidas; fechar e retomar; duplo toque; reenvio da mesma solicitação; concorrência/requisições fora de ordem; comprovação de que não há registros ou somas duplicados.

**Portão de aprovação:** todos os testes relevantes passam; indicador nunca informa “Salvo” antes da confirmação real; nenhuma perda ou duplicidade conhecida.

## Fase 2 — Auditoria XPT e quantidades por rota

Implemente os requisitos documentados:
- Fluxo de auditoria com estados adequados, incluindo **Auditando**, **Concluído** e **Concluído com divergência**, preservando os estados existentes que ainda sejam necessários.
- Ao tocar em **Auditar**, solicitar nome do auditor e quantidades **G (gaiolas), V (gaiolas de Volumoso) e P (paletes)** para a rota selecionada.
- Enquanto em execução, mostrar **Auditando**. Na finalização, persistir os dados e concluir a auditoria.
- Quando o auditor registrar uma ocorrência de divergência, o status deve ser **Concluído com divergência**; sem ocorrência, **Concluído**. Analise a semântica atual de ocorrências pendentes/resolvidas para implementar a regra de forma consistente e não apagar histórico indevidamente.
- Depois de concluída a auditoria da rota, permitir edição por ação explícita. A edição deve atualizar o registro existente, sem criar auditoria duplicada, e recalcular totais/relatórios derivados.
- Na tabela Gaiolas e Auditoria, trocar a coluna **Tipo** por **Qnts**, exibindo G/V/P. Manter o tipo Convencional/VUC nos locais apropriados de cadastro e filtro.
- Renomear a coluna **Código** para **Rota**.
- Atualizar **Auditar em Lote** para respeitar o mesmo fluxo, regras, validações e proteção contra duplicidade.
- Manter os dados G/V/P vinculados à rota, não a uma soma manual duplicada do caminhão.

**Testes obrigatórios:** auditoria sem divergência; auditoria com ocorrência; status correto; finalização; edição pós-conclusão; edição sem duplicação; auditoria em lote; retomada de auditoria; dados persistidos e exibidos corretamente; múltiplas rotas.

**Portão de aprovação:** auditoria individual e em lote consistentes; status e ocorrências coerentes; edição segura; quantidades associadas à rota e sem duplicidade.

## Fase 3 — Consolidação de veículos e interface XPT

- Consolidar em cada caminhão as quantidades das rotas efetivamente atribuídas a ele, uma única vez.
- Calcular **Redes de Proteção = gaiolas convencionais + gaiolas de Volumoso**. Não incluir paletes. Investigue o modelo real para distinguir gaiolas convencionais, VUC e Volumoso; não invente equivalências.
- Estabelecer uma fonte de verdade para as quantidades e redes, evitando campos duplicados divergentes.
- Embora campos de total sejam removidos das abas indicadas no planejamento, garantir que a quantidade de Redes continue sendo calculada e exibida nos resumos e relatórios necessários.
- Implementar o buscador unificado para rota/código, tipo, status de auditoria, auditor e veículo; remover o filtro separado “Auditoria Código”.
- Ajustar as abas Quantidades e Veículos e Carregamento conforme o documento. Antes de remover campos, identificar onde os dados de paletes, redes, horário de saída e foto do hand passarão a ser armazenados/exibidos.
- Remover o texto solicitado e o campo POO em Ocorrências da operação, sem quebrar vínculos internos necessários.
- Corrigir deslocamentos inesperados ao selecionar veículo e ao usar Reabrir/Registrar Resolução.
- Preservar a UX de desktop e otimizar para mobile.

**Testes obrigatórios:** uma rota por veículo; múltiplas rotas; alteração/remoção/reatribuição de rota; garantir que totais não dobrem; fórmula de redes com casos representativos; distinção correta de VUC; filtros combinados; formulários e tabelas em desktop e Android quando disponíveis; ações de ocorrência sem deslocamento inesperado.

**Portão de aprovação:** totais corretos e não duplicados; fórmula de redes validada; campos removidos realocados corretamente; interface estável; testes responsivos aprovados.

## Fase 4 — Pré-encerramento, cancelamento e histórico

- Em NEX e XPT, usar pré-encerramento antes de finalizar, com relatório somente para leitura e ações de copiar, PDF e compartilhar conforme o documento.
- Impedir finalização quando houver gravações pendentes ou falha de persistência.
- Implementar a confirmação de encerramento, com mensagem clara de irreversibilidade.
- Depois de finalizar, marcar a operação como imutável e encaminhar diretamente para uma nova conferência/operação vazia.
- Implementar cancelamento em duas etapas. A segunda confirmação deve identificar a conferência/operação, usando texto como **“Você deseja cancelar [identificação]?”**, e explicar que não poderá ser retomada. Cancelamento não pode ser confundido com finalização.
- Definir com base na arquitetura e no planejamento como cancelamentos são armazenados/auditados ou descartados. Se essa decisão implicar risco real ou conflito de negócio não resolvível, documente e pare somente nesse bloqueio especial.
- A lista “Operações” deve mostrar somente operações abertas/ativas conforme o documento. Identifique e implemente uma forma adequada de consultar encerradas sem misturá-las à lista ativa.
- A imutabilidade deve ser garantida também na camada de persistência/autorização, não somente por esconder botões na UI.

**Testes obrigatórios:** pré-encerramento somente leitura; finalização com gravação pendente bloqueada; cancelamento com duas confirmações; cancelamento sem retomada; finalização imutável; nova operação vazia; histórico/consulta; tentativas de alteração por UI e chamadas de persistência não autorizadas.

**Portão de aprovação:** transições de estado coerentes, dados persistidos antes de finalizar, cancelamento inequívoco, finalizadas imutáveis e histórico acessível.

## Fase 5 — Relatórios, PDF e compartilhamento

- Investigar e corrigir a falha atual de geração de PDF no NEX.
- Implementar ou ajustar os relatórios XPT completo e básico conforme os campos e regras de `PLANEJAMENTO_MELHORIAS_NEX_XPT.md`.
- Os dois relatórios devem ser opções separadas e derivados da mesma fonte consolidada. Não inventar valores ausentes; indicar claramente quando um dado opcional não estiver disponível.
- Relatório completo: incluir detalhes de operação, horários, quantidades, veículos, placas/motoristas, rotas/gaiolas, redes de proteção, resumo da auditoria, status e ocorrências conforme o documento.
- Relatório básico: resumo operacional, quantidades, veículos/rotas, redes e resumo da auditoria, sem lista individual de gaiolas nem detalhamento de ocorrências.
- Não exibir “Operação aberta” em relatório finalizado; respeitar títulos e frase final especificados no planejamento.
- Garantir legibilidade, alinhamento, paginação e uso em desktop/mobile.
- Implementar compartilhamento do arquivo PDF real pelo mecanismo nativo quando suportado, com alternativa de download.
- Erros de geração/compartilhamento devem ser informados e permitir nova tentativa. Falha de PDF não deve bloquear a finalização se os dados estiverem corretamente persistidos.

**Testes obrigatórios:** PDF NEX; PDF XPT completo; PDF XPT básico; conferência de cada campo e cálculo; caracteres especiais; dados opcionais ausentes; múltiplas páginas; visualização em desktop/mobile; arquivo realmente compartilhado/baixado; erro e nova tentativa; consistência com a fonte persistida.

**Portão de aprovação:** PDFs gerados e legíveis, dados corretos, relatórios completos/básicos distintos e compartilhamento/alternativa de download verificados.

## Fase 6 — Validação integrada e regressão

Execute os fluxos completos e cruzados de NEX e XPT:
- Criar, salvar, sair, retomar e editar.
- Auditoria individual e em lote; registrar ocorrência; corrigir auditoria concluída.
- Associar e reatribuir rotas a veículos; conferir G/V/P e redes.
- Pré-encerrar, gerar os dois relatórios, compartilhar, cancelar e finalizar.
- Consultar histórico e confirmar imutabilidade.
- Testar falhas de conexão, gravações concorrentes, duplo toque, reenvios, estados fora de ordem e tentativas de duplicação.
- Executar toda a suíte automatizada disponível (unitária, integração, E2E, lint, build e validações de migração pertinentes ao projeto).
- Testar desktop e Android quando houver ambiente/dispositivo disponível. Se algum teste depender de ambiente indisponível, não marque a fase como 100% aprovada: documente a limitação, execute tudo que for possível e avalie se ela constitui bloqueio especial.
- Investigar e corrigir regressões antes de seguir.

**Portão de aprovação:** todas as suítes aplicáveis passam; nenhum defeito conhecido crítico/alto no escopo; nenhuma perda, duplicidade ou discrepância entre UI, persistência e relatório.

## Fase 7 — Fechamento técnico

- Faça revisão final de todo o diff, status Git, commits e arquivos modificados/não rastreados.
- Confirme que não foram perdidas alterações preexistentes e que nenhum segredo, backup temporário ou artefato indevido foi incluído.
- Execute novamente os testes essenciais após as últimas alterações.
- Registre o que foi feito por fase, os comandos de teste e resultados reais, decisões técnicas, migrações, limitações e pendências.
- Garanta que os commits representem mudanças coerentes e aprovadas.
- Não faça push, deploy ou publicação sem autorização explícita.

**Portão de aprovação:** revisão final concluída; testes pós-alteração aprovados; histórico Git limpo de artefatos indevidos; relatório final preciso, com limitações declaradas.

## Protocolo de teste por fase — obrigatório

Para cada fase, siga esta sequência sem pular etapas:
1. **Análise:** relacione requisitos, código afetado, dependências, riscos e critérios de aceite.
2. **Implementação:** faça mudanças pequenas, com tratamento de erro e preservação de compatibilidade.
3. **Testes direcionados:** execute testes relacionados ao código modificado.
4. **Testes de regressão:** execute testes das áreas que possam ter sido afetadas.
5. **Inspeção:** revise diff, logs, persistência, UI e possíveis efeitos colaterais.
6. **Correção:** resolva falhas e repita testes até aprovação.
7. **Registro:** documente comandos executados, resultados, arquivos alterados e commit correspondente.
8. **Decisão de avanço:** só passe à próxima fase quando os critérios aplicáveis estiverem satisfeitos. Caso contrário, permaneça na fase e continue corrigindo.

Não substitua teste real por inspeção visual ou suposição. Não declare que um teste passou se ele não foi executado. Registre claramente testes indisponíveis e a razão.

## Relatório final obrigatório

Ao concluir a Fase 7, apresente:
- Resumo executivo do que foi implementado.
- Resultado separado de cada fase (0 a 7), com status aprovado/bloqueado e evidências.
- Testes executados, comandos e resultado real de cada suíte.
- Alterações importantes de persistência/migrações, se houver.
- Commits criados (hash e mensagem).
- Lista de arquivos principais modificados.
- Confirmação sobre push/deploy: não executar sem autorização.
- Limitações ou pendências remanescentes, sem omiti-las.

## Instrução final

Comece agora pela Fase 0 na pasta oficial do projeto. Use Remote Desktop conforme autorizado. Leia o documento de planejamento completo, inspecione o estado atual e execute sequencialmente todas as fases até a Fase 7. **Não pare entre fases por conveniência; só pare se surgir uma necessidade especial real.** A qualidade, integridade dos dados e evidência dos testes prevalecem sobre velocidade.