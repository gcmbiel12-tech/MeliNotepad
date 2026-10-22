/* Preparação e apresentação imprimível dos relatórios dos históricos NEX e Intervalos. */
(function (global) {
  'use strict';
  var NS = global.MeliNotepad, U = NS.Utils, C = NS.Constants, IR = NS.IntervalosRegras;

  function validarSelecao(o) {
    o = o || {};
    if (o.periodo === 'dia') {
      if (!dataValida(o.inicio)) return { ok: false, erro: 'Informe uma data válida para o relatório.' };
    } else if (o.periodo === 'intervalo') {
      if (!dataValida(o.inicio) || !dataValida(o.fim)) return { ok: false, erro: 'Informe as datas inicial e final do relatório.' };
      if (o.inicio > o.fim) return { ok: false, erro: 'A data inicial não pode ser posterior à data final.' };
    } else if (o.periodo !== 'todo') return { ok: false, erro: 'Selecione um período válido.' };
    if (o.tipo !== 'resumido' && o.tipo !== 'detalhado') return { ok: false, erro: 'Selecione um tipo de relatório válido.' };
    return { ok: true };
  }

  function dataValida(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
    var d = new Date(v + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }

  function selecionar(registros, campo, o) {
    var validacao = validarSelecao(o);
    if (!validacao.ok) return { ok: false, erro: validacao.erro, registros: [] };
    var consulta = { campoData: campo, periodo: o.periodo === 'dia' ? 'data' : o.periodo === 'todo' ? 'todos' : 'intervalo' };
    if (o.periodo === 'dia') consulta.data = o.inicio;
    if (o.periodo === 'intervalo') { consulta.inicio = o.inicio; consulta.fim = o.fim; }
    return { ok: true, registros: U.consultarHistorico(registros, consulta) };
  }

  function diaInfo(dias, instante) {
    var dia = U.dataOperacional(instante);
    if (!dias[dia]) dias[dia] = { data: dia, quantidade: 0, sacas: 0, pacotes: 0, ocorrencias: 0, pendentes: 0, resolvidas: 0, minutosDecorridos: 0, categorias: {} };
    return dias[dia];
  }

  function construirNex(registros, o) {
    var selecionados = selecionar(registros, 'startTime', o);
    if (!selecionados.ok) return selecionados;
    var sessoes = selecionados.registros, dias = {}, totais = { sessoes: sessoes.length, sacas: 0, pacotes: 0, ocorrencias: 0, pendentes: 0, resolvidas: 0, categorias: {} };
    sessoes.forEach(function (s) {
      var d = diaInfo(dias, s.startTime);
      d.quantidade++; d.sacas += Number(s.sacas) || 0; d.pacotes += Number(s.pacotes) || 0;
      totais.sacas += Number(s.sacas) || 0; totais.pacotes += Number(s.pacotes) || 0;
      (s.occurrences || []).forEach(function (oc) {
        var cat = C.categoriaLabel(oc.category), resolvida = oc.status === C.STATUS.RESOLVIDO;
        d.ocorrencias++; totais.ocorrencias++;
        if (resolvida) { d.resolvidas++; totais.resolvidas++; }
        else if (oc.status === C.STATUS.PENDENTE) { d.pendentes++; totais.pendentes++; }
        d.categorias[cat] = (d.categorias[cat] || 0) + 1;
        totais.categorias[cat] = (totais.categorias[cat] || 0) + 1;
      });
    });
    return { ok: true, modulo: 'NEX', tipo: o.tipo, periodo: periodoTexto(o, sessoes, 'startTime'), quantidade: sessoes.length, geradoEm: U.formatarDataHoraOperacional(o.agora || new Date()), totais: totais, dias: Object.keys(dias).sort().map(function (k) { return dias[k]; }), registros: o.tipo === 'detalhado' ? sessoes.map(function (s) { return { id: s.id, startTime: s.startTime, endTime: s.endTime || '', sacas: Number(s.sacas) || 0, pacotes: Number(s.pacotes) || 0, occurrences: (s.occurrences || []).map(function (oc) { return { code: oc.code || '', category: C.categoriaLabel(oc.category), status: C.STATUS_LABEL[oc.status] || 'Não informado', note: oc.note || '', createdAt: oc.createdAt || '' }; }) }; }) : [] };
  }

  function construirIntervalos(registros, o) {
    var encerrados = (registros || []).filter(function (i) { return i.status === 'encerrado'; });
    var selecionados = selecionar(encerrados, 'saidaAt', o);
    if (!selecionados.ok) return selecionados;
    var itens = selecionados.registros, dias = {}, totais = { intervalos: itens.length, noPrazo: 0, excedidos: 0, minutosDecorridos: 0 };
    itens.forEach(function (i) {
      var d = diaInfo(dias, i.saidaAt), av = IR.avaliar(i, Date.parse(i.retornoRealAt));
      d.quantidade++; d.minutosDecorridos += av.minutos; d.minutosPrevistos = (d.minutosPrevistos || 0) + i.duracaoPrevistaMin;
      if (av.excedido) { d.excedidos = (d.excedidos || 0) + 1; totais.excedidos++; }
      else { d.noPrazo = (d.noPrazo || 0) + 1; totais.noPrazo++; }
      totais.minutosDecorridos += av.minutos;
    });
    return { ok: true, modulo: 'Intervalos', tipo: o.tipo, periodo: periodoTexto(o, itens, 'saidaAt'), quantidade: itens.length, geradoEm: U.formatarDataHoraOperacional(o.agora || new Date()), totais: totais, dias: Object.keys(dias).sort().map(function (k) { return dias[k]; }), registros: o.tipo === 'detalhado' ? itens.map(function (i) {
      var av = IR.avaliar(i, Date.parse(i.retornoRealAt));
      return { id: i.id, funcionarioId: i.funcionarioId, funcionarioNome: i.funcionarioNome, setor: i.setor || '', saidaAt: i.saidaAt, duracaoPrevistaMin: i.duracaoPrevistaMin, retornoPrevistoAt: i.retornoPrevistoAt, retornoRealAt: i.retornoRealAt, minutosDecorridos: av.minutos, situacao: av.excedido ? 'Excedido' : 'No prazo', alteracoes: (i.alteracoes || []).map(function (a) { return { em: a.em, campo: a.campo, de: a.de, para: a.para }; }) };
    }) : [] };
  }

  function periodoTexto(o, registros, campo) {
    if (o.periodo === 'dia') return U.formatarDataOperacional(o.inicio + 'T12:00:00Z');
    if (o.periodo === 'intervalo') return U.formatarDataOperacional(o.inicio + 'T12:00:00Z') + ' a ' + U.formatarDataOperacional(o.fim + 'T12:00:00Z');
    if (!registros.length) return 'Todo o histórico (sem registros)';
    var datas = registros.map(function (r) { return U.dataOperacional(r[campo]); }).sort();
    return 'Todo o histórico (' + U.formatarDataOperacional(datas[0] + 'T12:00:00Z') + ' a ' + U.formatarDataOperacional(datas[datas.length - 1] + 'T12:00:00Z') + ')';
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function tabela(headers, rows) {
    var t = el('table', 'print-tabela'), thead = el('thead'), tr = el('tr');
    headers.forEach(function (x) { tr.appendChild(el('th', '', x)); }); thead.appendChild(tr); t.appendChild(thead);
    var body = el('tbody');
    rows.forEach(function (row) { var r = el('tr'); row.forEach(function (x) { r.appendChild(el('td', '', String(x))); }); body.appendChild(r); });
    t.appendChild(body); return t;
  }

  function renderizar(area, r) {
    while (area.firstChild) area.removeChild(area.firstChild);
    area.appendChild(el('h1', 'print-titulo', 'MeliNotepad'));
    area.appendChild(el('p', 'print-info', 'Módulo: ' + r.modulo + ' · Período: ' + r.periodo + ' · Relatório ' + (r.tipo === 'resumido' ? 'resumido' : 'detalhado')));
    area.appendChild(el('p', 'print-info', 'Registros: ' + r.quantidade + ' · Gerado em: ' + r.geradoEm));
    if (r.modulo === 'NEX') renderNex(area, r); else renderIntervalos(area, r);
  }

  function renderNex(area, r) {
    if (!r.quantidade) { area.appendChild(el('p', 'print-vazio', 'Nenhuma operação encontrada no período selecionado.')); return; }
    area.appendChild(el('h2', 'print-subtitulo', 'Resumo operacional'));
    area.appendChild(el('p', 'print-totais', 'Sessões: ' + r.totais.sessoes + ' · Sacas: ' + U.formatarNumeroBR(r.totais.sacas) + ' · Pacotes: ' + U.formatarNumeroBR(r.totais.pacotes) + ' · Ocorrências: ' + r.totais.ocorrencias + ' (' + r.totais.pendentes + ' pendentes, ' + r.totais.resolvidas + ' resolvidas)'));
    area.appendChild(tabela(['Dia operacional', 'Sessões', 'Sacas', 'Pacotes', 'Ocorrências', 'Pendentes', 'Resolvidas'], r.dias.map(function (d) { return [U.formatarDataOperacional(d.data + 'T12:00:00Z'), d.quantidade, U.formatarNumeroBR(d.sacas), U.formatarNumeroBR(d.pacotes), d.ocorrencias, d.pendentes, d.resolvidas]; })));
    var subtotais = [];
    r.dias.forEach(function (d) { Object.keys(d.categorias).sort().forEach(function (nome) { subtotais.push([U.formatarDataOperacional(d.data + 'T12:00:00Z'), nome, d.categorias[nome]]); }); });
    if (subtotais.length) { area.appendChild(el('h2', 'print-subtitulo', 'Ocorrências por categoria e dia')); area.appendChild(tabela(['Dia operacional', 'Categoria', 'Quantidade'], subtotais)); }
    if (r.tipo !== 'detalhado') return;
    r.registros.forEach(function (s) {
      var sec = el('section', 'print-registro');
      sec.appendChild(el('h2', 'print-dia', U.formatarDataOperacional(s.startTime) + ' · Conferência iniciada às ' + U.formatarHoraOperacional(s.startTime)));
      sec.appendChild(el('p', 'print-info', 'Identificador da sessão: ' + s.id + ' · Finalização: ' + (s.endTime ? U.formatarDataHoraOperacional(s.endTime) : 'não registrada')));
      sec.appendChild(el('p', 'print-info', 'Sacas: ' + U.formatarNumeroBR(s.sacas) + ' · Pacotes: ' + U.formatarNumeroBR(s.pacotes) + ' · Ocorrências: ' + s.occurrences.length));
      if (s.occurrences.length) sec.appendChild(tabela(['Data/hora', 'Código', 'Categoria', 'Situação', 'Observação'], s.occurrences.map(function (o) { return [o.createdAt ? U.formatarDataHoraOperacional(o.createdAt) : '—', o.code, o.category, o.status, o.note || '—']; })));
      else sec.appendChild(el('p', 'print-vazio', 'Nenhuma ocorrência registrada.'));
      area.appendChild(sec);
    });
  }

  function renderIntervalos(area, r) {
    if (!r.quantidade) { area.appendChild(el('p', 'print-vazio', 'Nenhum intervalo encerrado encontrado no período selecionado.')); return; }
    area.appendChild(el('h2', 'print-subtitulo', 'Resumo operacional'));
    area.appendChild(el('p', 'print-totais', 'Intervalos: ' + r.totais.intervalos + ' · No prazo: ' + r.totais.noPrazo + ' · Excedidos: ' + r.totais.excedidos + ' · Tempo decorrido: ' + duracao(r.totais.minutosDecorridos)));
    area.appendChild(tabela(['Dia da saída', 'Intervalos', 'No prazo', 'Excedidos', 'Tempo decorrido'], r.dias.map(function (d) { return [U.formatarDataOperacional(d.data + 'T12:00:00Z'), d.quantidade, d.noPrazo || 0, d.excedidos || 0, duracao(d.minutosDecorridos)]; })));
    if (r.tipo !== 'detalhado') return;
    area.appendChild(el('h2', 'print-subtitulo', 'Detalhamento dos intervalos'));
    r.registros.forEach(function (i) {
      var sec = el('section', 'print-registro');
      sec.appendChild(el('h3', 'print-dia', U.formatarDataOperacional(i.saidaAt) + ' · ' + i.funcionarioNome));
      sec.appendChild(el('p', 'print-info', 'ID do registro: ' + i.id + ' · ID do funcionário: ' + i.funcionarioId + ' · Setor: ' + (i.setor || '—')));
      sec.appendChild(tabela(['Saída', 'Retorno previsto', 'Retorno real', 'Duração prevista', 'Tempo decorrido', 'Situação'], [[U.formatarDataHoraOperacional(i.saidaAt), U.formatarDataHoraOperacional(i.retornoPrevistoAt), U.formatarDataHoraOperacional(i.retornoRealAt), i.duracaoPrevistaMin + ' min', duracao(i.minutosDecorridos), i.situacao]]));
      if (i.alteracoes.length) {
        sec.appendChild(el('h4', 'print-dia', 'Alterações registradas'));
        sec.appendChild(tabela(['Data/hora', 'Campo', 'De', 'Para'], i.alteracoes.map(function (a) { return [U.formatarDataHoraOperacional(a.em), nomeCampoAlteracao(a.campo), valorAlteracao(a.campo, a.de), valorAlteracao(a.campo, a.para)]; })));
      }
      area.appendChild(sec);
    });
  }

  function nomeCampoAlteracao(campo) {
    return { duracaoPrevistaMin: 'Duração prevista', saidaAt: 'Saída', retornoPrevistoAt: 'Retorno previsto' }[campo] || campo;
  }
  function valorAlteracao(campo, valor) {
    if (valor == null) return '—';
    if (campo === 'duracaoPrevistaMin') return valor + ' min';
    if (campo === 'saidaAt' || campo === 'retornoPrevistoAt') return U.formatarDataHoraOperacional(valor);
    return String(valor);
  }

  function duracao(minutos) { return Math.floor(minutos / 60) + ' h ' + (minutos % 60) + ' min'; }
  function iniciarInterface(raiz, modulo, obterRegistros, filtrarExtras, selecaoInicial, rotuloExtras) {
    function node(tag, attrs, children) {
      var n = document.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === 'text') n.textContent = attrs[k];
        else if (k === 'class') n.className = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
      (children || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }
    while (raiz.firstChild) raiz.removeChild(raiz.firstChild);
    var abrir = node('button', { type: 'button', class: 'botao botao--secundario', text: 'Preparar relatório' });
    var painel = node('div', { class: 'relatorio-controles', hidden: '' });
    var periodo = node('select', { 'aria-label': 'Período do relatório' }, [
      node('option', { value: 'todo', text: 'Todo o histórico' }), node('option', { value: 'dia', text: 'Um dia específico' }), node('option', { value: 'intervalo', text: 'Intervalo de datas' })
    ]);
    var inicio = node('input', { type: 'date', 'aria-label': 'Data inicial do relatório' });
    var fim = node('input', { type: 'date', 'aria-label': 'Data final do relatório' });
    var tipo = node('select', { 'aria-label': 'Tipo de relatório' }, [node('option', { value: 'resumido', text: 'Resumo operacional' }), node('option', { value: 'detalhado', text: 'Relatório detalhado' })]);
    var faixaDia = node('label', { class: 'campo' }, [node('span', { text: 'Data' }), inicio]);
    var faixaInicio = node('label', { class: 'campo' }, [node('span', { text: 'De' }), inicio.cloneNode()]);
    var faixaFim = node('label', { class: 'campo' }, [node('span', { text: 'Até' }), fim]);
    inicio = faixaDia.querySelector('input');
    var inicioIntervalo = faixaInicio.querySelector('input');
    var controles = node('div', { class: 'relatorio-campos' }, [node('label', { class: 'campo' }, [node('span', { text: 'Período' }), periodo]), faixaDia, faixaInicio, faixaFim, node('label', { class: 'campo' }, [node('span', { text: 'Formato' }), tipo])]);
    var preparar = node('button', { type: 'button', class: 'botao botao--primario', text: 'Ver prévia' });
    var aviso = node('p', { class: 'texto-aviso', role: 'alert', hidden: '' });
    var pre = node('section', { class: 'relatorio-previa', hidden: '' });
    var metadados = node('p', { class: 'texto-apoio', 'aria-live': 'polite' });
    var ajustar = node('button', { type: 'button', class: 'botao botao--secundario', text: 'Voltar e ajustar critérios' });
    var imprimir = node('button', { type: 'button', class: 'botao botao--primario', text: 'Imprimir / Salvar como PDF' });
    pre.appendChild(node('h3', { text: 'Prévia do relatório' })); pre.appendChild(metadados); pre.appendChild(ajustar); pre.appendChild(imprimir);
    painel.appendChild(controles); painel.appendChild(aviso); painel.appendChild(preparar); painel.appendChild(pre);
    raiz.appendChild(abrir); raiz.appendChild(painel);

    function atualizarCampos() {
      faixaDia.hidden = periodo.value !== 'dia';
      faixaInicio.hidden = faixaFim.hidden = periodo.value !== 'intervalo';
      pre.hidden = true; aviso.hidden = true;
    }
    function abrirConfiguracao(opcao) {
      painel.hidden = false; abrir.hidden = true;
      if (opcao) {
        periodo.value = opcao.periodo || 'todo';
        tipo.value = opcao.tipo || 'resumido';
        inicio.value = opcao.inicio || '';
        inicioIntervalo.value = opcao.inicio || '';
        fim.value = opcao.fim || '';
      } else if (selecaoInicial) {
        var inicial = selecaoInicial();
        if (inicial) {
          periodo.value = inicial.periodo || 'todo'; tipo.value = inicial.tipo || 'resumido';
          inicio.value = inicial.inicio || ''; inicioIntervalo.value = inicial.inicio || ''; fim.value = inicial.fim || '';
        }
      }
      atualizarCampos();
      return { abrir: abrirConfiguracao };
    }
    abrir.addEventListener('click', function () { abrirConfiguracao(); });
    periodo.addEventListener('change', atualizarCampos);
    tipo.addEventListener('change', atualizarCampos);
    inicio.addEventListener('change', atualizarCampos); inicioIntervalo.addEventListener('change', atualizarCampos); fim.addEventListener('change', atualizarCampos);
    preparar.addEventListener('click', function () {
      aviso.hidden = true;
      var opcao = { periodo: periodo.value, inicio: periodo.value === 'intervalo' ? inicioIntervalo.value : inicio.value, fim: fim.value, tipo: tipo.value };
      var validacao = validarSelecao(opcao);
      if (!validacao.ok) { aviso.textContent = validacao.erro; aviso.hidden = false; return; }
      var fonte = obterRegistros() || [];
      if (filtrarExtras) fonte = filtrarExtras(fonte);
      var relatorio = modulo === 'NEX' ? construirNex(fonte, opcao) : construirIntervalos(fonte, opcao);
      if (!relatorio.ok) { aviso.textContent = relatorio.erro; aviso.hidden = false; return; }
      var adicionais = rotuloExtras ? rotuloExtras() : '';
      metadados.textContent = 'Módulo: ' + modulo + ' · Período: ' + relatorio.periodo + ' · Tipo: ' + (opcao.tipo === 'resumido' ? 'Resumo operacional' : 'Detalhado') + ' · Registros: ' + relatorio.quantidade + (adicionais ? ' · Filtros: ' + adicionais : '');
      pre.hidden = false;
      imprimir.onclick = function () {
        var nome = 'MeliNotepad_' + modulo + '_' + opcao.periodo + '_' + (opcao.inicio || 'historico');
        NS.Impressao.imprimir(nome, function (area) { renderizar(area, relatorio); });
      };
    });
    ajustar.addEventListener('click', function () { pre.hidden = true; periodo.focus(); });
    return { abrir: abrirConfiguracao };
  }

  NS.RelatoriosHistorico = { validarSelecao: validarSelecao, construirNex: construirNex, construirIntervalos: construirIntervalos, renderizar: renderizar, iniciarInterface: iniciarInterface };
})(window);
