(function () {
  'use strict';
  var nav = document.getElementById('nex-abas-principais');
  if (!nav) return;
  var tabs = Array.prototype.slice.call(nav.querySelectorAll('[data-nex-tab]'));
  var panels = {
    gaiolas: document.getElementById('nex-tab-gaiolas'),
    ocorrencias: document.getElementById('nex-tab-ocorrencias'),
    quantidades: document.getElementById('nex-tab-quantidades'),
    relatorios: document.getElementById('nex-tab-relatorios')
  };
  var historyView = document.getElementById('view-historico');
  var activeSession = document.getElementById('painel-sessao-ativa');
  var sessionStart = document.getElementById('painel-inicio');
  var secondaryNav = document.querySelector('#nex-tab-gaiolas > nav[aria-label="Navegação do NEX"]');
  var landing = document.createElement('section');
  landing.id = 'nex-tela-iniciar-operacao';
  landing.className = 'nex-tela-iniciar-operacao';
  var landingTitle = document.createElement('h2');
  landingTitle.textContent = 'NEX — Operação';
  var landingText = document.createElement('p');
  landingText.className = 'texto-apoio';
  landingText.textContent = 'Prepare e inicie uma operação para acessar as gaiolas, ocorrências, quantidades e relatórios.';
  landing.appendChild(landingTitle);
  landing.appendChild(landingText);
  nav.parentNode.insertBefore(landing, nav);
  if (secondaryNav) landing.appendChild(secondaryNav);
  if (sessionStart) landing.appendChild(sessionStart);

  function sectionFor(id) {
    var node = document.getElementById(id);
    return node ? node.closest('section') : null;
  }
  function move(node, target) {
    if (node && target && node.parentNode !== target) target.appendChild(node);
  }

  // Quantidades no NEX é um resumo operacional: preserva totais estimados e mostra
  // separadamente os cadastros/auditorias reais, sem somar estimativas como registros.
  var quantitySummary = document.createElement('section');
  quantitySummary.id = 'nex-resumo-quantidades';
  quantitySummary.className = 'cartao nex-resumo-quantidades';
  quantitySummary.setAttribute('aria-labelledby', 'nex-resumo-quantidades-titulo');
  var quantityHeader = document.createElement('div');
  quantityHeader.className = 'cartao__cabecalho';
  var quantityTitle = document.createElement('h2');
  quantityTitle.id = 'nex-resumo-quantidades-titulo';
  quantityTitle.textContent = 'Resumo da conferência';
  quantityHeader.appendChild(quantityTitle);
  quantitySummary.appendChild(quantityHeader);
  var quantityDescription = criarElemento('p', 'texto-apoio nex-quantidades-descricao',
    'Os totais da operação são estimativas da planilha ou valores informados no início. As sacas cadastradas e suas auditorias são contagens individuais, separadas desses totais.');
  quantitySummary.appendChild(quantityDescription);
  var quantityCounters = document.createElement('div');
  quantityCounters.id = 'nex-quantidades-contadores';
  quantityCounters.className = 'contadores nex-quantidades-contadores';
  quantityCounters.setAttribute('role', 'group');
  quantityCounters.setAttribute('aria-label', 'Resumo de quantidades e auditorias');
  quantitySummary.appendChild(quantityCounters);
  var quantityNote = criarElemento('p', 'texto-apoio nex-quantidades-nota',
    'Para conferir ou corrigir os totais, use os controles da sessão abaixo. Para auditar uma saca, abra Gaiolas e Auditoria.');
  quantitySummary.appendChild(quantityNote);
  panels.quantidades.insertBefore(quantitySummary, panels.quantidades.firstChild);

  // Importação acessível também durante a operação, sem substituir a importação inicial.
  var activeImport = document.createElement('section');
  activeImport.id = 'nex-importacao-quantidades';
  activeImport.className = 'cartao nex-importacao nex-importacao--ativa';
  activeImport.setAttribute('aria-labelledby', 'nex-importacao-quantidades-titulo');
  var activeImportTitle = criarElemento('h2', '', 'Importar planilha');
  activeImportTitle.id = 'nex-importacao-quantidades-titulo';
  activeImport.appendChild(activeImportTitle);
  activeImport.appendChild(criarElemento('p', 'texto-apoio', 'Atualize os totais estimados e os dados das rotas durante a operação. As sacas individuais e o histórico de auditorias serão preservados. Rotas que não estiverem na nova planilha não serão removidas.'));
  var activeImportInput = document.createElement('input');
  activeImportInput.type = 'file'; activeImportInput.accept = '.xlsx,.csv'; activeImportInput.hidden = true;
  activeImportInput.id = 'nex-arquivo-planilha-quantidades';
  var activeImportArea = criarElemento('div', 'nex-importacao__area');
  activeImportArea.tabIndex = 0; activeImportArea.setAttribute('role', 'region');
  activeImportArea.setAttribute('aria-label', 'Selecionar ou arrastar uma planilha para atualizar as quantidades');
  activeImportArea.appendChild(criarElemento('span', 'nex-importacao__icone', '⇧'));
  var activeImportButton = document.createElement('button');
  activeImportButton.type = 'button'; activeImportButton.className = 'botao botao--primario';
  activeImportButton.textContent = 'Selecionar planilha para atualizar';
  activeImportArea.appendChild(activeImportButton);
  activeImportArea.appendChild(criarElemento('p', 'texto-apoio', 'Formatos aceitos: Excel (.xlsx) ou CSV (.csv). Também é possível arrastar o arquivo para esta área.'));
  var activeImportStatus = criarElemento('div', 'nex-importacao__estado');
  activeImportStatus.id = 'nex-importacao-quantidades-estado'; activeImportStatus.setAttribute('aria-live', 'polite');
  activeImport.appendChild(activeImportInput); activeImport.appendChild(activeImportArea); activeImport.appendChild(activeImportStatus);
  panels.quantidades.insertBefore(activeImport, quantitySummary.nextSibling);
  function importarPlanilhaAtiva(arquivo) {
    if (!arquivo) return;
    var extensao = String(arquivo.name || '').split('.').pop().toLowerCase();
    if (['xlsx', 'csv'].indexOf(extensao) < 0) { activeImportStatus.textContent = 'Formato não suportado. Selecione um arquivo .xlsx ou .csv.'; return; }
    if (!arquivo.size || arquivo.size > 20 * 1024 * 1024) { activeImportStatus.textContent = 'O arquivo está vazio ou excede o limite de 20 MB.'; return; }
    if (!window.confirm('Importar "' + arquivo.name + '" para atualizar os totais e as rotas desta operação? As sacas individuais, auditorias e rotas ausentes da planilha serão preservadas.')) { activeImportInput.value = ''; return; }
    var api = window.MeliNotepad && window.MeliNotepad.NexOperations;
    if (!api || typeof api.importPlanilha !== 'function') { activeImportStatus.textContent = 'A função de importação não está disponível. Atualize a página e tente novamente.'; return; }
    activeImportButton.disabled = true; activeImportStatus.textContent = 'Lendo e validando a planilha…';
    api.importPlanilha(arquivo).then(function (resultado) {
      activeImportStatus.textContent = 'Importação concluída: ' + resultado.rotas + ' rota(s), ' + resultado.sacas + ' sacas e ' + resultado.pacotes + ' pacotes estimados. Cadastros individuais e auditorias preservados.';
      activeImportInput.value = '';
      renderRotas();
    }).catch(function (erro) {
      activeImportStatus.textContent = erro && erro.message ? erro.message : 'Não foi possível importar a planilha.';
      activeImportInput.value = '';
    }).then(function () { activeImportButton.disabled = false; });
  }
  activeImportButton.addEventListener('click', function () { activeImportInput.click(); });
  activeImportArea.addEventListener('click', function (e) { if (e.target === activeImportArea || e.target.tagName === 'P' || e.target.tagName === 'SPAN') activeImportInput.click(); });
  activeImportArea.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activeImportInput.click(); } });
  activeImportInput.addEventListener('change', function () { importarPlanilhaAtiva(activeImportInput.files && activeImportInput.files[0]); });
  activeImportArea.addEventListener('dragover', function (e) { e.preventDefault(); activeImportArea.classList.add('is-arrastando'); });
  activeImportArea.addEventListener('dragleave', function () { activeImportArea.classList.remove('is-arrastando'); });
  activeImportArea.addEventListener('drop', function (e) { e.preventDefault(); activeImportArea.classList.remove('is-arrastando'); importarPlanilhaAtiva(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });

  move(sectionFor('titulo-sessao'), panels.quantidades);
  move(activeSession, panels.ocorrencias);

  function renderQuantidades() {
    while (quantityCounters.firstChild) quantityCounters.removeChild(quantityCounters.firstChild);
    var api = window.MeliNotepad && window.MeliNotepad.NexOperations;
    var sessao = api && api.getCurrentSession ? api.getCurrentSession() : null;
    var rotas = sessao && Array.isArray(sessao.rotasHybrid) ? sessao.rotasHybrid : [];
    var sacas = [], auditadas = 0, divergencias = 0;
    rotas.forEach(function (rota) {
      (rota.sacasIndividuais || []).forEach(function (saca) {
        sacas.push(saca);
        var ultima = (saca.auditorias || []).slice(-1)[0];
        if (ultima) {
          auditadas++;
          if (ultima.status === 'divergencia') divergencias++;
        }
      });
    });
    var pendentes = Math.max(0, sacas.length - auditadas);
    var ocorrenciasTotal = document.getElementById('contagem-total');
    var ocorrenciasPendentes = document.getElementById('contagem-pendente');
    var itens = [
      [document.getElementById('info-sacas') ? document.getElementById('info-sacas').textContent : '—', 'Sacas estimadas'],
      [document.getElementById('info-pacotes') ? document.getElementById('info-pacotes').textContent : '—', 'Pacotes estimados'],
      [String(rotas.length), 'Rotas cadastradas'],
      [String(sacas.length), 'Sacas individuais'],
      [String(pendentes), 'Sacas pendentes'],
      [String(divergencias), 'Com divergência']
    ];
    itens.forEach(function (item) {
      var counter = criarElemento('div', 'contador');
      counter.appendChild(criarElemento('span', 'contador__valor', item[0] || '—'));
      counter.appendChild(criarElemento('span', 'contador__rotulo', item[1]));
      quantityCounters.appendChild(counter);
    });
    quantityDescription.textContent = 'Totais estimados da operação não representam cadastros individuais. ' +
      sacas.length + ' saca(s) individual(is) cadastrada(s), ' + auditadas + ' auditada(s) e ' + pendentes + ' pendente(s).';
    if (ocorrenciasTotal && ocorrenciasPendentes) {
      quantityNote.textContent = 'Ocorrências da sessão: ' + ocorrenciasTotal.textContent + ' no total, ' +
        ocorrenciasPendentes.textContent + ' pendente(s). Para registrar ou resolver ocorrências, use a aba Ocorrências.';
    } else {
      quantityNote.textContent = 'Para conferir ou corrigir os totais, use os controles da sessão abaixo. Para auditar uma saca, abra Gaiolas e Auditoria.';
    }
  }

  // A aba apresenta rotas recolhidas; as sacas e suas auditorias aparecem ao expandir cada rota.
  var routePanel = document.createElement('section');
  routePanel.id = 'nex-rotas-auditoria';
  routePanel.className = 'cartao';
  routePanel.setAttribute('aria-labelledby', 'nex-rotas-auditoria-titulo');
  var routeHeading = document.createElement('h2');
  routeHeading.id = 'nex-rotas-auditoria-titulo';
  routeHeading.textContent = 'Rotas e auditorias';
  var routeSummary = document.createElement('p');
  routeSummary.className = 'texto-apoio';
  routeSummary.id = 'nex-rotas-auditoria-resumo';
  routePanel.appendChild(routeHeading);
  routePanel.appendChild(routeSummary);
  var routeCounters = document.createElement('div');
  routeCounters.className = 'contadores nex-rotas-contadores';
  routeCounters.setAttribute('role', 'group');
  routeCounters.setAttribute('aria-label', 'Resumo de rotas e auditorias individuais de sacas');
  routePanel.appendChild(routeCounters);
  var filtrosRotas = criarElemento('div', 'nex-filtros-rotas');
  var buscaSaca = document.createElement('input');
  buscaSaca.type = 'search'; buscaSaca.className = 'nex-busca-sacas'; buscaSaca.placeholder = 'Buscar rota ou número da saca...'; buscaSaca.setAttribute('aria-label', 'Buscar rota ou número da saca');
  filtrosRotas.appendChild(buscaSaca);
  var filtroStatus = criarElemento('div', 'nex-filtros-status');
  var statusSelecionado = 'todas';
  [['todas', 'Todas'], ['pendente', 'Pendentes'], ['concluida', 'Concluídas'], ['divergencia', 'Divergências']].forEach(function (f) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'nex-filtro-status'; b.textContent = f[1]; b.dataset.status = f[0]; b.setAttribute('aria-pressed', String(f[0] === statusSelecionado));
    b.addEventListener('click', function () { statusSelecionado = f[0]; filtroStatus.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-ativo', x.dataset.status === statusSelecionado); x.setAttribute('aria-pressed', String(x.dataset.status === statusSelecionado)); }); renderRotas(); });
    filtroStatus.appendChild(b);
  });
  filtrosRotas.appendChild(filtroStatus);
  buscaSaca.addEventListener('input', renderRotas);
  routePanel.appendChild(filtrosRotas);
  var routeList = document.createElement('div');
  routeList.id = 'nex-lista-rotas';
  routeList.className = 'nex-lista-rotas';
  routePanel.appendChild(routeList);
  panels.gaiolas.appendChild(routePanel);

  var finalizeSection = sectionFor('titulo-finalizar');
  var finalizeWrap = null;
  if (finalizeSection && panels.relatorios) {
    finalizeWrap = document.createElement('div');
    finalizeWrap.id = 'nex-relatorios-sessao';
    panels.relatorios.appendChild(finalizeWrap);
    move(finalizeSection, finalizeWrap);
  }

  var landingHistory = document.createElement('div');
  landingHistory.id = 'nex-historico-inicial';
  landingHistory.hidden = true;
  landing.appendChild(landingHistory);

  function atualizarNavegacaoInicial(mostrarHistorico) {
    if (sessionStart) sessionStart.hidden = !!mostrarHistorico;
    if (historyView && !activeSession || historyView && activeSession.hidden) {
      move(historyView, landingHistory);
      landingHistory.hidden = !mostrarHistorico;
      historyView.hidden = !mostrarHistorico;
    }
    if (secondaryNav) {
      var current = document.getElementById('btn-ver-sessao');
      var history = document.getElementById('btn-ver-historico');
      if (current) { current.classList.toggle('is-ativo', !mostrarHistorico); current.setAttribute('aria-pressed', String(!mostrarHistorico)); }
      if (history) { history.classList.toggle('is-ativo', !!mostrarHistorico); history.setAttribute('aria-pressed', String(!!mostrarHistorico)); }
    }
  }

  function criarElemento(tag, className, texto) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (texto != null) node.textContent = texto;
    return node;
  }

  var rotasAbertas = Object.create(null);

  function criarDialogoNex(titulo, descricao, confirmarTexto, montar, salvar) {
    var antigo = document.getElementById('nex-dialogo-operacao');
    if (antigo) antigo.remove();
    var dlg = document.createElement('dialog');
    dlg.id = 'nex-dialogo-operacao';
    dlg.className = 'nex-dialogo';
    var form = criarElemento('form', 'nex-dialogo__form');
    form.noValidate = true;
    var cab = criarElemento('header', 'nex-dialogo__cabecalho');
    var titulos = criarElemento('div', 'nex-dialogo__titulo-wrap');
    titulos.appendChild(criarElemento('p', 'nex-dialogo__sobretitulo', 'NEX · OPERAÇÃO'));
    titulos.appendChild(criarElemento('h2', 'nex-dialogo__titulo', titulo));
    cab.appendChild(titulos);
    var fechar = criarElemento('button', 'nex-dialogo__fechar', '×');
    fechar.type = 'button'; fechar.setAttribute('aria-label', 'Fechar');
    fechar.addEventListener('click', function () { dlg.close(); });
    cab.appendChild(fechar); form.appendChild(cab);
    form.appendChild(criarElemento('p', 'nex-dialogo__descricao', descricao));
    var corpo = criarElemento('div', 'nex-dialogo__corpo'); form.appendChild(corpo);
    var erro = criarElemento('p', 'nex-dialogo__erro'); erro.hidden = true; erro.setAttribute('role', 'alert'); form.appendChild(erro);
    var acoes = criarElemento('footer', 'nex-dialogo__acoes');
    var cancelar = criarElemento('button', 'botao botao--secundario', 'Cancelar'); cancelar.type = 'button'; cancelar.addEventListener('click', function () { dlg.close(); });
    var salvarBtn = criarElemento('button', 'botao botao--primario', confirmarTexto); salvarBtn.type = 'submit';
    acoes.appendChild(cancelar); acoes.appendChild(salvarBtn); form.appendChild(acoes); dlg.appendChild(form); document.body.appendChild(dlg);
    var campos = montar(corpo);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); erro.hidden = true; erro.textContent = '';
      var resultado = salvar(campos, erro);
      if (resultado) dlg.close();
    });
    dlg.addEventListener('close', function () { dlg.remove(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.showModal();
    if (campos.foco) campos.foco.focus();
    return { erro: erro, corpo: corpo };
  }

  function abrirDialogoNovaRota(api) {
    criarDialogoNex('Adicionar rota', 'Cadastre manualmente uma rota para esta operação. Depois, você poderá vincular uma ou várias sacas.', 'Adicionar rota',
      function (corpo) {
        var campo = criarElemento('label', 'nex-campo');
        campo.appendChild(criarElemento('span', 'nex-campo__rotulo', 'Identificação da rota'));
        var input = document.createElement('input'); input.className = 'nex-campo__input'; input.placeholder = 'Ex.: J1_AM1'; input.maxLength = 80; input.required = true; input.autocomplete = 'off';
        campo.appendChild(input); campo.appendChild(criarElemento('span', 'nex-campo__ajuda', 'Use o código da rota como ele deve aparecer na lista.'));
        corpo.appendChild(campo); return { foco: input, input: input };
      },
      function (campos, erro) {
        var nome = campos.input.value.trim();
        if (!nome) { erro.textContent = 'Informe a identificação da rota.'; erro.hidden = false; campos.input.focus(); return false; }
        var res = api.addRoute(nome);
        if (!res.sucesso) { erro.textContent = res.erro; erro.hidden = false; campos.input.focus(); return false; }
        rotasAbertas[nome] = true; renderRotas(); return true;
      });
  }

  function expandirSacas(texto) {
    var tokens = String(texto || '').split(/[\n,;\t ]+/).filter(Boolean), numeros = [], erros = [];
    tokens.forEach(function (token) {
      var partes = token.split('-');
      if (partes.length > 2 || !partes.every(function (p) { return /^\d+$/.test(p); })) { erros.push('Entrada inválida: ' + token); return; }
      var inicio = Number(partes[0]), fim = partes.length === 2 ? Number(partes[1]) : inicio;
      if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fim) || fim < inicio) { erros.push('Intervalo inválido: ' + token); return; }
      if (fim - inicio > 499) { erros.push('O intervalo ' + token + ' excede 500 sacas.'); return; }
      for (var n = inicio; n <= fim; n++) numeros.push(String(n));
    });
    numeros.sort(function (a, b) { return Number(a) - Number(b); });
    return { numeros: numeros, erros: erros };
  }

  function abrirDialogoSaca(api, nomeRota) {
    criarDialogoNex('Adicionar uma saca', 'Vincule uma saca individualmente à rota ' + nomeRota + '.', 'Adicionar saca',
      function (corpo) {
        var campo = criarElemento('label', 'nex-campo');
        campo.appendChild(criarElemento('span', 'nex-campo__rotulo', 'Número da saca'));
        var input = document.createElement('input'); input.className = 'nex-campo__input'; input.inputMode = 'numeric'; input.pattern = '[0-9]+'; input.placeholder = 'Ex.: 60'; input.autocomplete = 'off';
        campo.appendChild(input); campo.appendChild(criarElemento('span', 'nex-campo__ajuda', 'Somente números. O sistema impede cadastrar o mesmo número em mais de uma rota.')); corpo.appendChild(campo);
        return { foco: input, input: input };
      },
      function (campos, erro) {
        var numero = campos.input.value.trim();
        if (!/^\d+$/.test(numero)) { erro.textContent = 'Informe um número de saca usando apenas dígitos.'; erro.hidden = false; campos.input.focus(); return false; }
        numero = String(Number(numero));
        var res = api.addSaca(nomeRota, numero);
        if (!res.sucesso) { erro.textContent = res.erro; erro.hidden = false; campos.input.focus(); return false; }
        rotasAbertas[nomeRota] = true; renderRotas(); return true;
      });
  }

  function abrirDialogoSacasLote(api, nomeRota) {
    criarDialogoNex('Adicionar sacas em lote', 'Rota: ' + nomeRota + '. Informe números individuais ou intervalos. Cada saca será validada contra os cadastros existentes.', 'Cadastrar sacas',
      function (corpo) {
        var campo = criarElemento('label', 'nex-campo');
        campo.appendChild(criarElemento('span', 'nex-campo__rotulo', 'Números das sacas'));
        var area = document.createElement('textarea'); area.className = 'nex-campo__textarea'; area.rows = 5; area.placeholder = '60-65\n72\n80, 81, 90';
        campo.appendChild(area); campo.appendChild(criarElemento('span', 'nex-campo__ajuda', 'Separe por vírgula, espaço ou linha. Exemplo: 60-65 cria as sacas de 60 a 65. A lista e a prévia ficam sempre em ordem crescente, sem zeros à esquerda.'));
        corpo.appendChild(campo);
        var previa = criarElemento('div', 'nex-lote-sacas__previa'); previa.appendChild(criarElemento('strong', '', 'Prévia do lote'));
        var resumo = criarElemento('p', 'nex-lote-sacas__resumo', 'Digite os números para revisar o lote antes de salvar.'); previa.appendChild(resumo); corpo.appendChild(previa);
        function analisar() {
          var p = expandirSacas(area.value);
          resumo.textContent = p.erros.length ? p.erros.join(' · ') : (p.numeros.length + ' saca(s)' + (p.numeros.length ? ' · ' + p.numeros.slice(0, 10).join(', ') + (p.numeros.length > 10 ? '…' : '') : ''));
          previa.classList.toggle('tem-erro', p.erros.length > 0); return p;
        }
        area.addEventListener('input', analisar);
        return { foco: area, area: area, analisar: analisar };
      },
      function (campos, erro) {
        var p = campos.analisar();
        if (!campos.area.value.trim() || !p.numeros.length) { erro.textContent = 'Informe ao menos um número de saca.'; erro.hidden = false; return false; }
        if (p.erros.length) { erro.textContent = p.erros.join(' '); erro.hidden = false; return false; }
        var unicos = [], vistos = Object.create(null);
        p.numeros.forEach(function (n) { var k = String(Number(n)); if (!vistos[k]) { vistos[k] = true; unicos.push(n); } });
        var ok = [], falhas = [];
        unicos.forEach(function (numero) { var res = api.addSaca(nomeRota, numero); if (res.sucesso) ok.push(numero); else falhas.push(numero + ': ' + res.erro); });
        rotasAbertas[nomeRota] = true; renderRotas();
        if (falhas.length) { erro.textContent = ok.length + ' saca(s) cadastrada(s). Revise e tente novamente apenas as não cadastradas: ' + falhas.slice(0, 5).join(' · ') + (falhas.length > 5 ? '…' : ''); erro.hidden = false; campos.area.value = falhas.map(function (f) { return f.split(':')[0]; }).join(', '); campos.analisar(); return false; }
        return true;
      });
  }

  function abrirDialogoSacasMultiplasRotas(api, rotas) {
    criarDialogoNex('Adicionar sacas por rota', 'Informe uma rota por linha, seguida dos numeros ou intervalos de sacas. Exemplo: J1 10-20 e K2 50-65.', 'Cadastrar sacas',
      function (corpo) {
        var campo = criarElemento('label', 'nex-campo');
        campo.appendChild(criarElemento('span', 'nex-campo__rotulo', 'Rotas e intervalos de sacas'));
        var area = document.createElement('textarea'); area.className = 'nex-campo__textarea'; area.rows = 6; area.placeholder = 'J1 10-20\nK2 50-65\nRota 3 72, 74, 80-82';
        campo.appendChild(area);
        campo.appendChild(criarElemento('span', 'nex-campo__ajuda', 'Uma rota por linha. Informe primeiro o nome exato de uma rota ja cadastrada e depois os numeros individuais ou intervalos separados por virgula, espaco ou ponto e virgula.'));
        corpo.appendChild(campo);
        var previa = criarElemento('div', 'nex-lote-sacas__previa'); previa.appendChild(criarElemento('strong', '', 'Previa do cadastro'));
        var resumo = criarElemento('p', 'nex-lote-sacas__resumo', 'Digite as rotas e os numeros para validar antes de salvar.'); previa.appendChild(resumo); corpo.appendChild(previa);
        function analisar() {
          var linhas = area.value.split(/\r?\n/), itens = [], erros = [], vistos = Object.create(null);
          linhas.forEach(function (linha, indice) {
            linha = linha.trim(); if (!linha) return;
            var rota = rotas.slice().sort(function (a, b) { return String(b.rota).length - String(a.rota).length; }).find(function (r) { return linha.toLocaleLowerCase('pt-BR').indexOf(String(r.rota).toLocaleLowerCase('pt-BR') + ' ') === 0; });
            if (!rota) { erros.push('Linha ' + (indice + 1) + ': informe uma rota cadastrada, seguida dos numeros das sacas.'); return; }
            var resto = linha.slice(String(rota.rota).length).trim();
            var expandidas = expandirSacas(resto);
            expandidas.erros.forEach(function (e) { erros.push('Linha ' + (indice + 1) + ': ' + e); });
            expandidas.numeros.forEach(function (numero) {
              var chave = String(Number(numero));
              if (vistos[chave]) erros.push('A saca ' + chave + ' aparece mais de uma vez nesta lista.');
              else { vistos[chave] = true; itens.push({ rota: rota.rota, numero: chave }); }
            });
          });
          if (itens.length > 1000) erros.push('O lote excede o limite de 1.000 sacas por envio.');
          resumo.textContent = erros.length ? erros.slice(0, 8).join(' | ') + (erros.length > 8 ? '...' : '') : (itens.length ? itens.length + ' saca(s) em ' + new Set(itens.map(function (i) { return i.rota; })).size + ' rota(s). Previa: ' + itens.slice(0, 12).map(function (i) { return i.rota + ' ' + i.numero; }).join(', ') + (itens.length > 12 ? '...' : '') : 'Digite as rotas e os numeros para validar antes de salvar.');
          previa.classList.toggle('tem-erro', erros.length > 0); return { itens: itens, erros: erros };
        }
        area.addEventListener('input', analisar);
        return { foco: area, area: area, analisar: analisar };
      },
      function (campos, erro) {
        var lote = campos.analisar();
        if (!campos.area.value.trim() || !lote.itens.length) { erro.textContent = 'Informe ao menos uma rota com numeros de sacas validos.'; erro.hidden = false; return false; }
        if (lote.erros.length) { erro.textContent = lote.erros.slice(0, 8).join(' '); erro.hidden = false; return false; }
        var ok = [], falhas = [];
        lote.itens.forEach(function (item) {
          var resultado = api.addSaca(item.rota, item.numero);
          if (resultado.sucesso) { ok.push(item.rota + ' ' + item.numero); rotasAbertas[item.rota] = true; }
          else falhas.push(item.rota + ' ' + item.numero + ': ' + resultado.erro);
        });
        renderRotas();
        if (falhas.length) {
          erro.textContent = ok.length + ' saca(s) cadastrada(s). Algumas nao foram adicionadas: ' + falhas.slice(0, 6).join(' | ') + (falhas.length > 6 ? '...' : '');
          erro.hidden = false;
          campos.area.value = falhas.map(function (f) { return f.split(':')[0]; }).join('\n');
          campos.analisar(); return false;
        }
        return true;
      });
  }
  function renderRotas() {
    while (routeList.firstChild) routeList.removeChild(routeList.firstChild);
    while (routeCounters.firstChild) routeCounters.removeChild(routeCounters.firstChild);
    var api = window.MeliNotepad && window.MeliNotepad.NexOperations;
    var sessao = api && api.getCurrentSession ? api.getCurrentSession() : null;
    var rotas = sessao && Array.isArray(sessao.rotasHybrid) ? sessao.rotasHybrid : [];
    var sacas = [], auditadas = 0, divergencias = 0;
    rotas.forEach(function (rota) { (rota.sacasIndividuais || []).forEach(function (saca) { sacas.push(saca); var ult = (saca.auditorias || []).slice(-1)[0]; if (ult) { auditadas++; if (ult.status === 'divergencia') divergencias++; } }); });
    routeSummary.textContent = rotas.length ? 'Selecione uma rota para ver as sacas vinculadas. As auditorias são registradas individualmente por saca.' : 'Nenhuma rota cadastrada. Você pode importar uma planilha ou adicionar uma rota manualmente.';
    [[String(rotas.length), 'Rotas'], [String(sacas.length), 'Sacas cadastradas'], [String(sacas.length - auditadas), 'Sacas pendentes'], [String(divergencias), 'Com divergência']].forEach(function (item) {
      var counter = criarElemento('div', 'contador'); counter.appendChild(criarElemento('span', 'contador__valor', item[0])); counter.appendChild(criarElemento('span', 'contador__rotulo', item[1])); routeCounters.appendChild(counter);
    });
    var routeActions = criarElemento('div', 'nex-rota-acoes');
    var addRoute = document.createElement('button'); addRoute.type = 'button'; addRoute.className = 'botao botao--primario nex-adicionar-rota'; addRoute.textContent = '+ Adicionar rota';
    addRoute.addEventListener('click', function () { abrirDialogoNovaRota(api); });
    var addSacasRotas = document.createElement('button'); addSacasRotas.type = 'button'; addSacasRotas.className = 'botao botao--secundario nex-adicionar-sacas-rotas'; addSacasRotas.textContent = '+ Adicionar sacas';
    addSacasRotas.disabled = !rotas.length;
    addSacasRotas.title = rotas.length ? 'Cadastrar sacas em várias rotas de uma só vez' : 'Cadastre uma rota antes de adicionar sacas';
    addSacasRotas.addEventListener('click', function () { abrirDialogoSacasMultiplasRotas(api, rotas); });
    routeActions.appendChild(addRoute); routeActions.appendChild(addSacasRotas);
    routeList.appendChild(routeActions);
    if (!rotas.length) { routeList.appendChild(criarElemento('p', 'texto-apoio', 'As rotas importadas ou cadastradas manualmente aparecerão aqui.')); return; }
    var termoBusca = buscaSaca.value.trim().toLocaleLowerCase('pt-BR');
    rotas.forEach(function (rota) {
      var todasSacasRota = Array.isArray(rota.sacasIndividuais) ? rota.sacasIndividuais : [];
      var rotaCombina = String(rota.rota).toLocaleLowerCase('pt-BR').includes(termoBusca);
      var listaSacas = todasSacasRota.filter(function (s) {
        var ultima = (s.auditorias || []).slice(-1)[0];
        var status = !ultima ? 'pendente' : ultima.status === 'divergencia' ? 'divergencia' : 'concluida';
        var statusCombina = statusSelecionado === 'todas' || statusSelecionado === status;
        var numeroCombina = !termoBusca || rotaCombina || String(s.numero).toLocaleLowerCase('pt-BR').includes(termoBusca);
        return statusCombina && numeroCombina;
      });
      if (termoBusca && !rotaCombina && !listaSacas.length) return;
      if (termoBusca && rotaCombina) listaSacas = todasSacasRota.filter(function (s) { var ultima = (s.auditorias || []).slice(-1)[0]; var status = !ultima ? 'pendente' : ultima.status === 'divergencia' ? 'divergencia' : 'concluida'; return statusSelecionado === 'todas' || statusSelecionado === status; });
      if (!listaSacas.length && (termoBusca || statusSelecionado !== 'todas')) return;
      var contAuditadas = todasSacasRota.filter(function (s) { return (s.auditorias || []).length > 0; }).length;
      var aberto = !!rotasAbertas[rota.rota] || !!termoBusca || statusSelecionado !== 'todas';
      var card = criarElemento('article', 'cartao nex-rota-card' + (aberto ? ' is-aberta' : ''));
      var toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'nex-rota-toggle'; toggle.setAttribute('aria-expanded', String(aberto));
      var toggleInfo = criarElemento('span', 'nex-rota-toggle__info'); toggleInfo.appendChild(criarElemento('strong', 'nex-rota-nome', rota.rota)); toggleInfo.appendChild(criarElemento('span', 'texto-apoio', todasSacasRota.length + ' sacas · ' + contAuditadas + ' auditadas')); toggle.appendChild(toggleInfo); toggle.appendChild(criarElemento('span', 'nex-rota-chevron', aberto ? '−' : '+'));
      var removerRota = document.createElement('button');
      removerRota.type = 'button';
      removerRota.className = 'botao botao--secundario nex-remover-rota';
      removerRota.textContent = 'Retirar rota';
      removerRota.setAttribute('aria-label', 'Retirar rota ' + rota.rota);
      removerRota.addEventListener('click', function (event) {
        event.stopPropagation();
        var quantidadeSacas = listaSacas.length;
        var mensagem = 'Retirar a rota "' + rota.rota + '" desta operação?';
        if (quantidadeSacas) mensagem += '\\n\\nAs ' + quantidadeSacas + ' saca(s) vinculada(s) e seu histórico de auditorias também serão removidos desta operação.';
        if (!window.confirm(mensagem)) return;
        var resultado = api.removeRoute(rota.rota);
        if (!resultado.sucesso) window.alert(resultado.erro);
        else { delete rotasAbertas[rota.rota]; renderRotas(); }
      });
      toggle.addEventListener('click', function () {
        // A rota é recriada durante a renderização; preserve a rolagem e o foco sem provocar saltos.
        var scrollX = window.scrollX || window.pageXOffset || 0;
        var scrollY = window.scrollY || window.pageYOffset || 0;
        var indiceRota = rotas.findIndex(function (item) { return item.rota === rota.rota; });
        rotasAbertas[rota.rota] = !rotasAbertas[rota.rota];
        renderRotas();
        var novosToggles = routeList.querySelectorAll('.nex-rota-toggle');
        if (indiceRota >= 0 && novosToggles[indiceRota]) {
          try { novosToggles[indiceRota].focus({ preventScroll: true }); } catch (_) { novosToggles[indiceRota].focus(); }
        }
        window.scrollTo(scrollX, scrollY);
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(function () { window.scrollTo(scrollX, scrollY); });
        }
      }); card.appendChild(toggle); card.appendChild(removerRota);
      var conteudo = criarElemento('div', 'nex-rota-conteudo'); conteudo.hidden = !aberto;
      conteudo.appendChild(criarElemento('p', 'texto-apoio nex-rota-detalhes', rota.origem === 'manual' ? 'Rota cadastrada manualmente · sem totais estimados da planilha' : 'Totais da planilha (estimativas): ' + (rota.sacas || 0) + ' sacas · ' + (rota.pacotes || 0) + ' pacotes. Esses números não criam cadastros individuais de sacas.'));
      var sacaActions = criarElemento('div', 'nex-sacas-acoes');
      var addSaca = document.createElement('button'); addSaca.type = 'button'; addSaca.className = 'botao botao--secundario'; addSaca.textContent = '+ Uma saca';
      addSaca.addEventListener('click', function () { abrirDialogoSaca(api, rota.rota); });
      var addLote = document.createElement('button'); addLote.type = 'button'; addLote.className = 'botao botao--primario'; addLote.textContent = '+ Adicionar em lote';
      addLote.addEventListener('click', function () { abrirDialogoSacasLote(api, rota.rota); });
      sacaActions.appendChild(addSaca); sacaActions.appendChild(addLote); conteudo.appendChild(sacaActions);
      if (!listaSacas.length) conteudo.appendChild(criarElemento('p', 'texto-apoio', 'Ainda não há sacas individuais vinculadas a esta rota. O total importado da planilha é apenas uma estimativa e não cria cadastros individuais.'));
      var lista = criarElemento('div', 'nex-lista-sacas');
      listaSacas.slice().sort(function (a,b) { return Number(a.numero)-Number(b.numero); }).forEach(function (saca) {
        var historico = Array.isArray(saca.auditorias) ? saca.auditorias : []; var ultima = historico.slice(-1)[0];
        var item = criarElemento('article', 'nex-saca-item' + (ultima ? (ultima.status === 'divergencia' ? ' tem-divergencia' : ' auditada') : ' pendente'));
        var topo = criarElemento('div', 'nex-saca-item__topo'); topo.appendChild(criarElemento('strong', '', 'Saca ' + saca.numero)); topo.appendChild(criarElemento('span', 'nex-rota-status' + (ultima ? (ultima.status === 'divergencia' ? ' is-divergencia' : ' is-concluida') : ''), !ultima ? 'Não realizada' : ultima.status === 'divergencia' ? 'Com divergência' : 'Concluída')); item.appendChild(topo);
        if (ultima) { item.appendChild(criarElemento('p', 'texto-apoio', 'Auditor: ' + ultima.auditor + ' · ' + new Date(ultima.data).toLocaleString('pt-BR'))); if (ultima.observacao) item.appendChild(criarElemento('p', 'nex-saca-observacao', ultima.observacao)); }
        var auditar = document.createElement('button'); auditar.type = 'button'; auditar.className = 'botao botao--primario'; auditar.textContent = ultima ? 'Realizar nova auditoria' : 'Auditar saca';
        auditar.addEventListener('click', function () { var auditor = window.prompt('Nome do Auditor:'); if (auditor === null) return; auditor = auditor.trim(); if (!auditor) { window.alert('Informe o nome do auditor.'); return; } if (!window.confirm('Confirmar auditoria da saca ' + saca.numero + ' realizada por ' + auditor + '?')) return; var res = api.auditSaca(rota.rota, saca.id, auditor, 'concluida', ''); if (!res.sucesso) window.alert(res.erro); else { rotasAbertas[rota.rota] = true; renderRotas(); } }); item.appendChild(auditar);
        var removerSaca = document.createElement('button'); removerSaca.type = 'button'; removerSaca.className = 'botao botao--secundario nex-remover-saca'; removerSaca.textContent = 'Retirar saca'; removerSaca.setAttribute('aria-label', 'Retirar saca ' + saca.numero + ' da rota ' + rota.rota);
        removerSaca.addEventListener('click', function () {
          var mensagem = 'Retirar a saca ' + saca.numero + ' da rota "' + rota.rota + '"?';
          if (historico.length) mensagem += '\\n\\nO histórico com ' + historico.length + ' auditoria(s) dessa saca também será removido desta operação.';
          if (!window.confirm(mensagem)) return;
          var resultado = api.removeSaca(rota.rota, saca.id);
          if (!resultado.sucesso) window.alert(resultado.erro);
          else { rotasAbertas[rota.rota] = true; renderRotas(); }
        }); item.appendChild(removerSaca);
        if (historico.length > 1) { var details = document.createElement('details'); details.className = 'nex-saca-historico'; details.appendChild(criarElemento('summary', '', 'Histórico de auditorias (' + historico.length + ')')); historico.forEach(function (a, i) { details.appendChild(criarElemento('p', 'texto-apoio', (i + 1) + '. ' + (a.status === 'divergencia' ? 'Com divergência' : 'Concluída') + ' · ' + a.auditor + ' · ' + new Date(a.data).toLocaleString('pt-BR') + (a.observacao ? ' · ' + a.observacao : ''))); }); item.appendChild(details); }
        lista.appendChild(item);
      });
      conteudo.appendChild(lista); card.appendChild(conteudo); routeList.appendChild(card);
    });
    renderQuantidades();
  }

  function selecionar(name, focus) {
    tabs.forEach(function (item) {
      var active = item.getAttribute('data-nex-tab') === name;
      item.classList.toggle('is-ativo', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
      item.tabIndex = active ? 0 : -1;
    });
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].hidden = key !== name;
    });
    if (focus) {
      var selected = tabs.filter(function (item) { return item.getAttribute('data-nex-tab') === name; })[0];
      if (selected) selected.focus();
    }
    if (name === 'gaiolas') renderRotas();
  }

  function atualizarTelaOperacao() {
    var emAndamento = !!activeSession && !activeSession.hidden;
    landing.hidden = emAndamento;
    nav.hidden = !emAndamento;
    if (finalizeWrap) finalizeWrap.hidden = !emAndamento;
    if (secondaryNav) secondaryNav.hidden = emAndamento;
    if (!emAndamento) {
      Object.keys(panels).forEach(function (key) { if (panels[key]) panels[key].hidden = true; });
      if (historyView) {
        move(historyView, landingHistory);
        landingHistory.hidden = historyView.hidden;
      }
      if (sessionStart) sessionStart.hidden = !!(historyView && !historyView.hidden);
      if (secondaryNav) {
        var current = document.getElementById('btn-ver-sessao');
        var history = document.getElementById('btn-ver-historico');
        var mostrandoHistorico = !!(historyView && !historyView.hidden);
        if (current) { current.classList.toggle('is-ativo', !mostrandoHistorico); current.setAttribute('aria-pressed', String(!mostrandoHistorico)); }
        if (history) { history.classList.toggle('is-ativo', mostrandoHistorico); history.setAttribute('aria-pressed', String(mostrandoHistorico)); }
      }
    } else {
      move(historyView, panels.relatorios);
      if (historyView) historyView.hidden = true;
      selecionar('gaiolas', false);
    }
    renderRotas();
  }

  nav.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-nex-tab]');
    if (!tab) return;
    selecionar(tab.getAttribute('data-nex-tab'), false);
  });
  if (secondaryNav) secondaryNav.addEventListener('click', function (event) {
    var button = event.target.closest('#btn-ver-sessao, #btn-ver-historico');
    if (!button || activeSession && !activeSession.hidden) return;
    atualizarNavegacaoInicial(button.id === 'btn-ver-historico');
  });
  tabs.forEach(function (tab, index) {
    tab.tabIndex = -1;
    tab.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      var next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selecionar(tabs[next].getAttribute('data-nex-tab'), true);
    });
  });
  if (typeof MutationObserver !== 'undefined') {
    var quantitySourceNodes = ['info-sacas', 'info-pacotes', 'contagem-total', 'contagem-pendente'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (quantitySourceNodes.length) {
      var quantityObserver = new MutationObserver(renderQuantidades);
      quantitySourceNodes.forEach(function (node) { quantityObserver.observe(node, { childList: true, characterData: true, subtree: true }); });
    }
    if (activeSession) new MutationObserver(atualizarTelaOperacao).observe(activeSession, { attributes: true, attributeFilter: ['hidden'] });
    if (historyView) new MutationObserver(function () {
      if (!activeSession || activeSession.hidden) {
        landingHistory.hidden = historyView.hidden;
        if (sessionStart) sessionStart.hidden = !historyView.hidden;
      }
    }).observe(historyView, { attributes: true, attributeFilter: ['hidden'] });
  }
  atualizarTelaOperacao();
}());
