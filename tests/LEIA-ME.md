# Testes (somente desenvolvimento)

Nada daqui é necessário para o app funcionar. Não há `package.json` na raiz de propósito
(a Vercel trata o projeto como site estático).

## Unitários (só precisam do Node 20+)
    node --test tests/unit/*.test.js
Cobrem: leitura de QR (`qr.test.js`), regras de Intervalos e regras do XPT.

## Ponta a ponta (Playwright + Chromium)
    cd tests && npm install && npx playwright install chromium && cd ..
    python3 -m http.server 8743 --bind 127.0.0.1      # em outro terminal, na raiz do projeto
    node tests/e2e/nex-regressao.test.js              # NEX (31 cenários)
    node tests/e2e/intervalos.test.js                 # Intervalos (18 cenários, relógio simulado)
Use `BASE_URL=http://127.0.0.1:PORTA` se mudar a porta.

## O que estes testes NÃO provam
Câmera real, instalação do PWA, iPhone, sincronização entre aparelhos e o ambiente publicado.
