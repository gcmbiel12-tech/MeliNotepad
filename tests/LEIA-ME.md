# Testes (somente desenvolvimento)

Nada daqui é necessário para o app funcionar. Não há `package.json` na raiz de propósito
(a Vercel trata o projeto como site estático).

## Unitários (só precisam do Node 20+)
    node --test tests/unit/*.test.js
Cobrem: leitura de QR, regras de Intervalos/XPT, filtros por data operacional, relatórios NEX/Intervalos, semântica Bingo/Faltando, autenticação/renovação de sessão Supabase e chamadas autenticadas de upload/download do Supabase Storage.

## Ponta a ponta (Playwright + Chromium)
    cd tests && npm install && npx playwright install chromium && cd ..
    python3 -m http.server 8743 --bind 127.0.0.1      # em outro terminal, na raiz do projeto
    node tests/e2e/auth-gate.test.js                  # login, acesso, sync, conflito, backup e upload de foto XPT (Auth/Storage simulados)
    node tests/e2e/auth-layout.test.js                # tela de autenticação em 7 larguras (320–1280 px)
    node tests/e2e/nex-abas.test.js                   # Abas NEX, distribuição inicial de sacas, quantidades, ocorrências e relatórios
    node tests/e2e/nex-auditoria-rapida.test.js        # Auditoria rápida por número, rota automática e confirmação
    node tests/e2e/nex-distribuicao-sacas.test.js     # Sequência natural, confirmação/cancelamento e substituição da Optimization
    node tests/e2e/nex-edicao-saca.test.js            # Edição pelo card, renumeração da sequência e preservação das auditorias
    node tests/e2e/nex-regressao.test.js              # NEX, filtros, histórico, backup e impressão PDF
    node tests/e2e/nex-melhorias.test.js              # Bingo/Faltando, duplicidade, pendências e filtros do histórico
    node tests/e2e/nex-cancelamento.test.js          # Cancelamento de operação NEX e preservação no histórico
    node tests/e2e/nex-foto-relatorio.test.js       # Foto, vínculo da ocorrência com rota/saca cadastrada e divergência no relatório
    node tests/e2e/intervalos.test.js                 # Intervalos, filtros, relógio simulado e impressão PDF
    node tests/e2e/qr-scanner.test.js                  # Captura manual NEX, sem leitura automática, com câmera simulada
    node tests/e2e/xpt-camera.test.js                  # Captura manual XPT e preservação da rolagem
    node tests/e2e/responsive-layout.test.js           # NEX/XPT/Intervalos em 8 larguras (320–1440 px)
    node tests/e2e/xpt-auditoria.test.js               # Auditoria XPT, G/V/P, persistência e filtros
    node tests/e2e/xpt-importacao-planilha.test.js     # Importação, substituição, validação e preservação de dados
Use BASE_URL=http://127.0.0.1:PORTA se mudar a porta.

## Supabase local (Docker + Supabase CLI)
    npx supabase migration up --local
    npx supabase db lint --local --fail-on error
    Get-Content -Raw -Encoding UTF8 tests\supabase-security-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
    Get-Content -Raw -Encoding UTF8 tests\supabase-nex-category-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
    Get-Content -Raw -Encoding UTF8 tests\supabase-xpt-schema-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
    Get-Content -Raw -Encoding UTF8 tests\supabase-audit-trigger-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
    Get-Content -Raw -Encoding UTF8 tests\supabase-employee-context-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
    Get-Content -Raw -Encoding UTF8 tests\supabase-snapshot-rpc-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
    Get-Content -Raw -Encoding UTF8 tests\supabase-photo-storage-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
Os scripts SQL usam transações com `ROLLBACK`; execute apenas no banco local descartável. Não executam migrações no Supabase remoto.

## O que estes testes NÃO provam
Câmera real, instalação do PWA, iPhone, sincronização entre aparelhos e o ambiente publicado.
