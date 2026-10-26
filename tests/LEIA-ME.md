# Testes (somente desenvolvimento)

Nada daqui é necessário para o app funcionar. Não há `package.json` na raiz de propósito
(a Vercel trata o projeto como site estático).

## Unitários (só precisam do Node 20+)
    node --test tests/unit/*.test.js
Cobrem: leitura de QR, regras de Intervalos/XPT, filtros por data operacional e construção dos relatórios NEX/Intervalos, incluindo a semântica de Bingo/Faltando.

## Ponta a ponta (Playwright + Chromium)
    cd tests && npm install && npx playwright install chromium && cd ..
    python3 -m http.server 8743 --bind 127.0.0.1      # em outro terminal, na raiz do projeto
    node tests/e2e/auth-gate.test.js                  # login, bloqueio, solicitação e logout (Auth simulado)
    node tests/e2e/auth-layout.test.js                # tela de autenticação em 7 larguras (320–1280 px)
    node tests/e2e/nex-regressao.test.js              # NEX, filtros e impressão PDF
    node tests/e2e/nex-melhorias.test.js              # Bingo/Faltando, duplicidade, pendências e filtros do histórico
    node tests/e2e/intervalos.test.js                 # Intervalos, filtros, relógio simulado e impressão PDF
    node tests/e2e/responsive-layout.test.js           # NEX/XPT/Intervalos em 8 larguras (320–1440 px)
Use `BASE_URL=http://127.0.0.1:PORTA` se mudar a porta.

## Supabase local (Docker + Supabase CLI)
    npx supabase migration up --local
    npx supabase db lint --local --fail-on error
    Get-Content -Raw -Encoding UTF8 tests\supabase-security-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
    Get-Content -Raw -Encoding UTF8 tests\supabase-nex-category-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
    Get-Content -Raw -Encoding UTF8 tests\supabase-xpt-schema-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
    Get-Content -Raw -Encoding UTF8 tests\supabase-audit-trigger-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
    Get-Content -Raw -Encoding UTF8 tests\supabase-employee-context-validation.sql | docker exec -i supabase_db_MeliNotepad psql -U postgres -d postgres -v ON_ERROR_STOP=1
Os scripts SQL usam transações com `ROLLBACK`; execute apenas no banco local descartável. Não executam migrações no Supabase remoto.

## O que estes testes NÃO provam
Câmera real, instalação do PWA, iPhone, sincronização entre aparelhos e o ambiente publicado.
