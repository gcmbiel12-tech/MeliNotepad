# Mapa da estrutura - MeliNotepad

## Arquivos de entrada e publicacao
- `index.html`: entrada da aplicacao e referencias aos scripts e estilos.
- `manifest.json`: metadados e icones da PWA.
- `service-worker.js`: cache/offline; a lista de cache deve acompanhar os arquivos carregados pelo HTML.
- `netlify.toml` e `vercel.json`: configuracoes de hospedagem para plataformas diferentes; manter a configuracao da plataforma efetivamente utilizada.
- `.gitignore`: arquivos locais e artefatos que nao devem ser publicados.
- `README.md`: instrucoes gerais e estado atual conhecido.

## Codigo ativo
- `css/`: estilos globais e dos modulos.
- `js/`: aplicacao NEX, XPT, Intervalos, armazenamento, relatorios, scanner e regras de negocio. Os scripts carregados por `index.html` sao dependencias ativas; nao remove-los sem rastrear as referencias.
- `icons/`: icones referenciados pelo HTML e pelo manifesto.
- `supabase/`: configuracao e migracoes SQL. Preservar para a evolucao da persistencia.
- `tests/`: testes unitarios, testes E2E, utilitarios e validacao de seguranca SQL. O `package.json` de testes e separado do app publicado.

## Documentacao de apoio preservada
- `AUDITORIA_INTEGRACAO_SUPABASE.md`, `MAPEAMENTO_PERSISTENCIA_E_BLOQUEIOS.md` e `PLANO_IMPLEMENTACAO_BANCO_DADOS_SUPABASE.md`: decisoes e analise de persistencia/Supabase.
- `PLANEJAMENTO_MELHORIAS_NEX_XPT.md` e `PROMPT_DEV_IMPLEMENTACAO_NEX_XPT.md`: planejamento e roteiro de implementacao; verificar o que ja foi implementado antes de executar novamente.
- `RELATORIO_VALIDACAO_NEX_XPT.md` e `REVISAO_TECNICA_NEX_XPT.md`: registros de validacao/revisao que podem conter observacoes historicas.

## Arquivos locais nao publicados
- `wip/`: prototipos, patches e capturas de trabalho em andamento; ignorados pelo Git e preservados localmente, mas nao fazem parte do app servido.
- `inventario-melinotepad.csv`: inventario local ignorado pelo Git; nao e necessario para executar o app.
- Artefatos regeneraveis como `node_modules/`, `tests/test-results/` e `supabase/.temp/` sao ignorados e nao devem ser versionados.

## Resultado da revisao de limpeza - 26/10/2026
- Os arquivos rastreados da raiz foram revisados. Nao foi identificado arquivo de execucao claramente descartavel: HTML, manifest, service worker, configuracoes de hospedagem e documentacao tem funcao operacional ou de manutencao.
- A pasta `wip/` e o CSV de inventario permanecem locais, ignorados e preservados; nao foram apagados.
- Corrigida a lista de arquivos essenciais do service worker para incluir `js/save-status.js`, ja carregado pelo HTML; cache atualizado para a versao `v7`.
- Os testes unitarios tiveram 60 aprovacoes e 1 falha conhecida. Testes E2E nao foram executados nesta revisao porque o Playwright nao esta instalado na pasta `tests/`.
- Nao excluir documentos de planejamento/revisao sem verificar se as decisoes historicas ainda sao necessarias. Evitar trata-los como especificacao atual sem conferir o codigo.
