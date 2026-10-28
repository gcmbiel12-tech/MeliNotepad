# MeliNotepad

Aplicativo web progressivo (PWA) com os módulos **NEX**, **XPT** e **Intervalos**. A aplicação é construída com HTML, CSS e JavaScript, sem framework de frontend.

> **Estado do projeto:** consulte primeiro `Planejamento/PLANO_MESTRE_MELINOTEPAD.md` para decisões e próximos passos e `Planejamento/DIAGNOSTICO_E_HISTORICO_MELINOTEPAD.md` para arquitetura, validações, riscos e histórico técnico. O código e os testes atuais demonstram o comportamento implementado; funcionalidades planejadas não devem ser tratadas como prontas.

## Módulos

- **NEX:** importação de rotas, sacas, auditorias, ocorrências, quantidades e relatórios.
- **XPT:** operações, gaiolas, veículos, quantidades, ocorrências, auditoria, importação de planilhas e fotos.
- **Intervalos:** cadastro de funcionários, controle de intervalos, cálculos de tempo, filtros e relatórios.

A interface operacional e os dados têm responsabilidades separadas por módulo. Não misture estruturas ou persistência entre NEX, XPT e Intervalos sem uma decisão técnica explícita.

## Estrutura principal

- `index.html`: página e ponto de entrada da aplicação.
- `css/`: estilos gerais, módulos e autenticação.
- `js/`: inicialização, interface, regras, armazenamento, relatórios, autenticação e integração.
- `icons/` e `manifest.json`: recursos de instalação PWA.
- `service-worker.js`: cache dos recursos estáticos e suporte offline.
- `supabase/`: configuração e migrações versionadas; a presença desses arquivos **não prova** que a sincronização remota esteja operacional.
- `tests/unit/`: testes unitários.
- `tests/e2e/`: testes automatizados de ponta a ponta com Playwright.
- `tests/*.sql`: verificações de banco, destinadas ao ambiente local descartável.
- `Planejamento/`: plano mestre e diagnóstico/histórico técnico.
- `wip/`: scripts, rascunhos e artefatos de desenvolvimento; não são carregados automaticamente pela aplicação.

## Executar localmente

Não há `package.json` na raiz por decisão de manter a aplicação estática. Com Node.js instalado, inicie um servidor HTTP na raiz do repositório.

Exemplo com Python:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Depois, abra [http://localhost:4173](http://localhost:4173).

Para rodar os testes E2E, o repositório também pode ser servido na porta 8743:

```powershell
python -m http.server 8743 --bind 127.0.0.1
```

Em outro terminal, na raiz do projeto:

```powershell
node --test tests/unit/*.test.js
node tests/e2e/nex-abas.test.js
node tests/e2e/nex-melhorias.test.js
node tests/e2e/nex-regressao.test.js
node tests/e2e/intervalos.test.js
node tests/e2e/qr-scanner.test.js
node tests/e2e/responsive-layout.test.js
node tests/e2e/auth-gate.test.js
node tests/e2e/auth-layout.test.js
node tests/e2e/xpt-auditoria.test.js
node tests/e2e/xpt-importacao-planilha.test.js
```

Os testes E2E precisam do Playwright e do Chromium instalados conforme `tests/LEIA-ME.md`. Para usar outra porta, defina `BASE_URL`, por exemplo `$env:BASE_URL='http://127.0.0.1:9000'`.

## Dados, autenticação e Supabase

- A persistência local e os mecanismos de armazenamento de cada módulo devem ser avaliados conforme o código e os testes atuais.
- Os testes de autenticação, sincronização e armazenamento de fotos simulam partes do serviço remoto. **Eles não comprovam uma sincronização real com o Supabase remoto.**
- Os testes SQL descritos em `tests/LEIA-ME.md` são para um banco local descartável; não os execute contra produção.
- Não faça migrações remotas, alterações de dados, publicação ou exclusões destrutivas como parte de uma limpeza de código sem autorização explícita.

## Atualização do cache PWA

Quando recursos estáticos mudarem, confira as versões de cache em `service-worker.js` e as versões de URL dos arquivos referenciados em `index.html`, conforme necessário. Em teste local, recarregue a página sem cache se o navegador continuar exibindo recursos antigos. Consulte o diagnóstico técnico para o histórico e as limitações conhecidas do service worker.

## Limites das validações

Os testes automatizados cobrem fluxos simulados no navegador, regras de negócio e alguns tamanhos de tela. Eles não substituem a validação de câmera em aparelho físico, instalação PWA em Android/iOS, sincronização remota real nem verificação no ambiente publicado. Registre explicitamente qualquer validação que não foi executada.

## Documentação de referência

1. `Planejamento/PLANO_MESTRE_MELINOTEPAD.md` — decisões, escopo, prioridades e planejamento.
2. `Planejamento/DIAGNOSTICO_E_HISTORICO_MELINOTEPAD.md` — arquitetura, auditorias, resultados de testes, riscos e histórico das alterações.

Ao implementar mudanças, preserve o estado preexistente do Git, mantenha os módulos isolados, execute os testes pertinentes e atualize esses documentos quando houver decisões ou mudanças técnicas relevantes.
