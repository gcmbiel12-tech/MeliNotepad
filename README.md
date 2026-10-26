# MeliNotepad

> **Estado da versao principal - 26/10/2026** - resumo da auditoria dos arquivos e testes.
>
> | Area | Estado confirmado |
> |---|---|
> | NEX e Intervalos | Codigo e testes unitarios presentes. A suite de testes unitarios foi executada nesta revisao. |
> | XPT | Codigo operacional, regras, relatorios e testes presentes. Ha uma divergencia em teste unitario sobre o percentual quando nao existem gaiolas convencionais. |
> | QR e scanner | Codigo e testes presentes; leitura com camera fisica nao foi validada nesta revisao. |
> | Persistencia | Os dados operacionais continuam locais no navegador; nao ha sincronizacao entre dispositivos implementada no frontend. |
> | Supabase | Configuracoes, migracoes e documentos de planejamento preservados; nao presumir que o frontend operacional ja sincroniza com o banco. |
> | Testes | 60 de 61 testes unitarios passaram nesta revisao. Testes E2E nao foram executados porque o Playwright nao esta instalado na pasta de testes. |
>
> O repositorio e uma aplicacao web em HTML, CSS e JavaScript. Arquivos de planejamento e revisao foram preservados como referencia; confirme a data e o estado descritos neles antes de usa-los como instrucoes atuais.

Aplicativo web (PWA) para **registrar, acompanhar e finalizar ocorrências** durante a auditoria e conferência de rotas NEX. Substitui o registro manual (papel, mensagens soltas) por uma lista organizada, com categorias fixas, status, filtros, relatório final e exportação em PDF.

Esta é a **primeira versão funcional**: HTML + CSS + JavaScript puro, sem frameworks, sem backend, sem login e sem nuvem. Tudo roda no navegador e os dados ficam salvos no próprio dispositivo (LocalStorage).

---

## Sumário

1. [Estrutura de arquivos](#1-estrutura-de-arquivos)
2. [Como abrir e executar no VS Code](#2-como-abrir-e-executar-no-vs-code)
3. [Como testar localmente](#3-como-testar-localmente)
4. [Como instalar no Android](#4-como-instalar-no-android)
5. [Armazenamento local (LocalStorage)](#5-armazenamento-local-localstorage)
6. [Leitura de código pela câmera](#6-leitura-de-código-pela-câmera)
7. [O relatório de texto (estilo WhatsApp) e o PDF](#7-o-relatório-de-texto-estilo-whatsapp-e-o-pdf)
8. [Início, finalização e status — tudo sob seu controle](#8-início-finalização-e-status--tudo-sob-seu-controle)
9. [Excluir uma sessão do histórico](#9-excluir-uma-sessão-do-histórico)
10. [Backup: exportar e importar](#10-backup-exportar-e-importar)
11. [Atualizar o cache da PWA depois de alterações](#11-atualizar-o-cache-da-pwa-depois-de-alterações)
12. [Testes realizados](#12-testes-realizados)
13. [Limitações conhecidas e melhorias futuras](#13-limitações-conhecidas-e-melhorias-futuras)

---

## 1. Estrutura de arquivos

```

├── index.html              Estrutura da interface (telas, formulários, diálogos)
├── manifest.json            Manifesto da PWA (nome, ícones, cores, modo de exibição)
├── service-worker.js        Cache dos arquivos estáticos para uso offline
├── vercel.json               Configuração opcional (só é usada se você hospedar no Vercel)
├── README.md                 Este arquivo
├── css/
│   └── styles.css           Toda a aparência visual, incluindo a folha de impressão (PDF)
├── js/
│   ├── constants.js         As 5 categorias, status e nomes de chaves — fonte única da verdade
│   ├── utils.js              Formatação de data/hora/número (padrão brasileiro), geração de id
│   ├── storage.js            Única camada que acessa o LocalStorage: salvar/carregar/validar/backup
│   ├── scanner.js            Acesso à câmera e leitura de código de barras/QR Code
│   ├── report.js             Monta o texto do relatório e os dados usados no PDF
│   └── app.js                 Estado da aplicação, eventos de interface e regras de negócio
└── icons/
    ├── icon-192.png          Ícone da PWA (192×192)
    └── icon-512.png          Ícone da PWA (512×512)
```

**Por que não há uma biblioteca de PDF no projeto?** O ambiente de geração deste projeto não tinha acesso à internet para baixar uma biblioteca de terceiros, e isso acabou sendo a escolha mais robusta mesmo: o PDF é gerado pela função nativa `window.print()` do navegador sobre uma folha de impressão dedicada (`#print-area`, preenchida por `app.js`/`report.js`, estilizada em `@media print` dentro de `styles.css`). O usuário escolhe **"Salvar como PDF"** na caixa de diálogo de impressão do próprio navegador. Isso evita depender de rede para baixar algo e não compromete o funcionamento offline da PWA. Veja a seção [7](#7-geração-do-pdf) para detalhes e limitações dessa abordagem.

**Por que não há React/Vue/TypeScript?** Por pedido explícito do escopo deste projeto — o objetivo é uma base simples de rodar e entender, sem etapa de build.

---

## 2. Como abrir e executar no VS Code

1. Abra a pasta MeliNotepad no VS Code (`Arquivo > Abrir Pasta...`).
2. Instale a extensão **Live Server** (de Ritwick Dey), se ainda não tiver — é gratuita, está na aba de Extensões do VS Code.
3. Clique com o botão direito em `index.html` e escolha **"Open with Live Server"** (ou clique em "Go Live" na barra inferior).
4. O navegador abrirá algo como `http://127.0.0.1:5500/index.html`.

Não é necessário `npm install`, build, ou qualquer outra etapa — é HTML/CSS/JS puro.

**Alternativa sem extensão**, usando o terminal integrado do VS Code (requer Python, já instalado na maioria dos sistemas):

Na raiz da pasta do projeto, execute:

```bash
python3 -m http.server 8080
```

E abra `http://localhost:8080/index.html` no navegador.

> **Importante:** abrir `index.html` diretamente como arquivo (`file://...`, duplo clique) funciona parcialmente — o aplicativo roda e salva dados normalmente —, mas a câmera e o service worker (cache offline) **não funcionam** nesse modo, porque exigem um "contexto seguro" (HTTPS ou `http://localhost`). Use sempre um servidor local como os acima durante o desenvolvimento.

---

## 3. Como testar localmente

Com o Live Server (ou `python3 -m http.server`) rodando, siga este roteiro, que corresponde aos critérios de aceitação do projeto:

1. **Iniciar sessão**: informe sacas e pacotes (ex.: 96 e 7007) e clique em "Iniciar conferência". Repare que 7007 aparece formatado como "7.007" assim que a sessão é exibida.
2. **Registrar ocorrência manualmente**: digite um código em "Código do pacote", escolha uma categoria, marque o status (Pendente ou Resolvido — é obrigatório escolher um dos dois, nenhum vem marcado por padrão) e clique em "Registrar ocorrência". O item deve aparecer imediatamente na lista.
3. **Testar código duplicado**: registre o mesmo código de novo (mesma categoria ou outra). Deve aparecer um aviso perguntando se quer continuar — ambos os registros devem existir depois, nenhum é apagado.
4. **Ler pela câmera** (em navegador compatível — veja a seção 6): clique em "Ler pela câmera", aponte para um código de barras ou QR Code. O código lido preenche o campo; confira e clique em "Registrar ocorrência" para salvar.
5. **Marcar como resolvida / reabrir**: use os botões no próprio item da lista.
6. **Editar e excluir**: use "Editar" (corrige código/categoria/observação) e "Excluir" (pede confirmação).
7. **Filtrar**: use os filtros de categoria, status e busca por código, e "Limpar filtros" para voltar a ver tudo.
8. **Atualizar a página** (F5): a sessão e as ocorrências devem continuar lá.
9. **Finalizar**: clique em "Finalizar conferência" — abre um diálogo pedindo a **data e o horário de finalização**, pré-preenchidos com o momento atual mas sempre editáveis (nada é gravado automaticamente). Se houver ocorrência pendente, o mesmo diálogo mostra um aviso, mas não impede finalizar.
10. **Conferir o relatório**: depois de finalizar, você cai na tela de histórico, já na sessão recém-finalizada, com o relatório completo pronto para copiar — só aparecem as categorias que tiveram alguma ocorrência (categorias zeradas não aparecem neste texto; ver seção 7 sobre a diferença para o PDF).
11. **Editar o relatório antes de copiar**: o texto do relatório, na tela de histórico, é uma caixa editável — ajuste à vontade antes de copiar. "Restaurar texto gerado" devolve a versão original a qualquer momento.
12. **Copiar resumo** e **Gerar PDF**: use os botões na tela de histórico (ver seção 7 sobre como o PDF é gerado).
13. **Histórico**: confira que a sessão aparece na lista de "Sessões finalizadas", com os totais corretos. Use "Excluir sessão", dentro do detalhe de uma sessão, para apagar permanentemente uma conferência antiga do histórico (pede confirmação).
14. **Nova sessão sem misturar dados**: inicie uma nova conferência e confirme que a lista de ocorrências começa vazia (sessões não se misturam).
15. **Bloqueio de sessão dupla**: com uma sessão em andamento, clique em "Nova conferência" (dentro do cartão "Sessão") — deve aparecer a opção de finalizar ou descartar a sessão atual, nunca abrir uma segunda sessão por cima.
16. **Backup**: na tela de Histórico, exporte um backup (JSON) e, em seguida, importe esse mesmo arquivo — deve pedir confirmação antes de substituir os dados atuais.

---

## 4. Como instalar no Android

1. Publique os arquivos em um endereço **HTTPS** (GitHub Pages, Netlify, Vercel, um servidor próprio com certificado, etc.) — instalação como app exige HTTPS; `http://localhost` só funciona para testes no próprio computador.
2. Abra esse endereço no **Chrome para Android** (ou outro navegador baseado em Chromium).
3. Toque no menu (⋮) e escolha **"Instalar aplicativo"** ou **"Adicionar à tela inicial"** — o Chrome também pode mostrar esse convite automaticamente, como um banner na parte inferior da tela.
4. Confirme. O ícone do MeliNotepad passa a aparecer na tela inicial do aparelho e abre em modo "standalone" (sem a barra de endereço do navegador).

Isso **não foi testado em um aparelho Android real** durante o desenvolvimento deste projeto (ambiente sem acesso a dispositivos físicos) — o manifesto (`manifest.json`) segue o formato padrão exigido pelo Chrome para instalação (nome, ícones em 192×192 e 512×512, `display: standalone`, cores de tema), mas vale validar a instalação em um aparelho real antes de distribuir o link para a equipe.

---

## 5. Armazenamento local (LocalStorage)

Todos os dados — sessão atual, histórico de sessões finalizadas, ocorrências, horários, status e os totais manuais de sacas/pacotes — ficam guardados **apenas no navegador do próprio dispositivo**, na chave `melinotepad_data_v1` do LocalStorage. Pontos importantes:

- **Não há nuvem, não há sincronização automática entre dispositivos.** Se você usar o MeliNotepad no celular e no computador, são dois conjuntos de dados separados.
- **Limpar os dados de navegação do navegador (histórico, cookies, "dados de sites") apaga os registros.** Modo anônimo/privado também não guarda nada depois que a janela é fechada.
- Para levar dados de um dispositivo para outro, ou para guardar uma cópia de segurança, use **Exportar backup (JSON)** (seção 10).
- Se o conteúdo salvo estiver corrompido (por exemplo, um JSON inválido por alguma falha externa), o aplicativo **não trava**: ele avisa na tela, guarda uma cópia bruta do que conseguiu ler sob outra chave no mesmo LocalStorage (começando com `melinotepad_data_v1_corrompido_`) e continua com uma base vazia.

---

## 6. Leitura de código pela câmera

A leitura automática usa a **BarcodeDetector API**, nativa do navegador (não é uma biblioteca baixada) — por isso o suporte varia bastante conforme o navegador e o sistema operacional:

| Navegador / plataforma | Suporte a leitura automática |
|---|---|
| Chrome / Edge / Samsung Internet no **Android** | Sim |
| Chrome no desktop | Parcial, depende da versão e do sistema operacional |
| Firefox (qualquer plataforma) | Não |
| Safari (macOS/iOS) | Não (recurso existe mas vem desativado por padrão) |

Quando o navegador não suporta, o MeliNotepad mostra um aviso claro e a **digitação manual continua funcionando normalmente** — ela nunca depende da câmera.

Outros pontos:

- **Acessar a câmera exige um "contexto seguro"**: HTTPS, ou `http://localhost` durante o desenvolvimento. Em qualquer outro endereço `http://` (um IP da rede local, por exemplo) o navegador bloqueia o acesso à câmera.
- Na primeira vez, o navegador pede permissão de câmera — se for negada, o aviso na tela orienta a usar a digitação manual.
- Se houver mais de uma câmera no aparelho, um seletor aparece para escolher qual usar.
- Ao detectar um código, a câmera para automaticamente e o código preenche o campo — **nada é salvo sozinho**: confira o valor e clique em "Registrar ocorrência" para confirmar.
- O prefixo `48`, comum em muitos códigos do processo, **não é obrigatório** — qualquer código não vazio é aceito, sem limite de tamanho.

---

## 7. O relatório de texto (estilo WhatsApp) e o PDF

O MeliNotepad gera **dois formatos diferentes** para a mesma conferência, cada um pensado para um uso:

### Resumo de texto — para colar no WhatsApp

É o texto que aparece na caixa editável da tela de Histórico. Pensado especificamente para ser colado numa conversa ou grupo (a ideia original era enviar para o grupo da empresa no WhatsApp), ele:

- Usa `*negrito*`, a sintaxe nativa do WhatsApp — os asteriscos viram negrito de verdade assim que o texto é colado lá (dentro da própria caixa de edição do MeliNotepad eles aparecem como texto puro mesmo, isso é esperado).
- Usa emoji para facilitar escanear rapidamente (🛠️ avariados, 📥 inventário, 🔁 possíveis duplicados, 🔎 não localizados, 🚚 despachar; ✅ resolvido, 🔴 pendente), além de um cabeçalho de marca e linhas divisórias.
- **Só lista categorias que têm pelo menos uma ocorrência.** Uma categoria sem nenhum registro simplesmente não aparece — nada de "Zero" poluindo a mensagem.
- Termina com um resumo (total de ocorrências, quantas resolvidas/pendentes) e o rodapé "Nex Finalizado (HH:MM)".
- **É editável antes de copiar**: ajuste à vontade (corrigir um texto, remover uma linha, adicionar um aviso) — o botão "Copiar resumo" copia exatamente o que estiver na caixa naquele momento. Errou a mão? "Restaurar texto gerado" devolve a versão original a qualquer momento, sem perder o que foi registrado (a edição é só uma conveniência de exibição, nunca altera os dados salvos da sessão).

Gostou do visual, mas quer ajustar emoji, cores de ícone ou a frase de abertura? É só pedir — tudo isso está concentrado em `gerarTextoRelatorio()`, dentro de `js/report.js`.

### PDF — o registro formal e completo

Diferente do resumo de texto, o PDF **sempre mostra as cinco categorias**, com "Zero" nas que não tiveram ocorrência — ele funciona como o registro arquivável/auditável da conferência, então a ausência de uma categoria também é uma informação relevante ali (confirma que ela foi conferida e estava limpa). Como explicado na seção 1, o PDF não usa nenhuma biblioteca de terceiros — é gerado pela função nativa `window.print()` do navegador:

1. O botão "Gerar PDF" (disponível na tela de Histórico, para sessões já finalizadas) monta uma folha de impressão escondida (`#print-area`) com o nome do app, dados da sessão, totais, as 5 categorias (cada uma com a quantidade de ocorrências e a lista de códigos/status/observações, ou "Zero" quando vazia) e o rodapé "Nex Finalizado (HH:MM)".
2. Em seguida chama `window.print()`. O navegador abre a caixa de diálogo de impressão normal do sistema.
3. Na caixa de diálogo, escolha o destino **"Salvar como PDF"** (às vezes chamado de "Microsoft Print to PDF", "Save as PDF" etc., dependendo do navegador/sistema).
4. O título da aba é temporariamente trocado para um nome sugerido (ex.: `MeliNotepad_2026-10-09_a1b2c3d4`, com a data e um identificador da sessão) — a maioria dos navegadores usa esse título como nome de arquivo sugerido na hora de salvar, mas isso **não é garantido em todos os navegadores/sistemas**, então vale conferir o nome antes de salvar.

**Por que PDF e "Copiar resumo" só aparecem depois de finalizar a sessão?** O rodapé do relatório ("Nex Finalizado (HH:MM)") usa o horário de finalização, que agora é sempre digitado manualmente (ver seção 8) — antes de finalizar esse horário simplesmente não existe ainda. Use "Pré-visualizar relatório" (dentro da sessão em andamento) para conferir o conteúdo em texto a qualquer momento antes de finalizar.

A folha de impressão usa papel A4, margens de 16mm/14mm, e cada categoria evita quebrar no meio entre páginas sempre que cabe; relatórios longos continuam corretamente em mais de uma página.

---

## 8. Início, finalização e status — tudo sob seu controle

Por pedido explícito, o MeliNotepad **não preenche sozinho** três coisas que antes eram automáticas:

- **Horário de início** da sessão: continua sendo guardado internamente (serve para ordenar o histórico e aparece como "Data"), mas não é mais mostrado em destaque em lugar nenhum da interface, do relatório ou do PDF.
- **Horário de finalização**: ao clicar em "Finalizar conferência", um diálogo pede a data/hora — vem pré-preenchido com o momento atual só por conveniência, mas **é sempre você quem confirma (ou ajusta) o valor** antes de finalizar. Nada é gravado sozinho.
- **Status da ocorrência**: ao registrar, é obrigatório escolher **Pendente** ou **Resolvido** nos dois botões — nenhum vem marcado por padrão, então uma ocorrência nunca é salva com um status que ninguém escolheu.

## 9. Excluir uma sessão do histórico

Dentro do detalhe de qualquer sessão finalizada (tela de Histórico), o botão **"Excluir sessão"** remove essa conferência permanentemente — pede confirmação (mostrando a data e a quantidade de ocorrências envolvidas) antes de apagar, já que **não há como desfazer** e **não existe backup automático**. Se a sessão tiver dados importantes, exporte um backup (seção 10) antes de excluir.

---

## 10. Backup: exportar e importar

- **Exportar backup**: baixa um arquivo `.json` com a sessão atual (se houver) e todo o histórico de sessões finalizadas. Guarde esse arquivo em local seguro (e-mail, Drive, pendrive) — ele é a única forma de levar os dados para outro dispositivo ou recuperá-los depois de limpar o navegador.
- **Importar backup**: escolha um arquivo `.json` exportado anteriormente. O aplicativo valida o conteúdo antes de qualquer alteração e mostra uma confirmação explícita, porque **a importação substitui todos os dados atuais** (sessão ativa e histórico) pelos dados do arquivo. Um arquivo inválido (JSON corrompido ou fora do formato esperado) é rejeitado com uma mensagem clara, e os dados atuais **não são alterados**.
- **Limitação conhecida:** esta versão só substitui os dados — não existe uma opção de "mesclar" um backup com os dados atuais mantendo os dois históricos juntos. Se precisar combinar dados de dois dispositivos, isso hoje exige um passo manual (copiar sessões entre os arquivos JSON exportados). Uma mesclagem automática fica como melhoria para uma versão futura.

---

## 11. Atualizar o cache da PWA depois de alterações

O `service-worker.js` guarda em cache os arquivos estáticos (HTML, CSS, JS, manifesto, ícones) para o app funcionar offline depois do primeiro carregamento. Esse cache **não guarda nenhum dado operacional** (sessões/ocorrências) — isso vive só no LocalStorage, lido diretamente pela página.

Depois de alterar qualquer arquivo do projeto, para que os usuários já instalados recebam a versão nova:

1. Abra `service-worker.js`.
2. Troque o valor de `CACHE_VERSION` (por exemplo, de `'v1'` para `'v2'`).
3. Publique os arquivos atualizados.

Na próxima vez que o app for aberto, o navegador detecta o novo `service-worker.js`, baixa os arquivos de novo em um cache com nome diferente e descarta o cache antigo automaticamente (lógica já implementada no `activate` do service worker). Em geral isso acontece sozinho; se precisar forçar a atualização imediatamente durante testes, use "Atualização forçada" do navegador (no Chrome: DevTools → Application → Service Workers → "Update" / "Unregister", depois recarregue).

### Problema conhecido e corrigido: "Não é possível acessar esse site" / ERR_FAILED ao abrir pelo ícone instalado

Em uma versão anterior deste projeto, o app instalado (ícone na tela inicial do Android) podia mostrar um erro de rede genérico do Chrome ao ser aberto diretamente — mesmo funcionando normalmente quando acessado pelo link no navegador. A causa: dentro do `service-worker.js`, quando a rede falhava e a página também não estava em cache, o código tentava um retorno alternativo que podia resultar em "nada" (`undefined`) em vez de uma página de verdade — e é exatamente isso que faz o Chrome mostrar esse erro em vez do app. Isso foi corrigido: agora o service worker **sempre** devolve uma resposta de verdade (a página em cache, a página da rede, ou uma página simples avisando "Sem conexão"), nunca fica sem devolver nada. Também deixamos o cache de arquivos mais resistente a falhas pontuais (antes, se um único arquivo não pudesse ser baixado durante a instalação, o cache inteiro falhava silenciosamente).

**Se você já instalou o app antes dessa correção e ainda vir esse erro**, o ícone já instalado ficou com uma versão antiga e "travada" do service worker, que pode não conseguir se autoatualizar sozinha (porque, enquanto o erro acontece, a página nem chega a carregar para disparar a atualização). Para corrigir:

1. Reimplante os arquivos atualizados deste projeto no Vercel (ou onde você hospeda).
2. Abra o **link** normal no Chrome (não pelo ícone instalado) pelo menos uma vez — isso deixa o navegador buscar e ativar a versão corrigida do service worker.
3. Tente o ícone instalado de novo.
4. Se ainda falhar, desinstale o ícone (toque longo → Desinstalar/Remover) e instale de novo pelo menu do Chrome ("Instalar aplicativo") — isso garante que o ícone novo aponte para a versão corrigida desde o início.

---

## 12. Testes realizados

Para ser transparente sobre o que foi efetivamente verificado neste ambiente de desenvolvimento (sem navegador gráfico interativo nem dispositivo Android físico disponível):

**O que foi testado de verdade, de ponta a ponta, com um navegador Chromium real (Playwright) rodando o projeto servido por HTTP:**
- Sintaxe válida de todos os arquivos JavaScript (`node --check`).
- Fluxo completo: iniciar sessão (sem campo de início visível) → registrar ocorrência manual escolhendo o status explicitamente → bloqueio ao tentar registrar sem escolher status → código duplicado (aviso e permissão de continuar) → registro em várias categorias → filtros → marcar resolvida/reabrir → editar → excluir (com confirmação) → atualizar a página e confirmar que os dados persistem.
- Pré-visualização do relatório no novo formato (negrito/emoji estilo WhatsApp) confirmando que uma categoria sem ocorrências **não aparece** no texto.
- Finalização: diálogo pede a data/hora manualmente (valor pré-preenchido, mas sempre editável), com aviso quando há pendentes sem bloquear a finalização.
- Tela de Histórico: campos sem "Início", relatório como caixa de texto editável (edição manual é respeitada pelo "Copiar resumo", e "Restaurar texto gerado" volta à versão original), geração do PDF (conteúdo da folha de impressão — incluindo a confirmação de que o PDF mantém **todas as 5 categorias com "Zero"**, diferente do texto — com a contagem de 1 e depois de 60 ocorrências distribuídas nas categorias, confirmando que a paginação em A4 funciona corretamente para relatórios curtos e longos).
- Exclusão de sessão do histórico (pede confirmação, remove permanentemente, lista volta a ficar vazia).
- Bloqueio de segunda sessão simultânea e descarte de sessão com confirmação.
- Exportação de backup (download real de um `.json` válido) e importação (rejeição de arquivo inválido sem alterar dados existentes; aceitação de arquivo válido após confirmação).
- Recuperação de dados corrompidos no LocalStorage sem travar o app.
- Registro do service worker em contexto seguro (`http://localhost`).
- Ausência de erros no console do navegador durante todo o fluxo acima (31 cenários automatizados, todos passando na última rodada).
- **Lógica do service worker isolada**: um teste à parte simula o ambiente de um service worker (sem depender de um navegador completo) para forçar as quatro combinações de rede disponível/indisponível × arquivo em cache/fora do cache, e confirma que a resposta nunca fica "vazia" (`undefined`) em nenhuma delas — essa checagem especificamente teria pego a causa do problema relatado de "ERR_FAILED" ao abrir o app instalado (ver a seção de solução de problemas em "Atualizar o cache da PWA").
- Inspeção visual (capturas de tela em viewport de celular) para conferir o layout do formulário, do diálogo de finalização e do novo relatório.

Esse roteiro automatizado cobre a maior parte dos 22 critérios de aceitação do escopo original.

**O que não pôde ser testado neste ambiente, e por quê:**
- **Leitura de código real pela câmera**: o Chromium usado nos testes automatizados não expõe a `BarcodeDetector` API neste ambiente (confirmado durante os testes: `typeof window.BarcodeDetector` retorna `"undefined"`), então não há como ler um código de barras de verdade aqui. O que foi validado é o **caminho alternativo**: quando a API não está disponível, o aplicativo mostra o aviso correto e a digitação manual continua funcionando — sem erros de console. A leitura em um navegador/dispositivo com suporte real (Chrome em um celular Android, por exemplo) fica como teste manual recomendado antes do uso em produção (passo 4 do roteiro da seção 3).
- **Instalação como PWA em um aparelho Android físico**: sem dispositivo disponível neste ambiente. Veja a seção 4 para o passo a passo e valide manualmente.
- **Salvar o PDF de fato através da caixa de diálogo de impressão do sistema operacional**: essa caixa de diálogo é nativa do sistema operacional, fora do alcance de automação de navegador. O que foi verificado é tudo que acontece *antes* dela — que `window.print()` é chamado corretamente e que o conteúdo da folha de impressão está completo e correto (confirmado inclusive renderizando a folha em PDF via Chromium e inspecionando as páginas geradas).

Nenhuma funcionalidade foi declarada como testada sem ter sido, de fato, exercitada neste processo.

---

## 13. Limitações conhecidas e melhorias futuras

- **Leitura de código pela câmera** depende de suporte do navegador à `BarcodeDetector` API (ver seção 6) — funciona bem no Chrome/Android, mas não em todos os navegadores. Uma melhoria futura seria embutir uma biblioteca de leitura em JavaScript puro (ex.: baseada em WebAssembly) como alternativa nos navegadores sem suporte nativo, sem depender de rede.
- **PDF via impressão do navegador**: funciona em todos os navegadores modernos, mas o nome de arquivo sugerido nem sempre é respeitado (depende do navegador/sistema operacional) e o usuário precisa escolher manualmente "Salvar como PDF" na caixa de diálogo — não há um botão de "baixar PDF" direto e instantâneo como haveria com uma biblioteca dedicada.
- **Importação de backup só substitui os dados**, não mescla um arquivo importado com o histórico atual (ver seção 10).
- **O campo de data/hora de finalização** usa `<input type="datetime-local">`, nativo do navegador — a aparência do seletor varia entre Chrome, Firefox e Safari, mas o funcionamento é o mesmo em todos.
- **Exclusão de sessão e de ocorrência não têm "lixeira"**: uma vez confirmadas, são permanentes (sem backup automático). Isso é intencional (simplicidade), mas vale reforçar com a equipe antes de usar em produção.
- **Totais de sacas/pacotes podem ser editados** a qualquer momento enquanto a sessão está em andamento (botão "Editar totais"), mas, como pedido no escopo, nunca são recalculados a partir das ocorrências.
- **Edição das ocorrências de uma sessão finalizada não é permitida** — o histórico de ocorrências é somente leitura, por desenho (só o texto do relatório, como explicado na seção 7, pode ser ajustado antes de copiar — isso nunca altera os dados da sessão em si). A sessão inteira pode ser excluída (seção 9), mas não editada. Se for necessário corrigir um registro específico de uma sessão já finalizada no futuro, essa regra precisa ser revista deliberadamente.
- **Sem autenticação, backend ou sincronização em nuvem** — por desenho explícito desta primeira versão. Múltiplos operadores usando aparelhos diferentes terão históricos separados, sem fusão automática.
- Esta versão **não foi testada em um dispositivo Android físico** nem em Safari/iOS — apenas em Chromium automatizado (ver seção 12). Recomenda-se um teste manual rápido em pelo menos um Android real e um iPhone antes de distribuir para a equipe.

---

Dúvidas sobre o funcionamento interno: os comentários nos próprios arquivos (especialmente `js/app.js` e `js/report.js`) explicam as decisões de regra de negócio mais específicas, como a formatação de data no relatório e a lógica de bloqueio de nova sessão.
