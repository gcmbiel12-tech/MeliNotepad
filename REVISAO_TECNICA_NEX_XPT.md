# Revisão técnica — MeliNotepad (NEX, XPT e Supabase)

**Data:** 2026-10-25  
**Escopo:** leitura do planejamento, documentação, código de regras e testes existentes. Nenhum dado operacional foi alterado; nenhum deploy, push ou migração remota foi executado.

## 1. Estado confirmado

- A suíte unitária atual passou: **61/61 testes**.
- A sintaxe dos principais arquivos JavaScript foi validada e `git diff --check` não apontou problemas.
- O XPT já separa regras puras em `js/xpt-regras.js`, com testes de quantidades, auditoria, rotas, veículos e ocorrências. Essa separação deve ser preservada.
- O armazenamento atual do XPT/Intervalos é local (LocalStorage); as fotos do XPT ficam no IndexedDB. Isso não é sincronização em nuvem.
- O banco Supabase tem estrutura inicial de identidade/NEX/Intervalos, mas ainda não tem modelo operacional XPT nem cliente conectado no frontend. As tabelas remotas permanecem fechadas por segurança.
- Há um arquivo parcial em `wip/xpt-tela-parcial.js`; ele não é carregado pelo app e não deve ser tratado como implementação pronta.
- O Git está em `main`, sem alterações rastreadas pendentes no momento da inspeção; há documentos, configurações, migração e backups não rastreados. Esses arquivos devem ser revisados individualmente antes de qualquer checkpoint/commit, não adicionados em bloco.

## 2. Pontos que precisam ser resolvidos antes de mudanças maiores

### A. Quantidades G/V/P e tipo de gaiola
O código atual guarda G/V/P na auditoria da gaiola/rota e calcula redes como G + V, excluindo P. Também exclui VUC dos totais/percentuais de auditoria. O plano deve distinguir explicitamente:
- quantidade de gaiolas convencionais;
- quantidade de gaiolas de volumoso;
- quantidade de VUCs;
- paletes;
- redes de proteção calculadas por veículo.

**Recomendação:** manter G/V/P vinculados à rota, calcular redes a partir das quantidades auditadas das rotas atribuídas ao veículo e testar separadamente cenários com gaiola convencional, volumoso, VUC, rota sem auditoria e rota movida entre veículos. Não usar campos legados de redes como fonte de verdade.

### B. Auditoria e ocorrências
O status “Concluído com divergência” é derivado das ocorrências pendentes vinculadas à gaiola. Uma ocorrência resolvida deixa de marcar divergência no status calculado, embora permaneça no histórico.

**Recomendação:** preservar histórico de resolução/reabertura, documentar que o status representa divergências atualmente pendentes e garantir que o relatório histórico final não seja silenciosamente recalculado após encerramento. Se for necessário refletir correções posteriores, isso deve ser uma revisão explícita/versionada, não alteração retroativa do relatório fechado.

### C. Salvamento automático
O módulo de status já contempla “salvando/salvo/erro” e tentativa de repetição; `ModStore` também mantém uma mutação pendente se o LocalStorage falhar. Isso é uma base útil, mas não garante sozinho consistência entre duas abas/dispositivos nem persistência no Supabase.

**Recomendação:** primeiro fechar e testar a semântica local (fila/debounce, última gravação, retomada, falha e repetição idempotente); depois integrar nuvem com identificadores estáveis, controle de versão/conflito e política de autorização. O indicador “Salvo” deve sempre significar sucesso no destino ativo claramente indicado.

### D. Finalização e imutabilidade
Hoje os estados de operação distinguem carregamento encerrado de operação encerrada. Essa distinção é importante e deve continuar. A imutabilidade não pode depender só de esconder botões: as funções de mutação devem rejeitar alterações em operações finalizadas.

**Recomendação:** criar testes de regra que tentem alterar quantidades, gaiolas, veículos, auditoria e ocorrências após finalização; todos devem ser recusados. A finalização deve falhar se houver gravação pendente.

### E. Campos que serão removidos das abas
Paletes, redes, horário de saída e foto do HAND serão removidos de áreas atuais, mas o local de destino ainda precisa ser definido. Remover os campos da interface antes de definir e testar seu destino pode ocultar dados já existentes.

**Recomendação:** primeiro mapear todos os leitores/escritores e relatórios desses campos; manter leitura de dados legados; migrar a interface só depois de definir a fonte oficial. Não apagar propriedades antigas automaticamente.

### F. PDF e compartilhamento
O PDF do NEX usa a caixa de impressão do navegador; isso não equivale a gerar/baixar um arquivo PDF automaticamente. O compartilhamento nativo de arquivo depende do suporte do navegador/dispositivo.

**Recomendação:** testar geração do conteúdo, impressão e compartilhamento separadamente. Se for adotada uma biblioteca para baixar PDF diretamente, avaliar tamanho, funcionamento offline, quebras de página e suporte móvel antes de adicioná-la. A falha do PDF não deve bloquear o encerramento quando os dados estiverem salvos.

### G. Supabase e migração de dados
Não ativar consultas de frontend às tabelas atuais sem policies/grants de menor privilégio. Não colocar `service_role` no navegador. A integração deve começar com autenticação, autorização por papel e modelo XPT revisado.

**Recomendação:** fazer a integração em etapas: cliente público e Auth; teste de acesso; modelo XPT; persistência/sincronização com conflitos; migração piloto; reconciliação; só então considerar a nuvem como fonte operacional. Manter LocalStorage/IndexedDB até confirmar que nenhum dado foi perdido e que a recuperação funciona.

## 3. Ordem de execução sugerida

1. Fechar as regras de auditoria, redes, VUC/volumosos e campos removidos.
2. Implementar a experiência de auditoria XPT (individual e em lote), filtros e correções de deslocamento de tela.
3. Fortalecer ciclo de vida da operação: autosave, retomada, pré-encerramento, cancelamento, finalização imutável.
4. Consolidar relatórios completo/básico e PDF/compartilhamento.
5. Corrigir/validar o PDF do NEX e os estados de conferência.
6. Modelar XPT no Supabase e implementar autorização/autenticação antes da sincronização.
7. Executar regressão desktop/mobile e validar recuperação de falhas.

Cada fase deve ter testes próprios e não deve começar a fase seguinte enquanto os critérios de aceite não passarem.

## 4. Validações desta revisão

- `npm run unit`: **61 passaram, 0 falharam**.
- `node --check`: `js/xpt.js`, `js/xpt-regras.js`, `js/storage.js`, `js/modulo-store.js` sem erro de sintaxe.
- `git diff --check`: passou.
- Nenhuma alteração funcional, migração remota, publicação ou push foi executado nesta revisão.

## 5. Recomendação final

A principal melhoria agora não é conectar imediatamente o Supabase nem reescrever o XPT. É fechar as regras de origem dos dados e de encerramento, então implementar por fases com testes. Isso reduz o risco de duplicar quantidades, perder fotos/dados locais ou criar relatórios que mudem depois de encerrados.
