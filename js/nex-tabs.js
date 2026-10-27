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
    routeActions.appendChild(addRoute);
    routeList.appendChild(routeActions);
    if (!rotas.length) { routeList.appendChild(criarElemento('p', 'texto-apoio', 'As rotas importadas ou cadastradas manualmente aparecerão aqui.')); return; }
    rotas.forEach(function (rota) {
      var listaSacas = Array.isArray(rota.sacasIndividuais) ? rota.sacasIndividuais : [];
      var contAuditadas = listaSacas.filter(function (s) { return (s.auditorias || []).length > 0; }).length;
      var aberto = !!rotasAbertas[rota.rota];
      var card = criarElemento('article', 'cartao nex-rota-card' + (aberto ? ' is-aberta' : ''));
      var toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'nex-rota-toggle'; toggle.setAttribute('aria-expanded', String(aberto));
      var toggleInfo = criarElemento('span', 'nex-rota-toggle__info'); toggleInfo.appendChild(criarElemento('strong', 'nex-rota-nome', rota.rota)); toggleInfo.appendChild(criarElemento('span', 'texto-apoio', listaSacas.length + ' saca(s) cadastrada(s) · ' + contAuditadas + ' auditada(s)')); toggle.appendChild(toggleInfo); toggle.appendChild(criarElemento('span', 'nex-rota-chevron', aberto ? '−' : '+'));
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
