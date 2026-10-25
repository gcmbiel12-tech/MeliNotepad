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