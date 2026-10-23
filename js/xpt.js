/**
 * xpt.js
 * Tela do módulo XPT (expedição): operações, quantidades, gaiolas/auditoria,
 * ocorrências, veículos (com foto do HAND + lacre) e relatórios.
 * Regras em xpt-regras.js. Dados: LocalStorage (melinotepad_xpt_v1) e fotos em
 * IndexedDB — somente neste aparelho (sem sincronização).
 */
(function (global) {
  'use strict';
  var NS = global.MeliNotepad, X = NS.XptRegras, U = NS.Utils, UI = NS.UI, F = NS.Fotos, Scanner = NS.Scanner, h = UI.h;
  var ABAS = [['gaiolas', 'Gaiolas e auditoria'], ['ocorrencias', 'Ocorrências'], ['veiculos', 'Veículos e carregamento'], ['quantidades', 'Quantidades'], ['relatorios', 'Relatórios']];
  var store = NS.ModStore.criar({ chave: 'melinotepad_xpt_v1', rotulo: 'XPT', padrao: X.padrao, validar: X.validarDados });
  var estado = X.padrao(), avisoArm = null, el = {};
  var ui = { opId: null, aba: 'gaiolas', filtroAud: '*', busca: '', filtroOc: '*' };

  function agora() { return U.agora().getTime(); }
  function hhmm(i) { return U.formatarHora(new Date(i)); }
  function dataHora(i) { return U.formatarDataHora(new Date(i)); }
  function recarregar() { var c = store.carregar(); estado = c.dados; avisoArm = c.aviso; }
  function mutar(fn) { var r = store.mutar(fn); if (!r.sucesso) { UI.avisar(r.erro, 'erro'); return null; } estado = r.dados; return r; }
  function op() { return estado.operacoes.filter(function (o) { return o.id === ui.opId; })[0] || null; }
  function mutarOp(fn) {
    return mutar(function (d) {
      var o = d.operacoes.filter(function (x) { return x.id === ui.opId; })[0];
      if (!o) throw new Error('Operação não encontrada.');
      return fn(o, d);
    });
  }
  function thead(cols) { return h('thead', {}, [h('tr', {}, cols.map(function (t) { return h('th', { scope: 'col', text: t }); }))]); }
  function select(id, opcoes, valor) {
    var s = h('select', { id: id }, opcoes.map(function (o) { return h('option', { value: o[0], text: o[1] }); })); if (valor !== undefined) s.value = valor; return s;
  }
  function aviso(txt) { return h('p', { class: 'texto-aviso', role: 'alert', text: txt || '' }); }

  // ================================================================ diálogos genéricos
  function dialogoHorario(cfg) {
    var dlg = UI.dialogo('dlg-xpt-horario');
    var inp = h('input', { type: 'datetime-local', id: 'xh-quando', value: U.paraDatetimeLocal(new Date(agora())) });
    var erro = aviso(cfg.aviso);
    dlg.appendChild(h('h2', { text: cfg.titulo }));
    if (cfg.texto) dlg.appendChild(h('p', { class: 'texto-apoio', text: cfg.texto }));
    dlg.appendChild(h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var ms = new Date(inp.value).getTime();
      if (!inp.value || isNaN(ms)) { erro.textContent = 'Informe data e horário válidos.'; return; }
      if (cfg.aoConfirmar(ms, erro)) dlg.close();
    } }, [UI.campo(cfg.rotuloCampo || 'Data e horário', inp, 'Vem com o horário atual; ajuste se necessário.'), erro,
      h('div', { class: 'acoes-form acoes-form--modal' }, [h('button', { type: 'button', class: 'botao botao--secundario', text: 'Cancelar', onclick: function () { dlg.close(); } }),
        h('button', { type: 'submit', class: 'botao botao--primario', id: 'xh-ok', text: cfg.confirmar })])]));
    dlg.showModal();
  }

  /**
   * Diálogo de códigos com REVISÃO antes de confirmar (intervalos como 100-120 e códigos soltos).
   * modo 'adicionar': confirma os códigos novos. modo 'existentes': só aceita códigos já cadastrados.
   */
  function dialogoCodigos(cfg) {
    var dlg = UI.dialogo('dlg-xpt-codigos');
    var texto = h('textarea', { id: 'xc-texto', rows: '4', placeholder: 'Ex.: 1001-1020, 1035, 1040' });
    var hifen = h('input', { type: 'checkbox', id: 'xc-hifen' });
    var previa = h('div', { class: 'xpt-previa', id: 'xc-previa' });
    var ok = h('button', { type: 'submit', class: 'botao botao--primario', id: 'xc-ok', text: cfg.confirmar, disabled: true });
    var res = null;
    function chaves(lista) { var v = {}, o = []; lista.forEach(function (c) { var k = X.chave(c); if (!v[k]) { v[k] = 1; o.push(c); } }); return o; }
    function analisar() {
      res = X.interpretarCodigos(texto.value, { hifenComoCodigo: hifen.checked }, cfg.existentes());
      var alvo = cfg.modo === 'existentes' ? chaves(res.jaExistentes) : res.novos;
      var desconhecidos = cfg.modo === 'existentes' ? res.novos : [];
      res.alvo = alvo; res.desconhecidos = desconhecidos;
      UI.limpar(previa);
      if (!texto.value.trim()) { ok.disabled = true; ok.textContent = cfg.confirmar; return; }
      previa.appendChild(h('table', { class: 'tabela-modulo' }, [thead(['Entrada', 'Como foi entendida']), h('tbody', {}, res.linhas.slice(0, 60).map(function (l) {
        return h('tr', {}, [h('td', { text: l.entrada }), h('td', { text: l.tipo === 'erro' ? '⚠ ' + l.erro : l.tipo === 'intervalo' ? 'Intervalo: ' + l.codigos.length + ' códigos (' + l.codigos[0] + ' … ' + l.codigos[l.codigos.length - 1] + ')' : '1 código' })]);
      }))]));
      var r = [];
      r.push((cfg.modo === 'existentes' ? 'Encontradas: ' : 'Novos: ') + alvo.length);
      if (cfg.modo === 'adicionar' && res.jaExistentes.length) r.push('já existem (ignorados): ' + chaves(res.jaExistentes).length);
      if (res.repetidosNoLote.length) r.push('repetidos no texto (ignorados): ' + res.repetidosNoLote.length);
      if (desconhecidos.length) r.push('não cadastradas: ' + desconhecidos.length);
      if (res.erros.length) r.push('erros: ' + res.erros.length);
      previa.appendChild(h('p', { class: 'xpt-resumo', id: 'xc-resumo', text: r.join(' · ') }));
      var bloqueio = res.erros.length > 0 || (desconhecidos.length > 0 && !(cfg.permiteDesconhecidas && cfg.permiteDesconhecidas()));
      if (res.erros.length) previa.appendChild(aviso('Corrija os itens com ⚠ antes de confirmar.'));
      else if (desconhecidos.length && !bloqueio === false) previa.appendChild(aviso('Há códigos não cadastrados nesta operação: ' + desconhecidos.slice(0, 8).join(', ') + (desconhecidos.length > 8 ? '…' : '') + '.'));
      var total = alvo.length + (cfg.permiteDesconhecidas && cfg.permiteDesconhecidas() ? desconhecidos.length : 0);
      ok.disabled = bloqueio || total === 0;
      ok.textContent = cfg.confirmar + (total ? ' (' + total + ')' : '');
    }
    texto.addEventListener('input', analisar); hifen.addEventListener('change', analisar);
    (cfg.extras || []).forEach(function (x) { if (x.addEventListener) x.addEventListener('change', analisar); });
    dlg.appendChild(h('h2', { text: cfg.titulo }));
    dlg.appendChild(h('p', { class: 'texto-apoio', text: cfg.ajuda || 'Informe códigos separados por linha, vírgula ou ponto e vírgula, ou intervalos como 1001-1020. Revise antes de confirmar.' }));
    dlg.appendChild(h('form', { novalidate: true, onsubmit: function (e) { e.preventDefault(); analisar(); if (ok.disabled) return; if (cfg.aoConfirmar(res) !== false) dlg.close(); } }, [
      UI.campo('Códigos', texto),
      h('label', { class: 'interv-check', for: 'xc-hifen' }, [hifen, ' Tratar hífen como parte do código (não como intervalo)']),
      cfg.blocoExtra ? cfg.blocoExtra() : null, previa,
      h('div', { class: 'acoes-form acoes-form--modal' }, [h('button', { type: 'button', class: 'botao botao--secundario', text: 'Cancelar', onclick: function () { dlg.close(); } }), ok])]));
    dlg.showModal(); texto.focus();
  }

  // ================================================================ operações
  function renderLista() {
    var ops = estado.operacoes.slice().sort(function (a, b) { return Date.parse(b.inicioAt) - Date.parse(a.inicioAt); });
    UI.limpar(el.corpoOps);
    ops.forEach(function (o) {
      var sit = X.situacaoOperacao(o), dias = X.diasAberta(o, agora());
      el.corpoOps.appendChild(h('tr', { dataset: { id: o.id } }, [
        h('td', { text: U.formatarData(new Date(o.inicioAt)) }), h('td', { text: hhmm(o.inicioAt) }),
        h('td', { text: o.fimCarregamentoAt ? hhmm(o.fimCarregamentoAt) : '—' }),
        h('td', { text: X.ROTULO_SITUACAO[sit] + (dias >= 1 ? ' · aberta há ' + dias + ' dia(s)' : '') }),
        h('td', { text: o.gaiolas.length }), h('td', { text: X.pendentesAbertas(o).length }),
        h('td', {}, [h('button', { type: 'button', class: 'botao botao--secundario', dataset: { acao: 'abrir', id: o.id }, text: 'Abrir' })])]));
    });
    el.vazioOps.hidden = ops.length > 0;
    el.tabelaOps.hidden = ops.length === 0;
  }
  function novaOperacao() {
    dialogoHorario({ titulo: 'Nova operação XPT', texto: 'A data da operação é a data do início.', rotuloCampo: 'Início da operação', confirmar: 'Iniciar operação',
      aoConfirmar: function (ms) {
        var o = X.novaOperacao(agora(), ms);
        if (!mutar(function (d) { d.operacoes.push(o); })) return false;
        abrirOperacao(o.id); UI.avisar('Operação iniciada.', 'sucesso'); return true;
      } });
  }
  function abrirOperacao(id) { ui.opId = id; ui.aba = 'quantidades'; renderTudo(); }
  function voltarLista() { if (Scanner) Scanner.parar(); ui.opId = null; renderTudo(); }

  function renderCabecalho() {
    var o = op(); UI.limpar(el.cabOp); if (!o) return;
    var sit = X.situacaoOperacao(o), dias = X.diasAberta(o, agora());
    el.cabOp.appendChild(h('div', { class: 'cartao__cabecalho' }, [
      h('div', {}, [h('h2', { id: 'xo-titulo', text: 'Operação de ' + U.formatarData(new Date(o.inicioAt)) }),
        h('p', { class: 'texto-apoio', id: 'xo-sit', text: 'Início ' + hhmm(o.inicioAt) + ' · ' + X.ROTULO_SITUACAO[sit] +
          (o.fimCarregamentoAt ? ' · carregamento encerrado às ' + hhmm(o.fimCarregamentoAt) : '') + (o.encerradaAt ? ' · encerrada em ' + dataHora(o.encerradaAt) : '') +
          (dias >= 1 ? ' · aberta há ' + dias + ' dia(s)' : '') })]),
      h('button', { type: 'button', class: 'botao botao--texto', id: 'xo-voltar', text: '← Operações', onclick: voltarLista })]));
    el.cabOp.appendChild(h('div', { class: 'acoes-form' }, [
      h('button', { type: 'button', class: 'botao botao--secundario', id: 'xo-fimcarga', disabled: !!o.fimCarregamentoAt || !o.veiculos.length, text: o.fimCarregamentoAt ? 'Carregamento já encerrado' : 'Finalizar carregamento', onclick: function () {
        if (!o.veiculos.length) { UI.avisar('Cadastre pelo menos um veículo antes de finalizar o carregamento.', 'erro'); return; }
        var semGaiolas = o.veiculos.filter(function (v) { return !v.gaiolaIds.length; }).length;
        dialogoHorario({ titulo: 'Finalizar carregamento', texto: 'Confirme somente depois de registrar, uma a uma, todas as gaiolas embarcadas. ' + (semGaiolas ? semGaiolas + ' veículo(s) ainda estão sem gaiolas registradas.' : ''), confirmar: 'Confirmar fim do carregamento',
          aoConfirmar: function (ms) { if (!mutarOp(function (x) { x.fimCarregamentoAt = new Date(ms).toISOString(); })) return false; renderTudo(); return true; } });
      } }),
      h('button', { type: 'button', class: 'botao botao--primario', id: 'xo-encerrar', disabled: !!o.encerradaAt, text: o.encerradaAt ? 'Operação encerrada' : 'Encerrar operação', onclick: function () {
        var pend = X.pendentesAbertas(o).length, av = [];
        if (!o.fimCarregamentoAt) av.push('O fim do carregamento ainda não foi registrado.');
        if (pend) av.push(pend + ' ocorrência(s) ainda pendente(s): elas continuam registradas como pendentes.');
        dialogoHorario({ titulo: 'Encerrar operação', texto: 'Encerrar é uma ação explícita e é diferente do fim do carregamento.', aviso: av.join(' '), rotuloCampo: 'Encerramento', confirmar: 'Encerrar operação',
          aoConfirmar: function (ms) { if (!mutarOp(function (x) { x.encerradaAt = new Date(ms).toISOString(); })) return false; renderTudo(); return true; } });
      } })]));
  }

  // ================================================================ quantidades
  function renderQuantidades() {
    var o = op(); UI.limpar(el.pQuant); if (!o) return;
    var q = o.quantidades, campos = [['pacotes', 'Pacotes'], ['volumosos', 'Volumosos'], ['extraVolumosos', 'Extra volumosos'], ['paletes', 'Paletes (total)'], ['redes', 'Redes (total)'], ['totalBK', 'Total BK (informado)']];
    var inputs = {}, erro = aviso();
    campos.forEach(function (c) { inputs[c[0]] = h('input', { type: 'number', inputmode: 'numeric', min: '0', step: '1', id: 'xq-' + c[0], value: q[c[0]] == null ? '' : q[c[0]] }); });
    var t = X.totais(o), a = X.resumoAuditoria(o.gaiolas);
    el.pQuant.appendChild(h('div', { class: 'cartao' }, [h('h3', { text: 'Quantidades' }),
      h('p', { class: 'texto-apoio', text: 'Informe só o que foi realmente contado. Campos em branco ficam como “não informado”. O total de produtos soma pacotes, volumosos e extra volumosos; o Total BK é informado à parte e não entra nessa soma.' }),
      h('form', { novalidate: true, id: 'xq-form', onsubmit: function (e) {
        e.preventDefault(); var novos = {};
        for (var i = 0; i < campos.length; i++) { var r = X.inteiroOuNulo(inputs[campos[i][0]].value); if (!r.ok) { erro.textContent = campos[i][1] + ': informe um número inteiro não negativo.'; return; } novos[campos[i][0]] = r.valor; }
        if (mutarOp(function (x) { x.quantidades = novos; })) { renderQuantidades(); renderLista(); UI.avisar('Quantidades salvas.', 'sucesso'); }
      } }, [h('div', { class: 'xpt-grid' }, campos.map(function (c) { return UI.campo(c[1], inputs[c[0]]); })), erro,
        h('button', { type: 'submit', class: 'botao botao--primario', id: 'xq-salvar', text: 'Salvar quantidades' })])]));
    el.pQuant.appendChild(h('div', { class: 'cartao' }, [h('h3', { text: 'Calculado automaticamente' }),
      h('dl', { class: 'lista-definicao' }, [
        h('div', {}, [h('dt', { text: 'Total de produtos' }), h('dd', { id: 'xq-total', text: String(t.totalProdutos) })]),
        h('div', {}, [h('dt', { text: 'Gaiolas registradas' }), h('dd', { id: 'xq-gaiolas', text: t.gaiolas + (t.gaiolasVuc ? ' (' + t.gaiolasVuc + ' VUC)' : '') })]),
        h('div', {}, [h('dt', { text: 'Paletes nos veículos' }), h('dd', { text: String(t.paletesVeiculos) })]),
        h('div', {}, [h('dt', { text: 'Redes nos veículos' }), h('dd', { text: String(t.redesVeiculos) })]),
        h('div', {}, [h('dt', { text: 'Auditoria (convencionais)' }), h('dd', { text: a.percentual == null ? '—' : String(a.percentual).replace('.', ',') + '%' })])]),
      t.avisos.length ? h('ul', { class: 'xpt-avisos', id: 'xq-avisos' }, t.avisos.map(function (x) { return h('li', { text: '⚠ ' + x }); })) : null]));
  }

  // ================================================================ gaiolas e auditoria
  function renderGaiolas() {
    var o = op(); UI.limpar(el.pGaiolas); if (!o) return;
    var a = X.resumoAuditoria(o.gaiolas);
    var cont = function (v, r, id) { return h('div', { class: 'contador' }, [h('span', { class: 'contador__valor', id: id, text: v }), h('span', { class: 'contador__rotulo', text: r })]); };
    var estadosFiltro = [['nao_iniciada', 'Não realizada'], ['concluida_sem_divergencia', 'Concluída sem divergência'], ['concluida_com_divergencia', 'Concluída com divergência']];
    var filtro = select('xg-filtro', [['*', 'Todas as auditorias']].concat(estadosFiltro), ui.filtroAud);
    var busca = h('input', { type: 'search', id: 'xg-busca', placeholder: 'Buscar código', value: ui.busca, 'aria-label': 'Buscar gaiola' });
    filtro.addEventListener('change', function () { ui.filtroAud = filtro.value; renderGaiolas(); });
    busca.addEventListener('input', function () { ui.busca = busca.value; var pos = busca.value.length; renderGaiolas(); var n = document.getElementById('xg-busca'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
    var itens = o.gaiolas.filter(function (g) {
      var rotulo = X.rotuloAuditoria(o, g);
      var rotuloFiltro = ui.filtroAud === 'concluida_sem_divergencia' ? 'Concluída sem divergência' : ui.filtroAud === 'concluida_com_divergencia' ? 'Concluída com divergência' : 'Não realizada';
      return (ui.filtroAud === '*' || rotulo === rotuloFiltro) &&
        (!ui.busca || X.chave(g.codigo).indexOf(X.chave(ui.busca)) >= 0);
    });
    var corpo = h('tbody', { id: 'xg-corpo' }, itens.map(function (g) {
      var v = X.veiculoDaGaiola(o, g.id);
      var veiculoSelect = select('xg-veiculo-' + g.id, [['', o.veiculos.length ? 'Selecionar ve\u00edculo' : 'Cadastre um ve\u00edculo primeiro']].concat(o.veiculos.map(function (x) { return [x.id, x.placa]; })), v ? v.id : '');
      veiculoSelect.setAttribute('aria-label', 'Ve\u00edculo da gaiola ' + g.codigo);
      veiculoSelect.disabled = !!o.fimCarregamentoAt || !!o.encerradaAt || !o.veiculos.length;
      veiculoSelect.addEventListener('change', function () {
        var destino = veiculoSelect.value, atual = X.veiculoDaGaiola(op(), g.id);
        if ((atual ? atual.id : '') === destino) return;
        if (o.fimCarregamentoAt || o.encerradaAt) { UI.avisar('O carregamento est\u00e1 encerrado; n\u00e3o \u00e9 poss\u00edvel alterar a associa\u00e7\u00e3o.', 'erro'); renderGaiolas(); return; }
        var salvo = mutarOp(function (x) {
          var veiculoAtual = X.veiculoDaGaiola(x, g.id);
          if (veiculoAtual) { var rem = X.descarregarGaiola(x, veiculoAtual.id, g.id, agora()); if (!rem.ok) throw new Error(rem.erro); }
          if (destino) { var add = X.carregarGaiola(x, destino, g.id, agora()); if (!add.ok) throw new Error(add.erro); }
        });
        if (salvo) { renderTudo(); UI.avisar(destino ? 'Ve\u00edculo associado \u00e0 gaiola ' + g.codigo + '.' : 'Ve\u00edculo removido da gaiola ' + g.codigo + '.', 'sucesso'); }
        else renderGaiolas();
      });
      return h('tr', { dataset: { id: g.id } }, [
        h('td', { text: g.codigo }),
        h('td', {}, [h('button', { type: 'button', class: 'celula-acao', dataset: { acao: 'vuc', id: g.id }, text: g.vuc ? 'VUC' : 'Convencional', title: 'Tocar para alternar' })]),
        h('td', { text: X.rotuloAuditoria(o, g) }), h('td', { text: g.auditoria.auditor || '-' }),
        h('td', {}, [veiculoSelect]),
        h('td', {}, [h('button', { type: 'button', class: 'botao botao--texto', dataset: { acao: 'auditar', id: g.id }, text: 'Auditar' })])
      ]);
    }));
    corpo.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-acao]'); if (!b) return;
      if (b.dataset.acao === 'vuc') { if (mutarOp(function (x) { var g = x.gaiolas.filter(function (y) { return y.id === b.dataset.id; })[0]; g.vuc = !g.vuc; })) { renderGaiolas(); renderQuantidades(); } }
      else dialogoAuditoria([b.dataset.id]);
    });
    el.pGaiolas.appendChild(h('div', { class: 'cartao' }, [
      h('h3', { text: 'Etapas 1 e 2 — cadastro e auditoria' }),
      h('p', { class: 'texto-apoio', text: 'Primeiro cadastre todas as gaiolas da operação. Depois, audite as gaiolas cadastradas e registre o resultado de cada uma.' }),
      h('div', { class: 'contadores contadores--xpt', role: 'group', 'aria-label': 'Resumo de gaiolas e auditoria' }, [cont(String(a.total), 'Gaiolas', 'xg-total'), cont(String(a.vuc), 'VUC', 'xg-vuc'), cont(String(a.convencionais), 'Convencionais', 'xg-conv'),
        cont(String(a.concluidas), 'Concluídas', 'xg-conc'), cont(String(a.pendentes + a.naoIniciadas), 'Não realizadas', 'xg-pend'), cont(a.percentual == null ? '—' : String(a.percentual).replace('.', ',') + '%', 'Auditado', 'xg-pct')]),
      h('p', { class: 'texto-apoio', text: 'O percentual considera só as gaiolas convencionais; VUC ficam fora desse cálculo. O resultado da auditoria é Não realizada ou Concluída. A divergência é indicada automaticamente pelas ocorrências vinculadas à gaiola.' }),
      h('div', { class: 'acoes-form' }, [
        h('button', { type: 'button', class: 'botao botao--primario', id: 'xg-adicionar', text: '+ Adicionar gaiolas', onclick: dialogoAdicionarGaiolas }),
        h('button', { type: 'button', class: 'botao botao--secundario', id: 'xg-lote', text: 'Auditar em lote', onclick: dialogoAuditoriaLote })])]));
    el.pGaiolas.appendChild(h('div', { class: 'cartao' }, [h('div', { class: 'interv-filtros' }, [UI.campo('Auditoria', filtro), UI.campo('Código', busca)]),
      h('p', { class: 'texto-apoio', id: 'xg-contagem', text: itens.length + ' de ' + o.gaiolas.length + ' gaiola(s)' }),
      h('div', { class: 'tabela-rolavel' }, [h('table', { class: 'tabela-modulo' }, [thead(['Código', 'Tipo', 'Auditoria', 'Auditor', 'Veículo', '']), corpo])])]));
  }
  function estadoAuditorCampos() {
    var est = select('xa-estado', [['nao_iniciada', 'N\u00e3o realizada'], ['concluida', 'Conclu\u00edda']], 'concluida');
    var auditor = h('input', { type: 'text', id: 'xa-auditor', autocomplete: 'name', maxlength: '100', placeholder: 'Nome de quem realizou a auditoria' });
    return { est: est, auditor: auditor, bloco: h('div', { class: 'interv-duas' }, [UI.campo('Resultado da auditoria', est), UI.campo('Auditor', auditor, 'Obrigat\u00f3rio quando a auditoria for conclu\u00edda.')]) };
  }
  function aplicarAuditoria(ids, estado, auditor) {
    var r = mutarOp(function (o) {
      ids.forEach(function (id) {
        var g = o.gaiolas.filter(function (x) { return x.id === id; })[0]; if (!g) return;
        var x = X.definirAuditoria(g, estado, estado === 'concluida' ? auditor : null, agora());
        if (!x.ok) throw new Error(x.erro);
      });
    });
    if (r) { renderTudo(); UI.avisar('Auditoria registrada em ' + ids.length + ' gaiola(s).', 'sucesso'); return true; }
    return false;
  }
  function dialogoAuditoria(ids) {
    var o = op(), g = o.gaiolas.filter(function (x) { return x.id === ids[0]; })[0]; if (!g) return;
    var dlg = UI.dialogo('dlg-xpt-aud'), c = estadoAuditorCampos();
    c.est.value = g.auditoria.estado === 'nao_iniciada' || g.auditoria.estado === 'pendente' ? 'nao_iniciada' : 'concluida'; c.auditor.value = g.auditoria.auditor || '';
    var erro = aviso();
    c.est.addEventListener('change', function () { c.auditor.required = c.est.value.indexOf('concluida') === 0; });
    c.auditor.required = c.est.value.indexOf('concluida') === 0;
    dlg.appendChild(h('h2', { text: 'Auditoria da gaiola ' + g.codigo }));
    dlg.appendChild(h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      if (aplicarAuditoria([g.id], c.est.value, c.auditor.value)) dlg.close();
      else erro.textContent = 'N\u00e3o foi poss\u00edvel registrar. Confira o resultado e o nome do auditor.';
    } }, [c.bloco, erro, h('div', { class: 'acoes-form acoes-form--modal' }, [
      h('button', { type: 'button', class: 'botao botao--secundario', text: 'Cancelar', onclick: function () { dlg.close(); } }),
      h('button', { type: 'submit', class: 'botao botao--primario', id: 'xa-ok', text: 'Registrar' })
    ])]));
    dlg.showModal();
  }
  function dialogoAdicionarGaiolas() {
    var c = estadoAuditorCampos(); c.est.value = 'nao_iniciada';
    c.est.addEventListener('change', function () { c.auditor.required = c.est.value.indexOf('concluida') === 0; });
    dialogoCodigos({ titulo: 'Adicionar gaiolas', modo: 'adicionar', confirmar: 'Adicionar',
      existentes: function () { return op().gaiolas.map(function (g) { return g.codigo; }); },
      extras: [c.est, c.auditor], blocoExtra: function () { return h('div', {}, [h('p', { class: 'texto-apoio', text: 'Situa\u00e7\u00e3o inicial da auditoria das gaiolas adicionadas:' }), c.bloco]); },
      aoConfirmar: function (res) {
        var est = c.est.value, auditor = c.auditor.value, n = 0;
        if (est.indexOf('concluida') === 0 && !auditor.trim()) { UI.avisar('Informe o nome do auditor.', 'erro'); return false; }
        var r = mutarOp(function (o) { var x = X.adicionarGaiolas(o, res.alvo, agora()); n = x.adicionadas.length;
          x.adicionadas.forEach(function (g) { if (est !== 'nao_iniciada') X.definirAuditoria(g, est, est.indexOf('concluida') === 0 ? auditor : null, agora()); }); });
        if (!r) return false; renderTudo(); UI.avisar(n + ' gaiola(s) adicionada(s).', 'sucesso'); return true;
      } });
  }
  function dialogoAuditoriaLote() {
    var c = estadoAuditorCampos();
    c.est.addEventListener('change', function () { c.auditor.required = c.est.value.indexOf('concluida') === 0; });
    dialogoCodigos({ titulo: 'Auditar gaiolas em lote', modo: 'existentes', confirmar: 'Aplicar',
      ajuda: 'Informe as gaiolas j\u00e1 cadastradas que receber\u00e3o o mesmo resultado de auditoria.',
      existentes: function () { return op().gaiolas.map(function (g) { return g.codigo; }); },
      extras: [c.est, c.auditor], blocoExtra: function () { return c.bloco; },
      aoConfirmar: function (res) {
        var mapa = {}; op().gaiolas.forEach(function (g) { mapa[X.chave(g.codigo)] = g.id; });
        var ids = res.alvo.map(function (k) { return mapa[X.chave(k)]; }).filter(Boolean);
        if (c.est.value.indexOf('concluida') === 0 && !c.auditor.value.trim()) { UI.avisar('Informe o nome do auditor.', 'erro'); return false; }
        return aplicarAuditoria(ids, c.est.value, c.auditor.value);
      } });
  }

  // ================================================================ ocorrências
  function renderOcorrencias() {
    var o = op(); UI.limpar(el.pOcorrencias); if (!o) return;
    var categoria = select('xoc-categoria', [['', 'Selecione uma categoria']].concat(X.CATEGORIAS.map(function (c) { return [c.id, c.rotulo]; })), '');
    var produto = h('input', { type: 'text', id: 'xoc-produto', autocomplete: 'off', placeholder: 'Escaneie ou digite o c\u00f3digo do produto', required: true });
    var tipo = h('input', { type: 'text', id: 'xoc-tipo', placeholder: 'Tipo do produto (se conhecido)' });
    var encontrada = select('xoc-encontrada', [['', 'Selecione a gaiola onde foi encontrado']].concat(o.gaiolas.map(function (g) { return [g.codigo, g.codigo]; })), '');
    var correta = h('input', { type: 'text', id: 'xoc-correta', placeholder: 'C\u00f3digo da gaiola correta, se conhecido' });
    var pessoa = h('input', { type: 'text', id: 'xoc-pessoa', placeholder: 'Nome de quem encontrou', required: true });
    var quando = h('input', { type: 'datetime-local', id: 'xoc-quando', value: U.paraDatetimeLocal(new Date(agora())) });
    var outra = h('input', { type: 'text', id: 'xoc-outra', placeholder: 'Descreva a categoria, se selecionou Outra' });
    var nota = h('textarea', { id: 'xoc-nota', rows: '2', placeholder: 'Observa\u00e7\u00f5es (opcional)' });
    var video = h('video', { id: 'xoc-video', hidden: true, autoplay: true, muted: true, playsinline: true, class: 'xpt-camera-video' });
    var abrirCamera = h('button', { type: 'button', class: 'botao botao--secundario', id: 'xoc-abrir-camera', text: 'Escanear pela c\u00e2mera' });
    var fecharCamera = h('button', { type: 'button', class: 'botao botao--texto', id: 'xoc-fechar-camera', text: 'Fechar c\u00e2mera', hidden: true });
    var avisoCamera = h('p', { class: 'texto-apoio', id: 'xoc-aviso-camera', role: 'status' });
    var erro = aviso();
    function pararCamera() { if (Scanner) Scanner.parar(); video.hidden = true; fecharCamera.hidden = true; abrirCamera.hidden = false; }
    abrirCamera.addEventListener('click', function () {
      avisoCamera.textContent = '';
      if (!Scanner || !Scanner.cameraSuportada() || !Scanner.barcodeDetectorSuportado()) {
        avisoCamera.textContent = 'Leitura pela c\u00e2mera indispon\u00edvel neste navegador. Digite o c\u00f3digo manualmente.'; return;
      }
      video.hidden = false; abrirCamera.hidden = true; fecharCamera.hidden = false;
      Scanner.iniciar(video, null, function (valor, formato) {
        produto.value = valor; avisoCamera.textContent = 'C\u00f3digo lido (' + formato + '). Confira antes de registrar.';
        pararCamera(); produto.focus();
      }, function (mensagem) { avisoCamera.textContent = mensagem; pararCamera(); },
      function (bruto, motivo) { avisoCamera.textContent = 'C\u00f3digo n\u00e3o reconhecido (' + motivo + '). Tente novamente ou digite manualmente.'; }).catch(function () {});
    });
    fecharCamera.addEventListener('click', function () { pararCamera(); avisoCamera.textContent = ''; });
    el.pOcorrencias.appendChild(h('section', { class: 'cartao' }, [
      h('h3', { text: 'Registrar ocorr\u00eancia' }),
      h('p', { class: 'texto-apoio', text: 'A ocorr\u00eancia fica vinculada \u00e0 gaiola onde o produto foi encontrado (POO). As resolvidas permanecem no hist\u00f3rico; identificadores repetidos s\u00e3o sinalizados.' }),
      h('form', { id: 'xoc-form', novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var dados = { categoria: categoria.value, produtoId: produto.value, tipoProduto: tipo.value, gaiolaEncontrada: encontrada.value,
          gaiolaCorreta: correta.value, identificadoPor: pessoa.value, quandoMs: quando.value ? new Date(quando.value).getTime() : agora(),
          outraDescricao: outra.value, observacao: nota.value };
        var r = X.novaOcorrencia(dados, agora()); if (!r.ok) { erro.textContent = r.erro; return; }
        var repetidos = X.produtoJaRegistrado(op(), r.ocorrencia.produtoId);
        var salvo = mutarOp(function (x) { x.ocorrencias.push(r.ocorrencia); }); if (!salvo) return;
        pararCamera(); renderTudo();
        UI.avisar('Ocorr\u00eancia registrada.' + (repetidos.length ? ' Aten\u00e7\u00e3o: este identificador j\u00e1 aparece em ' + repetidos.length + ' ocorr\u00eancia(s).' : ''), repetidos.length ? 'info' : 'sucesso');
      } }, [
        h('div', { class: 'xpt-grid' }, [
          UI.campo('Categoria', categoria), UI.campo('Identificador do produto', produto),
          h('div', { class: 'xpt-scanner-controls' }, [abrirCamera, fecharCamera]), video, avisoCamera,
          UI.campo('Tipo do produto', tipo), UI.campo('Gaiola encontrada (POO)', encontrada), UI.campo('Gaiola correta', correta),
          UI.campo('Encontrado por', pessoa), UI.campo('Data e hora', quando), UI.campo('Descri\u00e7\u00e3o (categoria Outra)', outra), UI.campo('Observa\u00e7\u00f5es', nota)
        ]), erro, h('button', { type: 'submit', class: 'botao botao--primario', text: 'Registrar ocorr\u00eancia' })
      ])
    ]));
    var lista = o.ocorrencias.slice().sort(function (a, b) { return Date.parse(b.registradaEm) - Date.parse(a.registradaEm); });
    var corpo = h('div', { class: 'xpt-lista-ocorrencias' }, lista.map(function (oc) {
      var campos = [];
      if (oc.produtoId) campos.push('Produto: ' + oc.produtoId);
      if (oc.gaiolaEncontrada) campos.push('POO / gaiola encontrada: ' + oc.gaiolaEncontrada);
      if (oc.gaiolaCorreta) campos.push('Gaiola correta: ' + oc.gaiolaCorreta);
      if (oc.tipoProduto) campos.push('Tipo: ' + oc.tipoProduto);
      if (oc.identificadoPor) campos.push('Encontrado por: ' + oc.identificadoPor);
      if (oc.observacao) campos.push(oc.observacao);
      return h('article', { class: 'cartao xpt-ocorrencia' }, [
        h('div', { class: 'cartao__cabecalho' }, [
          h('div', {}, [h('h3', { text: X.rotuloCategoria(oc) }), h('p', { class: 'texto-apoio', text: dataHora(oc.registradaEm) + ' \u00b7 ' + (oc.status === 'resolvido' ? 'Resolvida' : 'Pendente') })]),
          h('button', { type: 'button', class: 'botao botao--secundario', dataset: { acao: 'status-ocorrencia', id: oc.id }, text: oc.status === 'resolvido' ? 'Reabrir' : 'Registrar resolu\u00e7\u00e3o' })
        ]),
        h('p', { class: 'texto-apoio', text: campos.join(' \u00b7 ') || 'Sem detalhes adicionais.' }),
        oc.historico && oc.historico.length ? h('details', {}, [
          h('summary', { text: 'Hist\u00f3rico de altera\u00e7\u00f5es (' + oc.historico.length + ')' }),
          h('ul', {}, oc.historico.map(function (hist) { return h('li', { text: dataHora(hist.em) + ' \u00b7 ' + hist.de + ' \u2192 ' + hist.para + (hist.nota ? ' \u00b7 ' + hist.nota : '') }); }))
        ]) : null
      ]);
    }));
    corpo.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-acao="status-ocorrencia"]'); if (!b) return;
      var oc = op().ocorrencias.filter(function (x) { return x.id === b.dataset.id; })[0]; if (!oc) return;
      var novo = oc.status === 'resolvido' ? 'pendente' : 'resolvido';
      if (!global.confirm('Confirmar altera\u00e7\u00e3o da ocorr\u00eancia para "' + novo + '"? O hist\u00f3rico ser\u00e1 preservado.')) return;
      if (mutarOp(function (x) { var atual = x.ocorrencias.filter(function (y) { return y.id === b.dataset.id; })[0]; var r = X.mudarStatus(atual, novo, '', agora()); if (!r.ok) throw new Error(r.erro); })) { renderTudo(); UI.avisar('Status da ocorr\u00eancia atualizado.', 'sucesso'); }
    });
    el.pOcorrencias.appendChild(h('section', { class: 'cartao' }, [
      h('div', { class: 'cartao__cabecalho' }, [h('h3', { text: 'Ocorr\u00eancias da opera\u00e7\u00e3o (' + lista.length + ')' }), h('span', { class: 'chip chip--neutro', text: X.pendentesAbertas(o).length + ' pendente(s)' })]),
      lista.length ? corpo : h('p', { class: 'texto-apoio', text: 'Nenhuma ocorr\u00eancia registrada nesta opera\u00e7\u00e3o.' })
    ]));
  }

  // ================================================================ veículos e fotos
  function anexarFoto(veiculoId, file) {
    if (!file) return Promise.resolve(false);
    if (!F || !F.processarArquivo || !F.salvar) return Promise.reject(new Error('O armazenamento de fotos não está disponível.'));
    var fotoId = U.gerarId('foto');
    return Promise.resolve(F.pedirPersistencia()).catch(function () { return false; }).then(function () {
      return F.processarArquivo(file);
    }).then(function (imagem) {
      return F.salvar({ id: fotoId, blob: imagem.blob, largura: imagem.largura, altura: imagem.altura,
        mime: imagem.mime, criadoEm: new Date(agora()).toISOString(), sincronizada: false });
    }).then(function () {
      var r = mutarOp(function (x) {
        var v = x.veiculos.filter(function (y) { return y.id === veiculoId; })[0];
        if (!v) throw new Error('Veículo não encontrado ao associar a foto.');
        if (v.fotoId) { v.fotosAnteriores = v.fotosAnteriores || []; v.fotosAnteriores.push({ fotoId: v.fotoId, em: new Date(agora()).toISOString() }); }
        v.fotoId = fotoId;
        v.historico.push({ em: new Date(agora()).toISOString(), acao: 'foto_hand_lacre_associada' });
      });
      if (!r) throw new Error('A foto foi armazenada neste aparelho, mas não foi possível associá-la ao veículo.');
      return true;
    });
  }

  function renderVeiculos() {
    var o = op(); UI.limpar(el.pVeiculos); if (!o) return;
    var placa = h('input', { type: 'text', id: 'xv-placa', required: true, maxlength: '10', placeholder: 'ABC1D23' });
    var motorista = h('input', { type: 'text', id: 'xv-motorista', placeholder: 'Nome do motorista (opcional)' });
    var paletes = h('input', { type: 'number', id: 'xv-paletes', min: '0', step: '1', inputmode: 'numeric', placeholder: 'Não informado' });
    var redes = h('input', { type: 'number', id: 'xv-redes', min: '0', step: '1', inputmode: 'numeric', placeholder: 'Não informado' });
    var saida = h('input', { type: 'datetime-local', id: 'xv-saida', value: U.paraDatetimeLocal(new Date(agora())) });
    var arquivo = h('input', { type: 'file', id: 'xv-foto', accept: 'image/*', capture: 'environment' });
    var previa = h('div', { class: 'xpt-foto-previa' });
    var imgPrev = h('img', { alt: 'Pré-visualização da foto conjunta do HAND e do lacre', hidden: true });
    var legenda = h('p', { class: 'texto-apoio', text: 'Foto opcional: enquadre o HAND e o lacre juntos na mesma imagem. A foto será guardada neste aparelho; sincronização entre dispositivos ainda não está configurada.' });
    var erro = aviso();
    previa.appendChild(imgPrev);
    arquivo.addEventListener('change', function () {
      if (imgPrev.dataset.url) URL.revokeObjectURL(imgPrev.dataset.url);
      imgPrev.removeAttribute('src'); imgPrev.hidden = true; imgPrev.dataset.url = '';
      var f = arquivo.files && arquivo.files[0]; if (!f) return;
      var url = URL.createObjectURL(f); imgPrev.src = url; imgPrev.dataset.url = url; imgPrev.hidden = false;
    });
    el.pVeiculos.appendChild(h('section', { class: 'cartao' }, [
      h('h3', { text: 'Registrar veículo' }),
      h('p', { class: 'texto-apoio', text: 'Etapa 3 de 4: cadastre cada veículo antes de iniciar o carregamento. Depois, na ficha do veículo, registre uma a uma as gaiolas que forem embarcadas. A foto é opcional.' }),
      h('form', { id: 'xv-form', novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var dataSaida = saida.value ? new Date(saida.value).getTime() : null;
        if (saida.value && !isFinite(dataSaida)) { erro.textContent = 'Informe um horário de saída válido.'; return; }
        var r = X.novoVeiculo({ placa: placa.value, motorista: motorista.value,
          paletes: paletes.value, redes: redes.value, saidaMs: dataSaida }, agora());
        if (!r.ok) { erro.textContent = r.erro; return; }
        var idVeiculo = r.veiculo.id, file = arquivo.files && arquivo.files[0];
        if (!mutarOp(function (x) {
          if (x.veiculos.some(function (v) { return X.normalizarPlaca(v.placa) === X.normalizarPlaca(r.veiculo.placa); })) throw new Error('Já existe um veículo com esta placa nesta operação.');
          x.veiculos.push(r.veiculo);
        })) return;
        if (file) {
          anexarFoto(idVeiculo, file).then(function () {
            UI.avisar('Veículo e foto do HAND + lacre registrados neste aparelho.', 'sucesso'); renderTudo();
          }).catch(function (errFoto) {
            UI.avisar('Veículo salvo, mas a foto não foi associada: ' + (errFoto.message || errFoto), 'erro'); renderTudo();
          });
        } else {
          UI.avisar('Veículo registrado.', 'sucesso'); renderTudo();
        }
      } }, [
        h('div', { class: 'xpt-grid' }, [
          UI.campo('Placa', placa), UI.campo('Motorista', motorista),
          UI.campo('Quantidade de paletes', paletes), UI.campo('Quantidade de redes', redes), UI.campo('Horário de saída', saida),
          UI.campo('Fotografia única — HAND e lacre juntos', arquivo, 'Use a câmera traseira do celular quando disponível.')
        ]),
        h('label', { class: 'botao botao--secundario xpt-botao-foto', for: 'xv-foto', text: 'Tirar foto do HAND + lacre / escolher imagem' }),
        previa, legenda, erro,
        h('button', { type: 'submit', class: 'botao botao--primario', text: 'Salvar veículo' })
      ])
    ]));

    el.pVeiculos.appendChild(h('section', { class: 'cartao' }, [h('h3', { text: 'Carregamento — etapa 4 de 4' }), h('p', { class: 'texto-apoio', text: o.fimCarregamentoAt ? 'Carregamento finalizado. O registro de novas gaiolas está bloqueado.' : 'Na aba Gaiolas e auditoria, selecione o veículo diretamente na linha de cada gaiola. O sistema impede que a mesma gaiola fique associada a dois veículos.' })]));
    if (!o.veiculos.length) {
      el.pVeiculos.appendChild(h('section', { class: 'cartao' }, [h('p', { class: 'texto-apoio', text: 'Cadastre o veículo acima para começar o carregamento.' })]));
      return;
    }
    o.veiculos.forEach(function (v) {
      var img = h('img', { alt: 'HAND e lacre do veículo ' + v.placa, hidden: true, class: 'xpt-foto-relatorio' });
      var blocoFoto = h('div', { class: 'xpt-foto-container' }, [
        img,
        h('p', { class: 'texto-apoio', text: v.fotoId ? 'Foto associada a este veículo (armazenamento local).' : 'Nenhuma foto registrada para este veículo.' })
      ]);
      if (v.fotoId && F) F.urlDe(v.fotoId).then(function (url) { if (url && img.isConnected) { img.src = url; img.hidden = false; } });
      var listaGaiolas = v.gaiolaIds.map(function (gid) {
        var g = o.gaiolas.filter(function (x) { return x.id === gid; })[0];
        return g ? h('li', {}, [g.codigo + (g.vuc ? ' · VUC' : ''), ' ', o.fimCarregamentoAt ? null : h('button', { type: 'button', class: 'botao botao--texto', dataset: { acao: 'descarregar', veiculo: v.id, gaiola: gid }, text: 'Remover do veículo' })]) : null;
      });
      el.pVeiculos.appendChild(h('section', { class: 'cartao xpt-veiculo' }, [
        h('div', { class: 'cartao__cabecalho' }, [
          h('div', {}, [h('h3', { text: v.placa }), h('p', { class: 'texto-apoio', text: (v.motorista || 'Motorista não informado') + ' · saída: ' + (v.saidaAt ? hhmm(v.saidaAt) : 'não informada') })]),
          h('span', { class: 'chip chip--neutro', text: v.gaiolaIds.length + ' gaiola(s)' })
        ]),
        h('p', { class: 'texto-apoio', text: 'Paletes: ' + (v.paletes == null ? '—' : v.paletes) + ' · Redes: ' + (v.redes == null ? '—' : v.redes) }),
        blocoFoto,
        h('div', {}, [h('h4', { text: 'Gaiolas carregadas (' + v.gaiolaIds.length + ')' }), listaGaiolas.length ? h('ul', {}, listaGaiolas) : h('p', { class: 'texto-apoio', text: 'Nenhuma gaiola carregada.' })])
      ]));
    });
  }

  // ================================================================ relatórios
  function renderRelatorios() {
    var o = op(); UI.limpar(el.pRelatorios); if (!o) return;
    var texto = X.relatorioBasico(o);
    var pend = X.pendentesAbertas(o);
    var auditoria = X.resumoAuditoria(o.gaiolas);
    el.pRelatorios.appendChild(h('section', { class: 'cartao' }, [
      h('h3', { text: 'Relatório básico de expedição' }),
      h('p', { class: 'texto-apoio', text: 'O relatório usa somente os dados registrados nesta operação. Campos não informados não são inventados.' }),
      h('pre', { class: 'texto-relatorio', text: texto, tabindex: '0' }),
      h('div', { class: 'acoes-form' }, [
        h('button', { type: 'button', class: 'botao botao--secundario', text: 'Copiar relatório', onclick: function () {
          function copiarComFallback() {
            var campo = h('textarea', { 'aria-label': 'Texto do relatório para copiar' });
            campo.value = texto;
            campo.style.position = 'fixed'; campo.style.opacity = '0';
            document.body.appendChild(campo); campo.focus(); campo.select();
            var copiou = false;
            try { copiou = document.execCommand('copy'); } catch (e) { copiou = false; }
            campo.remove();
            if (copiou) UI.avisar('Relatório copiado para a área de transferência.', 'sucesso');
            else UI.avisar('Não foi possível copiar automaticamente. Selecione o texto do relatório e copie manualmente.', 'erro');
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texto).then(function () {
              UI.avisar('Relatório copiado para a área de transferência.', 'sucesso');
            }).catch(copiarComFallback);
          } else copiarComFallback();
        } }),
        h('button', { type: 'button', class: 'botao botao--primario', text: 'Gerar PDF / imprimir relatório detalhado', onclick: function () { imprimirRelatorioDetalhado(o.id); } })
      ])
    ]));
    el.pRelatorios.appendChild(h('section', { class: 'cartao' }, [
      h('h3', { text: 'Resumo de auditoria' }),
      h('p', { class: 'texto-apoio', text: 'Concluídas: ' + auditoria.concluidas + ' de ' + auditoria.convencionais + ' gaiolas convencionais (' + (auditoria.percentual == null ? '—' : String(auditoria.percentual).replace('.', ',') + '%') + '). VUC: ' + auditoria.vuc + '. Pendências de ocorrência: ' + pend.length + '.' }),
      h('h3', { text: 'Ocorrências e resoluções' }),
      o.ocorrencias.length ? h('ul', {}, o.ocorrencias.map(function (oc) {
        return h('li', { text: dataHora(oc.registradaEm) + ' · ' + X.rotuloCategoria(oc) + ' · ' + (oc.produtoId || 'sem identificador') + ' · ' + oc.status + (oc.observacao ? ' · ' + oc.observacao : '') });
      })) : h('p', { class: 'texto-apoio', text: 'Nenhuma ocorrência registrada.' })
    ]));
  }

  function imprimirRelatorioDetalhado(opId) {
    var o = estado.operacoes.filter(function (x) { return x.id === opId; })[0]; if (!o) return;
    var titulo = 'MeliNotepad_XPT_' + (o.diaRef || X.diaRef(Date.parse(o.inicioAt)));
    NS.Impressao.imprimir(titulo, function (raiz, criar) {
      raiz.appendChild(criar('h1', { text: 'MeliNotepad — Relatório operacional XPT' }));
      raiz.appendChild(criar('p', { text: 'Data de referência: ' + U.formatarData(new Date(o.inicioAt)) }));
      raiz.appendChild(criar('p', { text: 'Início: ' + dataHora(o.inicioAt) + ' · Fim do carregamento: ' + (o.fimCarregamentoAt ? dataHora(o.fimCarregamentoAt) : 'não registrado') + ' · Encerramento: ' + (o.encerradaAt ? dataHora(o.encerradaAt) : 'operação aberta') }));
      raiz.appendChild(criar('h2', { text: 'Quantidades' }));
      raiz.appendChild(criar('p', { text: 'Pacotes: ' + (o.quantidades.pacotes == null ? '—' : o.quantidades.pacotes) + ' · Volumosos: ' + (o.quantidades.volumosos == null ? '—' : o.quantidades.volumosos) + ' · Extra volumosos: ' + (o.quantidades.extraVolumosos == null ? '—' : o.quantidades.extraVolumosos) + ' · Total de produtos: ' + X.totais(o).totalProdutos }));
      raiz.appendChild(criar('p', { text: 'Paletes: ' + (o.quantidades.paletes == null ? '—' : o.quantidades.paletes) + ' · Redes: ' + (o.quantidades.redes == null ? '—' : o.quantidades.redes) + ' · Total BK: ' + (o.quantidades.totalBK == null ? '—' : o.quantidades.totalBK) }));
      raiz.appendChild(criar('h2', { text: 'Gaiolas e auditoria' }));
      var a = X.resumoAuditoria(o.gaiolas);
      raiz.appendChild(criar('p', { text: 'Gaiolas: ' + a.total + ' · VUC: ' + a.vuc + ' · Convencionais: ' + a.convencionais + ' · Concluídas: ' + a.concluidas + ' · Não realizadas: ' + (a.pendentes + a.naoIniciadas) + ' · Percentual: ' + (a.percentual == null ? '—' : a.percentual + '%') }));
      raiz.appendChild(criar('table', { class: 'tabela-modulo' }, [
        criar('thead', {}, [criar('tr', {}, ['Código', 'Tipo', 'Estado', 'Auditor', 'Data da auditoria'].map(function (x) { return criar('th', { text: x }); }))]),
        criar('tbody', {}, o.gaiolas.map(function (g) { return criar('tr', {}, [
          criar('td', { text: g.codigo }), criar('td', { text: g.vuc ? 'VUC' : 'Convencional' }),
          criar('td', { text: X.rotuloAuditoria(o, g) }), criar('td', { text: g.auditoria.auditor || '-' }),
          criar('td', { text: g.auditoria.em ? dataHora(g.auditoria.em) : '—' })
        ]); }))
      ]));
      raiz.appendChild(criar('h2', { text: 'Veículos, gaiolas e fotos' }));
      return Promise.all(o.veiculos.map(function (v) { return v.fotoId && F ? F.urlDe(v.fotoId) : Promise.resolve(null); })).then(function (urlsFotos) {
        o.veiculos.forEach(function (v, i) {
          raiz.appendChild(criar('h3', { text: v.placa + (v.motorista ? ' · ' + v.motorista : '') }));
          raiz.appendChild(criar('p', { text: 'Rotas: ' + (v.rotas || []).join(', ') + ' · Saída: ' + (v.saidaAt ? dataHora(v.saidaAt) : 'não registrada') + ' · Paletes: ' + (v.paletes == null ? '—' : v.paletes) + ' · Redes: ' + (v.redes == null ? '—' : v.redes) }));
          var codigos = (v.gaiolaIds || []).map(function (gid) { var g = o.gaiolas.filter(function (x) { return x.id === gid; })[0]; return g ? g.codigo : null; }).filter(Boolean);
          raiz.appendChild(criar('p', { text: 'Gaiolas carregadas: ' + (codigos.join(', ') || 'nenhuma') }));
          if (urlsFotos[i]) {
            var imagem = criar('img', { src: urlsFotos[i], alt: 'HAND e lacre juntos — veículo ' + v.placa, class: 'xpt-foto-relatorio' });
            raiz.appendChild(imagem);
            raiz.appendChild(criar('p', { text: 'Fotografia conjunta do HAND e do lacre.' }));
          } else raiz.appendChild(criar('p', { text: 'Foto HAND + lacre: não registrada ou indisponível neste aparelho.' }));
        });
        raiz.appendChild(criar('h2', { text: 'Ocorrências e histórico de resolução' }));
        raiz.appendChild(criar('ul', {}, o.ocorrencias.map(function (oc) {
          var hist = (oc.historico || []).map(function (z) { return dataHora(z.em) + ' ' + z.de + ' → ' + z.para + (z.nota ? ' (' + z.nota + ')' : ''); }).join('; ');
          return criar('li', { text: dataHora(oc.registradaEm) + ' · ' + X.rotuloCategoria(oc) + ' · produto: ' + (oc.produtoId || '—') + ' · tipo: ' + (oc.tipoProduto || '—') + ' · gaiola encontrada: ' + (oc.gaiolaEncontrada || '—') + ' · gaiola correta: ' + (oc.gaiolaCorreta || '—') + ' · identificado por: ' + (oc.identificadoPor || '—') + ' · situação: ' + oc.status + ' · observação: ' + (oc.observacao || '—') + (hist ? ' · histórico: ' + hist : '') });
        })));
      });
    }).catch(function (e) { UI.avisar('Não foi possível preparar o relatório: ' + (e.message || e), 'erro'); });
  }

  // ================================================================ montagem e navegação
  function criarEstrutura() {
    UI.limpar(el.raiz);
    var tabela = h('table', { class: 'tabela-modulo' }, [
      thead(['Data', 'Início', 'Fim do carregamento', 'Situação', 'Gaiolas', 'Pendências', '']),
      h('tbody', { id: 'xo-corpo-ops' })
    ]);
    el.corpoOps = tabela.querySelector('tbody');
    el.tabelaOps = tabela;
    el.vazioOps = h('p', { class: 'texto-apoio', text: 'Nenhuma operação XPT registrada.' });
    el.listaOps = h('section', { class: 'cartao' }, [
      h('div', { class: 'cartao__cabecalho' }, [h('h2', { text: 'Operações XPT' }), h('button', { type: 'button', class: 'botao botao--primario', id: 'xo-nova', text: '+ Nova operação', onclick: novaOperacao })]),
      h('p', { class: 'texto-apoio', text: 'A operação mantém sua data de referência mesmo que atravesse a meia-noite. Fim do carregamento e encerramento são registros separados.' }),
      el.vazioOps, h('div', { class: 'tabela-rolavel' }, [tabela])
    ]);
    el.detalhe = h('section', { id: 'xo-detalhe', hidden: true }, []);
    el.cabOp = h('div', { id: 'xo-cabecalho' });
    el.navAbas = h('nav', { class: 'nav-sub xpt-abas', 'aria-label': 'Seções da operação XPT' },
      ABAS.map(function (a) { return h('button', { type: 'button', class: 'btn-nav' + (a[0] === ui.aba ? ' is-ativo' : ''), dataset: { aba: a[0] }, 'aria-pressed': a[0] === ui.aba ? 'true' : 'false', text: a[1] }); }));
    el.pQuant = h('div', { id: 'xo-quantidades' });
    el.pGaiolas = h('div', { id: 'xo-gaiolas', hidden: true });
    el.pOcorrencias = h('div', { id: 'xo-ocorrencias', hidden: true });
    el.pVeiculos = h('div', { id: 'xo-veiculos', hidden: true });
    el.pRelatorios = h('div', { id: 'xo-relatorios', hidden: true });
    el.detalhe.appendChild(el.cabOp); el.detalhe.appendChild(el.navAbas);
    [el.pQuant, el.pGaiolas, el.pOcorrencias, el.pVeiculos, el.pRelatorios].forEach(function (x) { el.detalhe.appendChild(x); });
    el.raiz.appendChild(h('section', { class: 'cartao cartao--amarelo' }, [
      h('h2', { text: 'XPT — Expedição operacional' }),
      h('p', { class: 'texto-apoio', text: 'Registre a operação, quantidades, auditorias, ocorrências, veículos e relatórios. Os registros XPT ficam separados dos dados do NEX e de Intervalos. Atenção: nesta versão, os dados ficam neste navegador; a sincronização entre celular e notebook ainda não está configurada.' })
    ]));
    el.raiz.appendChild(el.listaOps); el.raiz.appendChild(el.detalhe);
    el.navAbas.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-aba]'); if (!b) return;
      ui.aba = b.dataset.aba; renderAba();
    });
    el.corpoOps.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-acao="abrir"]'); if (b) abrirOperacao(b.dataset.id);
    });
    el.pVeiculos.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-acao="descarregar"]'); if (!b) return;
      var atual = op(); if (atual && (atual.fimCarregamentoAt || atual.encerradaAt)) { UI.avisar('O carregamento foi finalizado; não é possível alterar as gaiolas embarcadas.', 'erro'); return; }
      if (!global.confirm('Remover esta gaiola do veículo? O histórico da associação será preservado.')) return;
      var r = mutarOp(function (x) { var z = X.descarregarGaiola(x, b.dataset.veiculo, b.dataset.gaiola, agora()); if (!z.ok) throw new Error(z.erro); });
      if (r) { renderTudo(); UI.avisar('Gaiola removida do veículo.', 'sucesso'); }
    });
  }

  function renderAba() {
    if (ui.aba !== 'ocorrencias' && Scanner) Scanner.parar();
    var mapa = { quantidades: el.pQuant, gaiolas: el.pGaiolas, ocorrencias: el.pOcorrencias, veiculos: el.pVeiculos, relatorios: el.pRelatorios };
    Object.keys(mapa).forEach(function (k) { mapa[k].hidden = k !== ui.aba; });
    Array.prototype.forEach.call(el.navAbas.querySelectorAll('button[data-aba]'), function (b) {
      var ativo = b.dataset.aba === ui.aba;
      b.classList.toggle('is-ativo', ativo); b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    });
    if (ui.aba === 'quantidades') renderQuantidades();
    else if (ui.aba === 'gaiolas') renderGaiolas();
    else if (ui.aba === 'ocorrencias') renderOcorrencias();
    else if (ui.aba === 'veiculos') renderVeiculos();
    else if (ui.aba === 'relatorios') renderRelatorios();
  }

  function renderTudo() {
    if (!el.raiz) return;
    renderLista();
    var o = op();
    if (!o) {
      el.listaOps.hidden = false; el.detalhe.hidden = true;
      return;
    }
    el.listaOps.hidden = true; el.detalhe.hidden = false;
    renderCabecalho();
    renderAba();
  }

  function init() {
    el.raiz = document.getElementById('modulo-xpt');
    if (!el.raiz || !NS || !X || !UI || !NS.ModStore || !F) return;
    recarregar();
    criarEstrutura();
    if (avisoArm) UI.avisar(avisoArm, 'erro');
    store.ouvirOutrasAbas(function () { recarregar(); renderTudo(); });
    if (global.addEventListener) global.addEventListener('storage', function (e) {
      if (e.key === store.chave) { recarregar(); renderTudo(); }
    });
    renderTudo();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
