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

  // Totais e edição permanecem em Quantidades; ocorrências ficam em sua própria aba.
  move(sectionFor('titulo-sessao'), panels.quantidades);
  move(activeSession, panels.ocorrencias);

  // As rotas HYBRID são as gaiolas operacionais do NEX e ficam na aba de auditoria.
  var routePanel = document.createElement('section');
  routePanel.id = 'nex-rotas-auditoria';
  routePanel.className = 'cartao';
  routePanel.setAttribute('aria-labelledby', 'nex-rotas-auditoria-titulo');
  var routeHeading = document.createElement('h2');
  routeHeading.id = 'nex-rotas-auditoria-titulo';
  routeHeading.textContent = 'Gaiolas e auditoria';
  var routeSummary = document.createElement('p');
  routeSummary.className = 'texto-apoio';
  routeSummary.id = 'nex-rotas-auditoria-resumo';
  routePanel.appendChild(routeHeading);
  routePanel.appendChild(routeSummary);
  var routeCounters = document.createElement('div');
  routeCounters.className = 'contadores nex-rotas-contadores';
  routeCounters.setAttribute('role', 'group');
  routeCounters.setAttribute('aria-label', 'Resumo das auditorias de rotas');
  routePanel.appendChild(routeCounters);
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

  function renderRotas() {
    while (routeList.firstChild) routeList.removeChild(routeList.firstChild);
    while (routeCounters.firstChild) routeCounters.removeChild(routeCounters.firstChild);
    var api = window.MeliNotepad && window.MeliNotepad.NexOperations;
    var sessao = api && api.getCurrentSession ? api.getCurrentSession() : null;
    var rotas = sessao && Array.isArray(sessao.rotasHybrid) ? sessao.rotasHybrid : [];
    var concluidas = rotas.filter(function (rota) { return rota.auditStatus === 'concluida'; }).length;
    routeSummary.textContent = rotas.length
      ? rotas.length + ' rota(s) HYBRID importada(s). Registre o auditor ao concluir cada auditoria.'
      : 'Nenhuma rota HYBRID foi importada para esta operação. Importe a planilha na tela inicial para listar as rotas aqui.';
    [
      [String(rotas.length), 'Rotas importadas'],
      [String(concluidas), 'Concluídas'],
      [String(rotas.length - concluidas), 'Pendentes']
    ].forEach(function (item) {
      var counter = criarElemento('div', 'contador');
      counter.appendChild(criarElemento('span', 'contador__valor', item[0]));
      counter.appendChild(criarElemento('span', 'contador__rotulo', item[1]));
      routeCounters.appendChild(counter);
    });
    if (!rotas.length) {
      routeList.appendChild(criarElemento('p', 'texto-apoio', 'As rotas aparecerão aqui após iniciar a operação com uma planilha Optimization que contenha linhas HYBRID.'));
      return;
    }
    rotas.forEach(function (rota) {
      var concluida = rota.auditStatus === 'concluida';
      var card = criarElemento('article', 'cartao nex-rota-card' + (concluida ? ' is-concluida' : ''));
      var header = criarElemento('div', 'cartao__cabecalho nex-rota-card__cabecalho');
      header.appendChild(criarElemento('h3', '', rota.rota));
      var status = criarElemento('span', 'nex-rota-status' + (concluida ? ' is-concluida' : ''), concluida ? 'Concluída' : 'Não auditada');
      header.appendChild(status);
      card.appendChild(header);
      card.appendChild(criarElemento('p', 'texto-apoio nex-rota-detalhes', 'Sacas: ' + rota.sacas + ' · Pacotes: ' + rota.pacotes));
      if (concluida) {
        card.appendChild(criarElemento('p', 'nex-rota-auditor', 'Auditor: ' + rota.auditor));
        if (rota.auditedAt) card.appendChild(criarElemento('p', 'texto-apoio', 'Concluída em ' + new Date(rota.auditedAt).toLocaleString('pt-BR')));
      }
      var form = document.createElement('form');
      form.className = 'nex-rota-form';
      if (concluida) form.hidden = true;
      var label = criarElemento('label', 'campo');
      label.appendChild(criarElemento('span', '', 'Nome do auditor'));
      var input = document.createElement('input');
      input.type = 'text';
      input.name = 'auditor';
      input.autocomplete = 'name';
      input.maxLength = 100;
      input.required = true;
      input.placeholder = 'Informe quem realizou a auditoria';
      label.appendChild(input);
      form.appendChild(label);
      var error = criarElemento('p', 'texto-aviso nex-rota-erro', '');
      error.hidden = true;
      form.appendChild(error);
      var submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'botao botao--primario';
      submit.textContent = 'Concluir auditoria';
      form.appendChild(submit);
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var operations = window.MeliNotepad && window.MeliNotepad.NexOperations;
        var result = operations && operations.auditRoute ? operations.auditRoute(rota.rota, input.value, true) : { sucesso: false, erro: 'A função de auditoria não está disponível.' };
        if (!result.sucesso) { error.textContent = result.erro; error.hidden = false; return; }
        renderRotas();
      });
      card.appendChild(form);
      if (concluida) {
        var reopen = document.createElement('button');
        reopen.type = 'button';
        reopen.className = 'botao botao--secundario';
        reopen.textContent = 'Reabrir auditoria';
        reopen.addEventListener('click', function () {
          var operations = window.MeliNotepad && window.MeliNotepad.NexOperations;
          var result = operations && operations.auditRoute ? operations.auditRoute(rota.rota, '', false) : { sucesso: false, erro: 'A função de auditoria não está disponível.' };
          if (!result.sucesso) { window.alert(result.erro); return; }
          renderRotas();
        });
        card.appendChild(reopen);
      }
      routeList.appendChild(card);
    });
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
