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
