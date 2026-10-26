/**
 * xpt.js
 * Tela do módulo XPT (expedição): operações, quantidades, gaiolas/auditoria,
 * ocorrências, veículos (com foto do HAND + lacre) e relatórios.
 * Regras em xpt-regras.js. Dados: LocalStorage (melinotepad_xpt_v1) e fotos em
 * IndexedDB — somente neste aparelho (sem sincronização).
 */
(function (global) {
  'use strict';
  var NS = global.MeliNotepad, X = NS.XptRegras, U = NS.Utils, UI = NS.UI, F = NS.Fotos, Scanner = NS.Scanner, SaveStatus = NS.SaveStatus, h = UI.h;
  var ABAS = [['gaiolas', 'Rotas e auditoria'], ['ocorrencias', 'Ocorrências'], ['veiculos', 'Veículos e carregamento'], ['quantidades', 'Quantidades'], ['relatorios', 'Relatórios']];
  var ABA_PRINCIPAL = [['operacoes', 'Operações'], ['historico', 'Histórico']];
  var store = NS.ModStore.criar({ chave: 'melinotepad_xpt_v1', rotulo: 'XPT', padrao: X.padrao, validar: X.validarDados });
  var estado = X.padrao(), avisoArm = null, el = {};
  var ui = { opId: null, tela: 'operacoes', histId: null, aba: 'gaiolas', filtroAud: '*', filtroTipo: '*', filtroAuditor: '', filtroVeiculo: '*', busca: '', filtroOc: '*' };

  function agora() { return U.agora().getTime(); }
  function hhmm(i) { return U.formatarHora(new Date(i)); }
  function dataHora(i) { return U.formatarDataHora(new Date(i)); }
  function recarregar() { var c = store.carregar(); estado = c.dados; avisoArm = c.aviso; }
  function mutar(fn) { if (SaveStatus) { SaveStatus.modulo('XPT'); SaveStatus.salvando(); } var r = store.mutar(fn); if (!r.sucesso) { if (SaveStatus) SaveStatus.erro(r.erro); UI.avisar(r.erro, 'erro'); return null; } estado = r.dados; if (SaveStatus) SaveStatus.salvo(); return r; }
  function op() { return estado.operacoes.filter(function (o) { return o.id === ui.opId; })[0] || null; }
  function mutarOp(fn) {
    return mutar(function (d) {
      var o = d.operacoes.filter(function (x) { return x.id === ui.opId; })[0];
      if (!o) throw new Error('Operação não encontrada.');
      if (o.encerradaAt) throw new Error('Operação encerrada; os dados estão disponíveis somente para consulta.');
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
    UI.limpar(el.listaOpsMobile);
    ops.forEach(function (o) {
      var sit = X.situacaoOperacao(o), dias = X.diasAberta(o, agora()), pendencias = X.pendentesAbertas(o).length;
      el.corpoOps.appendChild(h('tr', { dataset: { id: o.id } }, [
        h('td', { text: U.formatarData(new Date(o.inicioAt)) }), h('td', { text: hhmm(o.inicioAt) }),
        h('td', { text: o.fimCarregamentoAt ? hhmm(o.fimCarregamentoAt) : '—' }),
        h('td', { text: X.ROTULO_SITUACAO[sit] + (dias >= 1 ? ' · aberta há ' + dias + ' dia(s)' : '') }),
        h('td', { text: o.gaiolas.length }), h('td', { text: pendencias }),
        h('td', {}, [h('button', { type: 'button', class: 'botao botao--secundario', dataset: { acao: 'abrir', id: o.id }, text: 'Abrir' })])]));
      el.listaOpsMobile.appendChild(h('li', { class: 'cartao xpt-card-operacao' }, [
        h('div', { class: 'cartao__cabecalho' }, [
          h('h3', { text: 'Operação de ' + U.formatarData(new Date(o.inicioAt)) }),
          h('span', { class: 'chip chip--neutro', text: X.ROTULO_SITUACAO[sit] })
        ]),
        h('dl', { class: 'lista-definicao' }, [
          h('div', {}, [h('dt', { text: 'Início' }), h('dd', { text: hhmm(o.inicioAt) })]),
          h('div', {}, [h('dt', { text: 'Fim do carregamento' }), h('dd', { text: o.fimCarregamentoAt ? hhmm(o.fimCarregamentoAt) : 'Não registrado' })]),
          h('div', {}, [h('dt', { text: 'Rotas' }), h('dd', { text: String(o.gaiolas.length) })]),
          h('div', {}, [h('dt', { text: 'Pendências' }), h('dd', { text: String(pendencias) })])
        ]),
        dias >= 1 ? h('p', { class: 'texto-apoio', text: 'Aberta há ' + dias + ' dia(s).' }) : null,
        h('button', { type: 'button', class: 'botao botao--secundario', dataset: { acao: 'abrir', id: o.id }, text: 'Abrir operação' })
      ]));
    });
    el.vazioOps.hidden = ops.length > 0;
    el.tabelaOps.hidden = ops.length === 0;
    el.listaOpsMobile.hidden = ops.length === 0;
  }
  var criacaoPendente = null;
  function novaOperacao() {
    dialogoHorario({ titulo: 'Nova operação XPT', texto: 'A data da operação é a data do início.', rotuloCampo: 'Início da operação', confirmar: 'Iniciar operação',
      aoConfirmar: function (ms) {
        if (!criacaoPendente) criacaoPendente = X.novaOperacao(agora(), ms);
        var o = criacaoPendente;
        if (!mutar(function (d) { if (!d.operacoes.some(function (existente) { return existente.id === o.id; })) d.operacoes.push(o); })) return false;
        criacaoPendente = null;
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
      h('p', { class: 'texto-apoio', text: 'Finalize cada veículo individualmente na seção Veículos. O encerramento da operação continua sendo uma etapa separada.' }),
      h('button', { type: 'button', class: 'botao botao--primario', id: 'xo-encerrar', disabled: !!o.encerradaAt, text: o.encerradaAt ? 'Operação encerrada' : 'Encerrar operação', onclick: function () {
        var pend = X.pendentesAbertas(o).length, av = [];
        if (!o.fimCarregamentoAt) av.push('O fim do carregamento ainda não foi registrado.');
        if (pend) av.push(pend + ' ocorrência(s) ainda pendente(s): elas continuarão registradas como pendentes.');
        var confirmarPre = global.confirm('Abrir o pré-encerramento desta operação? O relatório será somente para leitura.');
        if (!confirmarPre) return;
        var textoPre = X.relatorioBasico(o);
        var dlgPre = UI.dialogo('dlg-xpt-pre-encerramento');
        dlgPre.appendChild(h('h2', { text: 'Pré-encerramento — operação de ' + U.formatarData(new Date(o.inicioAt)) }));
        dlgPre.appendChild(h('p', { class: 'texto-apoio', text: 'Confira o relatório antes de confirmar. Os dados não podem ser editados nesta etapa. ' + av.join(' ') }));
        dlgPre.appendChild(h('pre', { class: 'texto-relatorio', text: textoPre, tabindex: '0' }));
        dlgPre.appendChild(h('div', { class: 'acoes-form acoes-form--modal' }, [
          h('button', { type: 'button', class: 'botao botao--secundario', text: 'Voltar', onclick: function () { dlgPre.close(); } }),
          h('button', { type: 'button', class: 'botao botao--secundario', text: 'Copiar relatório', onclick: function () { if (global.navigator.clipboard && global.navigator.clipboard.writeText) global.navigator.clipboard.writeText(textoPre).then(function(){UI.avisar('Relatório copiado.','sucesso');}).catch(function(){UI.avisar('Não foi possível copiar automaticamente.','erro');}); else UI.avisar('Copie o texto do relatório manualmente.','info'); } }),
          h('button', { type: 'button', class: 'botao botao--primario', text: 'Confirmar encerramento', onclick: function () {
            if (!global.confirm('Deseja finalizar esta operação? Após a finalização, os dados ficarão somente para consulta.')) return;
            var ms = agora();
            if (!mutarOp(function (x) { if (x.encerradaAt) throw new Error('A operação já foi encerrada.'); x.encerradaAt = new Date(ms).toISOString(); })) return;
            dlgPre.close(); ui.opId = null; ui.tela = 'historico'; renderTudo(); UI.avisar('Operação encerrada e enviada ao histórico.','sucesso');
          } })]));
        dlgPre.showModal();
      } })]));
  }

  // ================================================================ histórico de operações encerradas
  function operacoesHistorico() {
    return estado.operacoes.filter(function (o) { return !!o.encerradaAt; }).sort(function (a, b) {
      return Date.parse(b.encerradaAt) - Date.parse(a.encerradaAt);
    });
  }
  function renderHistorico() {
    if (!el.corpoHistorico) return;
    var todos = operacoesHistorico(), termo = (el.histBusca.value || '').trim().toLocaleLowerCase();
    var inicio = el.histInicio.value, fim = el.histFim.value;
    var itens = todos.filter(function (o) {
      var data = U.dataOperacional(o.encerradaAt || o.inicioAt || '');
      var texto = [o.inicioAt, o.encerradaAt, o.fimCarregamentoAt, o.veiculos.map(function (v) { return [v.placa, v.motorista, (v.rotas || []).join(' ')].join(' '); }).join(' '), X.relatorioBasico(o)].join(' ').toLocaleLowerCase();
      return (!inicio || data >= inicio) && (!fim || data <= fim) && (!termo || texto.indexOf(termo) >= 0);
    });
    UI.limpar(el.corpoHistorico);
    UI.limpar(el.histListaMobile);
    el.histVazio.hidden = todos.length > 0;
    el.histSemResultados.hidden = todos.length === 0 || itens.length > 0;
    el.histContagem.textContent = itens.length + ' operação(ões) encerrada(s)';
    itens.forEach(function (o) {
      var dataOperacao = U.formatarData(new Date(o.inicioAt));
      var dataEncerramento = o.encerradaAt ? dataHora(o.encerradaAt) : '—';
      var botaoDetalhe = function () { return h('button', { type: 'button', class: 'botao botao--secundario', dataset: { acao: 'detalhe-historico', id: o.id }, text: 'Ver detalhes' }); };
      var tr = h('tr', {}, [
        h('td', { text: dataOperacao }),
        h('td', { text: hhmm(o.inicioAt) }),
        h('td', { text: dataEncerramento }),
        h('td', { text: o.gaiolas.length }),
        h('td', { text: o.veiculos.length }),
        h('td', {}, [botaoDetalhe()])
      ]);
      el.corpoHistorico.appendChild(tr);
      el.histListaMobile.appendChild(h('li', { class: 'cartao xpt-card-operacao' }, [
        h('h3', { text: 'Operação de ' + dataOperacao }),
        h('dl', { class: 'lista-definicao' }, [
          h('div', {}, [h('dt', { text: 'Início' }), h('dd', { text: hhmm(o.inicioAt) })]),
          h('div', {}, [h('dt', { text: 'Encerrada em' }), h('dd', { text: dataEncerramento })]),
          h('div', {}, [h('dt', { text: 'Rotas' }), h('dd', { text: String(o.gaiolas.length) })]),
          h('div', {}, [h('dt', { text: 'Veículos' }), h('dd', { text: String(o.veiculos.length) })])
        ]),
        botaoDetalhe()
      ]));
    });
    el.histListaMobile.hidden = itens.length === 0;
  }
  function abrirHistorico(id) {
    var o = estado.operacoes.filter(function (x) { return x.id === id && !!x.encerradaAt; })[0];
    if (!o) return;
    ui.histId = id;
    el.histDetalheTitulo.textContent = 'Operação de ' + U.formatarData(new Date(o.inicioAt));
    el.histDetalheInfo.textContent = 'Início: ' + dataHora(o.inicioAt) + ' | Fim do carregamento: ' + (o.fimCarregamentoAt ? dataHora(o.fimCarregamentoAt) : 'não registrado') + ' | Encerrada: ' + dataHora(o.encerradaAt) + ' | Gaiolas: ' + o.gaiolas.length + ' | Veículos: ' + o.veiculos.length + ' | Ocorrências: ' + o.ocorrencias.length;
    el.histRelatorio.value = X.relatorioBasico(o);
    el.histDetalhe.hidden = false;
    el.histRelatorio.focus();
  }
  function fecharHistoricoDetalhe() { ui.histId = null; el.histDetalhe.hidden = true; }
  function operacaoHistoricoAberta() { return estado.operacoes.filter(function (o) { return o.id === ui.histId && !!o.encerradaAt; })[0] || null; }
  function copiarRelatorioHistorico() {
    var o = operacaoHistoricoAberta(); if (!o) return;
    var texto = X.relatorioBasico(o);
    if (global.navigator.clipboard && global.navigator.clipboard.writeText && global.isSecureContext) {
      global.navigator.clipboard.writeText(texto).then(function () { UI.avisar('Relatório copiado.', 'sucesso'); }).catch(function () { el.histRelatorio.hidden = false; el.histRelatorio.focus(); el.histRelatorio.select(); UI.avisar('Selecione e copie o texto do relatório manualmente.', 'info'); });
    } else { el.histRelatorio.hidden = false; el.histRelatorio.focus(); el.histRelatorio.select(); UI.avisar('Selecione e copie o texto do relatório manualmente.', 'info'); }
  }
  function imprimirRelatorioHistorico() {
    var o = operacaoHistoricoAberta(); if (!o) return;
    var texto = X.relatorioBasico(o);
    NS.Impressao.imprimir('MeliNotepad_XPT_' + (o.inicioAt || '').slice(0, 10), function (area) {
      area.appendChild(h('h1', { text: 'MeliNotepad — XPT: histórico da operação' }));
      area.appendChild(h('pre', { class: 'relatorio-texto-impressao', text: texto }));
    }).catch(function (e) { UI.avisar('Não foi possível preparar o PDF: ' + (e.message || e), 'erro'); });
  }
  function excluirOperacaoHistorico() {
    var o = operacaoHistoricoAberta(); if (!o) return;
    if (!global.confirm('Excluir definitivamente a operação XPT de ' + U.formatarData(new Date(o.inicioAt)) + '? Gaiolas, auditorias, ocorrências, veículos e os dados associados desta operação também serão removidos. Esta ação não pode ser desfeita.')) return;
    var r = mutar(function (d) {
      var alvo = d.operacoes.filter(function (x) { return x.id === o.id; })[0];
      if (!alvo || !alvo.encerradaAt) throw new Error('Apenas operações encerradas podem ser excluídas do histórico.');
      d.operacoes = d.operacoes.filter(function (x) { return x.id !== o.id; });
    });
    if (!r) return;
    fecharHistoricoDetalhe(); renderHistorico(); renderLista();
    UI.avisar('Operação excluída do histórico deste navegador.', 'sucesso');
  }

  // ================================================================ quantidades
  function renderQuantidades() {
    var o = op(); UI.limpar(el.pQuant); if (!o) return;
    var q = o.quantidades, campos = [['pacotes', 'Pacotes'], ['volumosos', 'Volumosos'], ['extraVolumosos', 'Extra volumosos'], ['totalBK', 'Total BK (informado)']];
    var inputs = {}, erro = aviso();
    campos.forEach(function (c) { inputs[c[0]] = h('input', { type: 'number', inputmode: 'numeric', min: '0', step: '1', id: 'xq-' + c[0], value: q[c[0]] == null ? '' : q[c[0]] }); });
    var t = X.totais(o), a = X.resumoAuditoria(o.gaiolas);
    var arquivoImportacao = null, areaImportacao, estadoArquivo, inputArquivo;
    function tamanhoArquivo(bytes) {
      if (bytes < 1024) return bytes + ' bytes';
      if (bytes < 1024 * 1024) return (bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' KB';
      return (bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' MB';
    }
    function mostrarArquivo(arquivo, erroTexto) {
      arquivoImportacao = null;
      UI.limpar(estadoArquivo);
      if (erroTexto) {
        estadoArquivo.appendChild(h('p', { class: 'xpt-importacao__mensagem xpt-importacao__mensagem--erro', role: 'alert', text: erroTexto }));
        return;
      }
      if (!arquivo) {
        estadoArquivo.appendChild(h('p', { class: 'texto-apoio', text: 'Nenhum arquivo selecionado. A planilha não será importada nem alterará os dados atuais.' }));
        return;
      }
      var nome = arquivo.name || '';
      var ext = nome.indexOf('.') >= 0 ? nome.split('.').pop().toLowerCase() : '';
      if (ext !== 'xlsx' && ext !== 'csv') {
        inputArquivo.value = '';
        estadoArquivo.appendChild(h('p', { class: 'xpt-importacao__mensagem xpt-importacao__mensagem--erro', role: 'alert', text: 'Formato não suportado. Selecione um arquivo .xlsx ou .csv.' }));
        return;
      }
      if (!arquivo || typeof arquivo.size !== 'number' || arquivo.size <= 0) {
        inputArquivo.value = '';
        estadoArquivo.appendChild(h('p', { class: 'xpt-importacao__mensagem xpt-importacao__mensagem--erro', role: 'alert', text: 'O arquivo está vazio ou não pôde ser recebido. Selecione outro arquivo.' }));
        return;
      }
      arquivoImportacao = arquivo;
      estadoArquivo.appendChild(h('div', { class: 'xpt-importacao__arquivo', role: 'status' }, [
        h('div', { class: 'xpt-importacao__arquivo-detalhes' }, [h('strong', { text: nome }), h('span', { text: tamanhoArquivo(arquivo.size) })]),
        h('div', { class: 'xpt-importacao__acoes' }, [
          h('button', { type: 'button', class: 'botao botao--secundario', id: 'xq-arquivo-outro', text: 'Selecionar outro', onclick: function () { inputArquivo.click(); } }),
          h('button', { type: 'button', class: 'botao botao--secundario', id: 'xq-arquivo-remover', text: 'Remover arquivo', onclick: function () { arquivoImportacao = null; inputArquivo.value = ''; mostrarArquivo(null); } })
        ])
      ]));
      estadoArquivo.appendChild(h('p', { class: 'texto-apoio', text: 'Arquivo recebido nesta tela. O conteúdo ainda não foi lido nem importado.' }));
    }
    inputArquivo = h('input', { type: 'file', id: 'xq-arquivo-input', accept: '.xlsx,.csv', 'aria-label': 'Selecionar planilha Excel ou CSV' });
    inputArquivo.hidden = true;
    inputArquivo.addEventListener('change', function () {
      var arquivo = inputArquivo.files && inputArquivo.files[0];
      mostrarArquivo(arquivo || null, arquivo ? '' : 'Nenhum arquivo foi selecionado.');
    });
    areaImportacao = h('div', { class: 'xpt-importacao__area', id: 'xq-area-importacao', tabindex: '0', role: 'region', 'aria-label': 'Área para arrastar e soltar planilha' }, [
      h('p', { class: 'xpt-importacao__titulo', text: 'Selecione uma planilha para preparar a importação' }),
      h('p', { class: 'texto-apoio', text: 'Formatos aceitos: Excel (.xlsx) e CSV (.csv), incluindo arquivos baixados do Google Planilhas.' }),
      h('button', { type: 'button', class: 'botao botao--primario', id: 'xq-selecionar-planilha', text: 'Selecionar planilha', onclick: function () { inputArquivo.click(); } }),
      h('p', { class: 'texto-apoio', text: 'Ou arraste o arquivo do computador e solte nesta área.' })
    ]);
    estadoArquivo = h('div', { class: 'xpt-importacao__estado', id: 'xq-arquivo-estado', 'aria-live': 'polite' });
    mostrarArquivo(null);
    areaImportacao.addEventListener('dragenter', function (e) { e.preventDefault(); areaImportacao.classList.add('is-arrastando'); });
    areaImportacao.addEventListener('dragover', function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; areaImportacao.classList.add('is-arrastando'); });
    areaImportacao.addEventListener('dragleave', function (e) { if (!areaImportacao.contains(e.relatedTarget)) areaImportacao.classList.remove('is-arrastando'); });
    areaImportacao.addEventListener('drop', function (e) {
      e.preventDefault(); areaImportacao.classList.remove('is-arrastando');
      var arquivos = e.dataTransfer && e.dataTransfer.files;
      if (!arquivos || !arquivos.length) { mostrarArquivo(null, 'Não foi possível receber o arquivo arrastado. Tente selecioná-lo pelo botão.'); return; }
      try { inputArquivo.files = arquivos; } catch (_) { /* A validação usa o mesmo fluxo mesmo quando o navegador não permite atribuir FileList. */ }
      mostrarArquivo(arquivos[0]);
    });
    areaImportacao.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputArquivo.click(); } });
    el.pQuant.appendChild(h('div', { class: 'cartao xpt-importacao' }, [h('h3', { text: 'Importar planilha' }), areaImportacao, inputArquivo, estadoArquivo]));
    el.pQuant.appendChild(h('div', { class: 'cartao' }, [h('h3', { text: 'Quantidades' }),
      h('p', { class: 'texto-apoio', text: 'Informe só o que foi realmente contado. Campos em branco ficam como “não informado”. O total de produtos soma pacotes, volumosos e extra volumosos; o Total BK é informado à parte e não entra nessa soma. Paletes e redes são consolidados a partir das rotas e não são digitados nesta aba.' }),
      h('form', { novalidate: true, id: 'xq-form', onsubmit: function (e) {
        e.preventDefault(); var novos = {};
        for (var i = 0; i < campos.length; i++) { var r = X.inteiroOuNulo(inputs[campos[i][0]].value); if (!r.ok) { erro.textContent = campos[i][1] + ': informe um número inteiro não negativo.'; return; } novos[campos[i][0]] = r.valor; }
        if (mutarOp(function (x) { x.quantidades = Object.assign({}, x.quantidades, novos); })) { renderQuantidades(); renderLista(); UI.avisar('Quantidades salvas.', 'sucesso'); }
      } }, [h('div', { class: 'xpt-grid' }, campos.map(function (c) { return UI.campo(c[1], inputs[c[0]]); })), erro,
        h('button', { type: 'submit', class: 'botao botao--primario', id: 'xq-salvar', text: 'Salvar quantidades' })])]));
    el.pQuant.appendChild(h('div', { class: 'cartao' }, [h('h3', { text: 'Calculado automaticamente' }),
      h('dl', { class: 'lista-definicao' }, [
        h('div', {}, [h('dt', { text: 'Total de produtos' }), h('dd', { id: 'xq-total', text: String(t.totalProdutos) })]),
        h('div', {}, [h('dt', { text: 'Rotas cadastradas' }), h('dd', { id: 'xq-gaiolas', text: t.rotas })]),
        h('div', {}, [h('dt', { text: 'Gaiolas f\u00edsicas transportadas' }), h('dd', { id: 'xq-gaiolas-fisicas', text: t.gaiolasFisicas })]),
        h('div', {}, [h('dt', { text: 'Auditoria de rotas' }), h('dd', { text: a.percentual == null ? '—' : String(a.percentual).replace('.', ',') + '%' })])])]));
  }

  // ================================================================ gaiolas e auditoria
  function renderGaiolas() {
    var o = op(); UI.limpar(el.pGaiolas); if (!o) return;
    var a = X.resumoAuditoria(o.gaiolas);
    var cont = function (v, r, id) { return h('div', { class: 'contador' }, [h('span', { class: 'contador__valor', id: id, text: v }), h('span', { class: 'contador__rotulo', text: r })]); };
    function criarSelectVeiculo(g, prefixo) {
      var v = X.veiculoDaGaiola(o, g.id);
      var veiculoSelect = select(prefixo + g.id, [['', o.veiculos.length ? 'Selecionar veículo' : 'Cadastre um veículo primeiro']].concat(o.veiculos.map(function (x) { return [x.id, x.placa]; })), v ? v.id : '');
      veiculoSelect.setAttribute('aria-label', 'Veículo da gaiola ' + g.codigo);
      var veiculoAtualInicial = X.veiculoDaGaiola(o, g.id);
      veiculoSelect.disabled = !!o.fimCarregamentoAt || !!o.encerradaAt || !o.veiculos.length || !!(veiculoAtualInicial && veiculoAtualInicial.finalizadoAt);
      veiculoSelect.addEventListener('change', function () {
        var destino = veiculoSelect.value, atual = X.veiculoDaGaiola(op(), g.id);
        if ((atual ? atual.id : '') === destino) return;
        var estadoOp = op();
        var origem = atual && estadoOp.veiculos.filter(function (v) { return v.id === atual.id; })[0];
        var destinoVeiculo = estadoOp.veiculos.filter(function (v) { return v.id === destino; })[0];
        if (estadoOp.encerradaAt || (origem && origem.finalizadoAt) || (destinoVeiculo && destinoVeiculo.finalizadoAt)) { UI.avisar('Reabra o veículo finalizado antes de alterar a associação da gaiola.', 'erro'); renderGaiolas(); return; }
        var posicao = window.scrollY;
        var salvo = mutarOp(function (x) {
          var veiculoAtual = X.veiculoDaGaiola(x, g.id);
          if (veiculoAtual) { var rem = X.descarregarGaiola(x, veiculoAtual.id, g.id, agora()); if (!rem.ok) throw new Error(rem.erro); }
          if (destino) { var add = X.carregarGaiola(x, destino, g.id, agora()); if (!add.ok) throw new Error(add.erro); }
        });
        if (salvo) { renderTudo(); window.scrollTo(window.scrollX, posicao); requestAnimationFrame(function () { window.scrollTo(window.scrollX, posicao); }); UI.avisar(destino ? 'Veiculo associado a rota ' + g.codigo + '.' : 'Veículo removido da rota ' + g.codigo + '.', 'sucesso'); }
        else renderGaiolas();
      });
      return veiculoSelect;
    }
    var estadosFiltro = [['nao_iniciada', 'Não auditado'], ['auditando', 'Auditando'], ['concluida_sem_divergencia', 'Concluído'], ['concluida_com_divergencia', 'Concluído com divergência']];
    var filtro = select('xg-filtro', [['*', 'Todos os status']].concat(estadosFiltro), ui.filtroAud);
    
    var veiculoFiltro = select('xg-filtro-veiculo', [['*', 'Todos os veículos'], ['sem_veiculo', 'Sem veículo']].concat(o.veiculos.map(function (v) { return [v.id, v.placa]; })), ui.filtroVeiculo);
    var busca = h('input', { type: 'search', id: 'xg-busca', placeholder: 'Buscar rota, status, auditor ou veículo', value: ui.busca, 'aria-label': 'Buscar rota, status, auditor ou veículo' });
    function rerenderBusca() { ui.busca = busca.value; var pos = busca.value.length; renderGaiolas(); var n = document.getElementById('xg-busca'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
    filtro.addEventListener('change', function () { ui.filtroAud = filtro.value; renderGaiolas(); });
    veiculoFiltro.addEventListener('change', function () { ui.filtroVeiculo = veiculoFiltro.value; renderGaiolas(); });
    busca.addEventListener('input', rerenderBusca);
    var itens = o.gaiolas.filter(function (g) {
      var rotulo = X.rotuloAuditoria(o, g);
      var rotuloFiltro = ui.filtroAud === 'auditando' ? 'Auditando' : ui.filtroAud === 'concluida_sem_divergencia' ? 'Concluído' : ui.filtroAud === 'concluida_com_divergencia' ? 'Concluído com divergência' : 'Não auditado';
      var veiculo = X.veiculoDaGaiola(o, g.id);
      var nomeVeiculo = veiculo ? veiculo.placa : 'sem veículo';
      
      var textoBusca = [g.codigo, rotulo, g.auditoria.auditor || '', nomeVeiculo].join(' ');
      return (ui.filtroAud === '*' || rotulo === rotuloFiltro) &&
        (ui.filtroVeiculo === '*' || (ui.filtroVeiculo === 'sem_veiculo' ? !veiculo : !!veiculo && veiculo.id === ui.filtroVeiculo)) &&
        (!ui.busca || X.chave(textoBusca).indexOf(X.chave(ui.busca)) >= 0);
    });
    var corpo = h('tbody', { id: 'xg-corpo' }, itens.map(function (g) {
      var veiculoSelect = criarSelectVeiculo(g, 'xg-veiculo-');
      var q = g.auditoria && g.auditoria.quantidades || {};
      var qTexto = q.g != null && q.p != null ? 'Gaiolas f\u00edsicas: ' + q.g + ' | Paletes: ' + q.p : '—';
      return h('tr', { dataset: { id: g.id } }, [
        h('td', { text: g.codigo }),
        h('td', { text: qTexto }),
        h('td', { text: X.rotuloAuditoria(o, g) }), h('td', { text: g.auditoria.auditor || '-' }),
        h('td', {}, [veiculoSelect]),
        h('td', {}, [h('div', { class: 'acoes-form' }, [
          h('button', { type: 'button', class: 'botao botao--texto', dataset: { acao: 'auditar', id: g.id }, text: g.auditoria.estado === 'auditando' ? 'Terminar auditoria' : g.auditoria.estado === 'nao_iniciada' || g.auditoria.estado === 'pendente' ? 'Iniciar auditoria' : 'Editar auditoria' }),
          h('button', { type: 'button', class: 'botao botao--texto', dataset: { acao: 'excluir', id: g.id }, text: 'Excluir rota' })
        ])])
      ]);
    }));
    var listaMobile = h('ul', { class: 'xpt-lista-mobile xpt-lista-gaiolas', 'aria-label': 'Rotas e auditoria' });
    itens.forEach(function (g) {
      var veiculoSelectMobile = criarSelectVeiculo(g, 'xg-veiculo-mobile-');
      listaMobile.appendChild(h('li', { class: 'cartao xpt-card-gaiola' }, [
        h('div', { class: 'cartao__cabecalho' }, [
          h('h3', { text: 'Rota ' + g.codigo }),
        ]),
        h('p', { class: 'texto-apoio', text: 'Quantidades transportadas: ' + (g.auditoria.quantidades && g.auditoria.quantidades.g != null && g.auditoria.quantidades.p != null ? 'Gaiolas fisicas: ' + g.auditoria.quantidades.g + ' | Paletes: ' + g.auditoria.quantidades.p : 'nao informado') }),
        h('p', { class: 'texto-apoio', text: 'Auditoria: ' + X.rotuloAuditoria(o, g) }),
        h('p', { class: 'texto-apoio', text: 'Auditor: ' + (g.auditoria.auditor || 'Não informado') }),
        UI.campo('Veículo associado', veiculoSelectMobile),
        h('div', { class: 'acoes-form' }, [
          h('button', { type: 'button', class: 'botao botao--secundario', dataset: { acao: 'auditar', id: g.id }, text: g.auditoria.estado === 'auditando' ? 'Terminar auditoria' : g.auditoria.estado === 'nao_iniciada' || g.auditoria.estado === 'pendente' ? 'Iniciar auditoria' : 'Editar auditoria' }),
          h('button', { type: 'button', class: 'botao botao--texto', dataset: { acao: 'excluir', id: g.id }, text: 'Excluir rota' })
        ])
      ]));
    });
    listaMobile.hidden = itens.length === 0;
    function tratarAcaoGaiola(e) {
      var b = e.target.closest('button[data-acao]'); if (!b) return;
      if (b.dataset.acao === 'auditar') dialogoAuditoria([b.dataset.id]);
      else if (b.dataset.acao === 'excluir') dialogoExcluirGaiola(b.dataset.id);
    }
    corpo.addEventListener('click', tratarAcaoGaiola);
    listaMobile.addEventListener('click', tratarAcaoGaiola);
    el.pGaiolas.appendChild(h('div', { class: 'cartao' }, [
      h('h3', { text: 'Etapas 1 e 2 - cadastro e auditoria de rotas' }),
      h('p', { class: 'texto-apoio', text: 'Cadastre os codigos das rotas (ex.: A1, B7). Em cada rota, informe a quantidade de gaiolas fisicas e paletes transportados.' }),
      h('div', { class: 'contadores contadores--xpt', role: 'group', 'aria-label': 'Resumo de gaiolas e auditoria' }, [cont(String(a.total), 'Rotas', 'xg-total'),
        cont(String(a.concluidas), 'Concluídas', 'xg-conc'), cont(String(a.pendentes + a.naoIniciadas), 'Não realizadas', 'xg-pend'), cont(a.percentual == null ? '—' : String(a.percentual).replace('.', ',') + '%', 'Auditado', 'xg-pct')]),
      h('p', { class: 'texto-apoio', text: 'Status da auditoria da rota. Ocorrencias ativas vinculadas a uma rota indicam divergencia.' }),
      h('div', { class: 'acoes-form' }, [
        h('button', { type: 'button', class: 'botao botao--primario', id: 'xg-adicionar', text: '+ Adicionar rotas', onclick: dialogoAdicionarGaiolas }),
        h('button', { type: 'button', class: 'botao botao--secundario', id: 'xg-lote', text: 'Auditar em lote', onclick: dialogoAuditoriaLote })])]));
    el.pGaiolas.appendChild(h('div', { class: 'cartao' }, [h('div', { class: 'interv-filtros' }, [UI.campo('Status da auditoria', filtro), UI.campo('Veículo', veiculoFiltro), UI.campo('Buscador', busca)]),
      h('p', { class: 'texto-apoio', id: 'xg-contagem', text: itens.length + ' de ' + o.gaiolas.length + ' rota(s)' }),
      h('div', { class: 'tabela-rolavel xpt-tabela-desktop' }, [h('table', { class: 'tabela-modulo' }, [thead(['Rota', 'Quantidades transportadas', 'Auditoria da rota', 'Auditor', 'Veiculo', '']), corpo])]),
      listaMobile]));
  }
  function dialogoExcluirGaiola(gaiolaId) {
    var o = op(), gaiola = o && o.gaiolas.filter(function (g) { return g.id === gaiolaId; })[0];
    if (!gaiola) return;
    var veiculoAssociado = X.veiculoDaGaiola(o, gaiolaId);
    if (o.fimCarregamentoAt || o.encerradaAt || (veiculoAssociado && veiculoAssociado.finalizadoAt)) {
      UI.avisar(veiculoAssociado && veiculoAssociado.finalizadoAt
        ? 'Reabra o veículo associado antes de excluir esta gaiola.'
        : 'O carregamento está encerrado; não é possível excluir gaiolas.', 'erro');
      return;
    }
    var dlg = UI.dialogo('dlg-xpt-excluir-gaiola');
    dlg.appendChild(h('h2', { text: 'Excluir rota ' + gaiola.codigo + '?' }));
    dlg.appendChild(h('p', { class: 'texto-apoio', text: 'Esta ação remove a gaiola cadastrada e sua associação com veículo. O histórico de ocorrências já registrado será preservado.' }));
    dlg.appendChild(h('div', { class: 'acoes-form acoes-form--modal' }, [
      h('button', { type: 'button', class: 'botao botao--secundario', text: 'Cancelar', onclick: function () { dlg.close(); } }),
      h('button', { type: 'button', class: 'botao botao--primario', text: 'Confirmar exclusão', onclick: function () {
        var salvo = mutarOp(function (x) {
          var alvo = x.gaiolas.filter(function (g) { return g.id === gaiolaId; })[0];
          if (!alvo) throw new Error('A gaiola não foi encontrada.');
          var veiculo = X.veiculoDaGaiola(x, gaiolaId);
          if (veiculo) { var removida = X.descarregarGaiola(x, veiculo.id, gaiolaId, agora()); if (!removida.ok) throw new Error(removida.erro); }
          x.gaiolas = x.gaiolas.filter(function (g) { return g.id !== gaiolaId; });
        });
        if (salvo) { dlg.close(); renderTudo(); UI.avisar('Rota ' + gaiola.codigo + ' excluída.', 'sucesso'); }
      } })
    ]));
    dlg.showModal();
  }

  function estadoAuditorCampos(ocultarQuantidades) {
    var est = select('xa-estado', [['nao_iniciada', 'Não auditado'], ['concluida', 'Concluído']], 'concluida');
    var auditor = h('input', { type: 'text', id: 'xa-auditor', autocomplete: 'name', maxlength: '100', placeholder: 'Nome de quem realizou a auditoria' });
    var quantidades = {};
    [['g','Quantidade de gaiolas f\u00edsicas'],['v','Gaiolas de Volumoso (V)'],['p','Paletes (P)']].forEach(function (item) { quantidades[item[0]] = h('input', { type:'number', min:'0', step:'1', inputmode:'numeric', id:'xa-lote-'+item[0], value:'', required:true }); });
    var campos = [h('div', { class:'interv-duas' }, [UI.campo('Resultado da auditoria', est), UI.campo('Auditor', auditor, 'Obrigatório para concluir.')])];
    if (!ocultarQuantidades) campos.push(h('div', { class:'interv-duas' }, [['g','Quantidade de gaiolas f\u00edsicas'],['v','Gaiolas de Volumoso (V)'],['p','Paletes (P)']].map(function (item) { return UI.campo(item[1], quantidades[item[0]], 'Inteiro não negativo.'); })));
    var bloco = h('div', {}, campos);
    return { est: est, auditor: auditor, quantidades: quantidades, bloco: bloco };
  }
  function aplicarAuditoria(ids, estado, auditor, quantidades) {
    var r = mutarOp(function (o) {
      ids.forEach(function (id) {
        var g = o.gaiolas.filter(function (x) { return x.id === id; })[0]; if (!g) return;
        var x = X.definirAuditoria(g, estado, estado === 'concluida' ? auditor : null, agora(), estado === 'concluida' ? quantidades : undefined);
        if (!x.ok) throw new Error(x.erro);
      });
    });
    if (r) { renderTudo(); UI.avisar('Auditoria registrada em ' + ids.length + ' rota(s).', 'sucesso'); return true; }
    return false;
  }
  function dialogoAuditoria(ids) {
    var o = op(), g = o.gaiolas.filter(function (x) { return x.id === ids[0]; })[0]; if (!g) return;
    var dlg = UI.dialogo('dlg-xpt-aud'), erro = aviso(), q = g.auditoria.quantidades || {};
    var auditor = h('input', { type: 'text', id: 'xa-auditor', autocomplete: 'name', maxlength: '100', placeholder: 'Nome do auditor', value: g.auditoria.auditor || '', required: true });
    var campos = {}; [['g','Quantidade de gaiolas f\u00edsicas'],['p','Quantidade de paletes']].forEach(function (x) { campos[x[0]] = h('input', { type:'number', min:'0', step:'1', inputmode:'numeric', id:'xa-q-'+x[0], value:q[x[0]] == null ? '' : String(q[x[0]]), required:true }); });
    var emAndamento = g.auditoria.estado === 'auditando';
    var concluida = g.auditoria.estado === 'concluida' || g.auditoria.estado.indexOf('concluida_') === 0;
    dlg.appendChild(h('h2', { text: (emAndamento ? 'Terminar auditoria — gaiola ' : concluida ? 'Editar auditoria — gaiola ' : 'Iniciar auditoria — gaiola ') + g.codigo }));
    var camposQtd = h('div', { class:'interv-duas' }, [['g','Quantidade de gaiolas f\u00edsicas'],['p','Quantidade de paletes']].map(function (x) { return UI.campo(x[1], campos[x[0]], ''); }));
    dlg.appendChild(h('form', { novalidate:true, onsubmit:function(e) {
      e.preventDefault();
      var nome = auditor.value.trim();
      if (!nome) { erro.textContent = 'Informe o nome do auditor.'; return; }
      var quantidades = {};
      ['g','p'].forEach(function(k){ var bruto=campos[k].value.trim(); var n=bruto === '' ? {ok:true,valor:0} : X.inteiroOuNulo(bruto); quantidades[k]=n.ok?n.valor:null; }); quantidades.v = q.v == null ? 0 : q.v;
      if (!X.validarQuantidadesAuditoria(quantidades)) { erro.textContent='Informe quantidades de gaiolas fisicas e paletes como inteiros não negativos.'; return; }
      if (!emAndamento && !concluida) {
        var inicio = mutarOp(function(x) {
          var alvo=x.gaiolas.filter(function(y){return y.id===g.id;})[0];
          var z=X.iniciarAuditoria(alvo,nome,agora());
          if(!z.ok) throw new Error(z.erro);
          alvo.auditoria.quantidades = alvo.auditoria.quantidades || { g:null, v:null, p:null };
          alvo.auditoria.quantidades.g = quantidades.g;
          alvo.auditoria.quantidades.p = quantidades.p;
        });
        if (inicio) { dlg.close(); renderTudo(); UI.avisar('Auditoria iniciada para a rota '+g.codigo+'.','sucesso'); } return;
      }
      var salvo=mutarOp(function(x){ var alvo=x.gaiolas.filter(function(y){return y.id===g.id;})[0]; var z=X.definirAuditoria(alvo,'concluida',nome,agora(),quantidades); if(!z.ok) throw new Error(z.erro); });
      if(salvo){dlg.close();renderTudo();UI.avisar('Auditoria da rota '+g.codigo+' concluída.','sucesso');}
    } }, [UI.campo('Auditor',auditor), camposQtd, erro,
      h('div',{class:'acoes-form acoes-form--modal'},[
        h('button',{type:'button',class:'botao botao--secundario',text:'Cancelar',onclick:function(){dlg.close();}}),
        h('button',{type:'submit',class:'botao botao--primario',id:'xa-ok',text:'Registrar'})
      ])]));
    dlg.showModal();
  }
  function dialogoAdicionarGaiolas() {
    var operacaoAtual = op();
    if (!operacaoAtual || operacaoAtual.fimCarregamentoAt || operacaoAtual.encerradaAt) {
      UI.avisar('Reabra um veículo antes de adicionar gaiolas após o fim do carregamento.', 'erro');
      return;
    }
    var c = estadoAuditorCampos(true); c.est.value = 'nao_iniciada';
    c.est.addEventListener('change', function () { c.auditor.required = c.est.value.indexOf('concluida') === 0; });
    dialogoCodigos({ titulo: 'Adicionar rotas', modo: 'adicionar', confirmar: 'Adicionar',
      existentes: function () { return op().gaiolas.map(function (g) { return g.codigo; }); },
      extras: [c.est, c.auditor], blocoExtra: function () { return h('div', {}, [h('p', { class: 'texto-apoio', text: 'Situa\u00e7\u00e3o inicial da auditoria das rotas adicionadas:' }), c.bloco]); },
      aoConfirmar: function (res) {
        var est = c.est.value, auditor = c.auditor.value, n = 0;
        if (est.indexOf('concluida') === 0 && !auditor.trim()) { UI.avisar('Informe o nome do auditor.', 'erro'); return false; }
        var r = mutarOp(function (o) { var x = X.adicionarGaiolas(o, res.alvo, agora()); n = x.adicionadas.length;
          x.adicionadas.forEach(function (g) { if (est !== 'nao_iniciada') X.definirAuditoria(g, est, est.indexOf('concluida') === 0 ? auditor : null, agora()); }); });
        if (!r) return false; renderTudo(); UI.avisar(n + ' rota(s) adicionada(s).', 'sucesso'); return true;
      } });
  }
  function dialogoAuditoriaLote() {
    var c = estadoAuditorCampos();
    c.est.addEventListener('change', function () { c.auditor.required = c.est.value.indexOf('concluida') === 0; });
    dialogoCodigos({ titulo: 'Auditar rotas em lote', modo: 'existentes', confirmar: 'Aplicar',
      ajuda: 'Informe as gaiolas j\u00e1 cadastradas que receber\u00e3o o mesmo resultado de auditoria.',
      existentes: function () { return op().gaiolas.map(function (g) { return g.codigo; }); },
      extras: [c.est, c.auditor], blocoExtra: function () { return c.bloco; },
      aoConfirmar: function (res) {
        var mapa = {}; op().gaiolas.forEach(function (g) { mapa[X.chave(g.codigo)] = g.id; });
        var ids = res.alvo.map(function (k) { return mapa[X.chave(k)]; }).filter(Boolean);
        if (c.est.value.indexOf('concluida') === 0 && !c.auditor.value.trim()) { UI.avisar('Informe o nome do auditor.', 'erro'); return false; }
        var quantidades = {};
        ['g','v','p'].forEach(function(k){ var n=X.inteiroOuNulo(c.quantidades[k].value); quantidades[k]=n.ok?n.valor:null; });
        if (c.est.value === 'concluida' && !X.validarQuantidadesAuditoria(quantidades)) { UI.avisar('Informe quantidades de gaiolas e paletes como inteiros não negativos.', 'erro'); return false; }
        return aplicarAuditoria(ids, c.est.value, c.auditor.value, quantidades);
      } });
  }

  // Reauditoria vinculada à ocorrência e à gaiola, mantendo intacta a auditoria original.
  function dialogoReauditoria(ocorrenciaId) {
    var o = op();
    var oc = o && o.ocorrencias.filter(function (x) { return x.id === ocorrenciaId; })[0];
    if (!oc) return;
    var gaiola = o.gaiolas.filter(function (g) { return X.chave(g.codigo) === X.chave(oc.gaiolaEncontrada); })[0];
    if (!gaiola) { UI.avisar('A rota vinculada à ocorrência não foi encontrada.', 'erro'); return; }
    var dlg = UI.dialogo('dlg-xpt-reauditoria');
    var auditor = h('input', { type: 'text', id: 'xra-auditor', maxlength: '100', required: true, placeholder: 'Nome de quem realizará a reauditoria' });
    var qtdG = h('input', { type: 'number', id: 'xra-g', min: '0', step: '1', required: true, value: '' });
    var qtdP = h('input', { type: 'number', id: 'xra-p', min: '0', step: '1', required: true, value: '' });
    var resultado = select('xra-resultado', [['divergencia', 'Concluída com divergência'], ['sem_divergencia', 'Sem divergência']], 'divergencia');
    var erro = aviso();
    dlg.appendChild(h('h2', { text: 'ReAuditar — gaiola ' + gaiola.codigo }));
    dlg.appendChild(h('p', { class: 'texto-apoio', text: 'Ocorrência vinculada: ' + X.rotuloCategoria(oc) + ' · ' + (oc.produtoId || 'sem identificador') + '. A reauditoria será registrada como novo evento; a auditoria original e a ocorrência serão preservadas.' }));
    dlg.appendChild(h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var nome = auditor.value.trim(), g = X.inteiroOuNulo(qtdG.value), p = X.inteiroOuNulo(qtdP.value);
      if (!nome) { erro.textContent = 'Informe o nome de quem realizará a reauditoria.'; return; }
      if (!g.ok || g.valor === null || !p.ok || p.valor === null) { erro.textContent = 'Informe quantidades inteiras não negativas de gaiolas e paletes.'; return; }
      var divergenciaOriginal = o.ocorrencias.some(function (item) { return item.status !== 'resolvido' && X.chave(item.gaiolaEncontrada) === X.chave(gaiola.codigo); });
      var registro = { id: U.gerarId('xra'), ocorrenciaId: oc.id, auditor: nome, em: new Date(agora()).toISOString(), quantidades: { g: g.valor, p: p.valor }, resultado: resultado.value, auditorOriginal: gaiola.auditoria.auditor || 'não informado', resultadoOriginal: divergenciaOriginal ? 'divergencia' : 'sem_divergencia' };
      var salvo = mutarOp(function (x) {
        var alvo = x.gaiolas.filter(function (y) { return y.id === gaiola.id; })[0];
        var ocorrencia = x.ocorrencias.filter(function (y) { return y.id === oc.id; })[0];
        if (!alvo || !ocorrencia) throw new Error('A gaiola ou ocorrência vinculada não foi encontrada.');
        alvo.auditoria.reauditorias = alvo.auditoria.reauditorias || [];
        alvo.auditoria.reauditorias.push(registro);
      });
      if (salvo) { dlg.close(); renderTudo(); UI.avisar('Reauditoria registrada para a rota ' + gaiola.codigo + '.', 'sucesso'); }
    } }, [
      UI.campo('Auditor da reauditoria', auditor),
      h('div', { class: 'interv-duas' }, [UI.campo('Quantidade de gaiolas f\u00edsicas', qtdG), UI.campo('Quantidade de paletes', qtdP)]),
      UI.campo('Resultado da reauditoria', resultado), erro,
      h('div', { class: 'acoes-form acoes-form--modal' }, [
        h('button', { type: 'button', class: 'botao botao--secundario', text: 'Cancelar', onclick: function () { dlg.close(); } }),
        h('button', { type: 'submit', class: 'botao botao--primario', id: 'xra-ok', text: 'Registrar' })
      ])
    ]));
    dlg.showModal();
  }

  // ================================================================ ocorrências
  function renderOcorrencias() {
    var o = op(); UI.limpar(el.pOcorrencias); if (!o) return;
    var categoria = select('xoc-categoria', [['', 'Selecione uma categoria']].concat(X.CATEGORIAS.map(function (c) { return [c.id, c.rotulo]; })), '');
    var produto = h('input', { type: 'text', id: 'xoc-produto', autocomplete: 'off', placeholder: 'Escaneie ou digite o c\u00f3digo do produto', required: true });
    var tipo = h('input', { type: 'text', id: 'xoc-tipo', placeholder: 'Tipo do produto (se conhecido)' });
    var encontrada = select('xoc-encontrada', [['', 'Selecione a rota onde foi encontrado']].concat(o.gaiolas.map(function (g) { return [g.codigo, g.codigo]; })), '');
    var correta = h('input', { type: 'text', id: 'xoc-correta', placeholder: 'C\u00f3digo da rota correta, se conhecido' });
    var pessoa = h('input', { type: 'text', id: 'xoc-pessoa', placeholder: 'Nome de quem encontrou', required: true });
    var quando = h('input', { type: 'datetime-local', id: 'xoc-quando', value: U.paraDatetimeLocal(new Date(agora())) });
    var outra = h('input', { type: 'text', id: 'xoc-outra', placeholder: 'Descreva a categoria, se selecionou Outra' });
    var nota = h('textarea', { id: 'xoc-nota', rows: '2', placeholder: 'Observa\u00e7\u00f5es (opcional)' });
    var video = h('video', { id: 'xoc-video', hidden: true, autoplay: true, muted: true, playsinline: true, class: 'xpt-camera-video' });
    var abrirCamera = h('button', { type: 'button', class: 'botao botao--secundario', id: 'xoc-abrir-camera', text: 'Escanear pela c\u00e2mera' });
    var fecharCamera = h('button', { type: 'button', class: 'botao botao--texto', id: 'xoc-fechar-camera', text: 'Fechar c\u00e2mera', hidden: true });
    var avisoCamera = h('p', { class: 'texto-apoio', id: 'xoc-aviso-camera', role: 'status' });
    var erro = aviso();
    var ocorrenciasReauditaveis = o.ocorrencias.filter(function (oc) {
      return o.gaiolas.some(function (g) { return X.chave(g.codigo) === X.chave(oc.gaiolaEncontrada); });
    });
    var alvoReauditoria = select('xoc-reauditar-alvo', [['', 'Selecione ocorrência e gaiola']].concat(ocorrenciasReauditaveis.map(function (oc) {
      return [oc.id, X.rotuloCategoria(oc) + ' · ' + (oc.produtoId || 'sem produto') + ' · Gaiola ' + oc.gaiolaEncontrada];
    })), '');
    var iniciarReauditoria = h('button', { type: 'button', class: 'botao botao--secundario', text: 'Iniciar ReAuditoria', disabled: !ocorrenciasReauditaveis.length, onclick: function () {
      if (!alvoReauditoria.value) { UI.avisar('Selecione uma ocorrência para reauditar.', 'erro'); return; }
      dialogoReauditoria(alvoReauditoria.value);
    } });
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

      h('form', { id: 'xoc-form', novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var dados = { categoria: categoria.value, produtoId: produto.value, tipoProduto: tipo.value, gaiolaEncontrada: encontrada.value,
          gaiolaCorreta: correta.value, identificadoPor: pessoa.value, quandoMs: quando.value ? new Date(quando.value).getTime() : agora(),
          outraDescricao: outra.value, observacao: nota.value };
        var r = X.novaOcorrencia(dados, agora()); if (!r.ok) { erro.textContent = r.erro; return; }
        var repetidos = X.produtoJaRegistrado(op(), r.ocorrencia.produtoId);
        var posicao = window.scrollY;
        var salvo = mutarOp(function (x) { x.ocorrencias.push(r.ocorrencia); }); if (!salvo) return;
        pararCamera(); renderTudo();
        window.scrollTo(window.scrollX, posicao);
        requestAnimationFrame(function () { window.scrollTo(window.scrollX, posicao); });
        UI.avisar('Ocorr\u00eancia registrada.' + (repetidos.length ? ' Aten\u00e7\u00e3o: este identificador j\u00e1 aparece em ' + repetidos.length + ' ocorr\u00eancia(s).' : ''), repetidos.length ? 'info' : 'sucesso');
      } }, [
        h('div', { class: 'xpt-grid' }, [
          UI.campo('Categoria', categoria), UI.campo('Identificador do produto', produto),
          h('div', { class: 'xpt-scanner-controls' }, [abrirCamera, fecharCamera]), video, avisoCamera,
          UI.campo('Tipo do produto', tipo), UI.campo('Rota encontrada', encontrada), UI.campo('Rota correta', correta),
          UI.campo('Encontrado por', pessoa), UI.campo('Data e hora', quando), UI.campo('Descrição (categoria Outra)', outra), UI.campo('Observa\u00e7\u00f5es', nota)
        ]), erro, h('button', { type: 'submit', class: 'botao botao--primario', text: 'Registrar ocorr\u00eancia' })
      ]),
      h('div', { class: 'xpt-subsecao' }, [h('h4', { text: 'ReAuditar ocorrência existente' }), h('p', { class: 'texto-apoio', text: 'Selecione uma ocorrência vinculada a uma gaiola cadastrada. A reauditoria será adicionada ao histórico sem substituir a auditoria original.' }), UI.campo('Ocorrência e gaiola', alvoReauditoria), iniciarReauditoria])
    ]));
    var lista = o.ocorrencias.slice().sort(function (a, b) { return Date.parse(b.registradaEm) - Date.parse(a.registradaEm); });
    var corpo = h('div', { class: 'xpt-lista-ocorrencias' }, lista.map(function (oc) {
      var campos = [];
      if (oc.produtoId) campos.push('Produto: ' + oc.produtoId);
      if (oc.tipoProduto) campos.push('Tipo: ' + oc.tipoProduto);
      if (oc.gaiolaEncontrada) campos.push('Rota encontrada: ' + oc.gaiolaEncontrada);
      if (oc.gaiolaCorreta) campos.push('Rota correta: ' + oc.gaiolaCorreta);
      if (oc.identificadoPor) campos.push('Encontrado por: ' + oc.identificadoPor);
      if (oc.observacao) campos.push(oc.observacao);
      return h('article', { class: 'cartao xpt-ocorrencia' }, [
        h('div', { class: 'cartao__cabecalho' }, [
          h('div', {}, [h('h3', { text: X.rotuloCategoria(oc) }), h('p', { class: 'texto-apoio', text: dataHora(oc.registradaEm) + ' \u00b7 ' + (oc.status === 'resolvido' ? 'Resolvida' : 'Pendente') })]),
          h('div', { class: 'acoes-form' }, [
            h('button', { type: 'button', class: 'botao botao--secundario', dataset: { acao: 'status-ocorrencia', id: oc.id }, text: oc.status === 'resolvido' ? 'Reabrir' : 'Registrar resolu\u00e7\u00e3o' })
          ])
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
      var posicaoScroll = window.scrollY;
      if (mutarOp(function (x) { var atual = x.ocorrencias.filter(function (y) { return y.id === b.dataset.id; })[0]; var r = X.mudarStatus(atual, novo, '', agora()); if (!r.ok) throw new Error(r.erro); })) {
        renderTudo();
        window.scrollTo(window.scrollX, posicaoScroll);
        requestAnimationFrame(function () { window.scrollTo(window.scrollX, posicaoScroll); });
        UI.avisar('Status da ocorr\u00eancia atualizado.', 'sucesso');
      }
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
    var erro = aviso();
    el.pVeiculos.appendChild(h('section', { class: 'cartao' }, [
      h('h3', { text: 'Registrar veículo' }),
      h('p', { class: 'texto-apoio', text: 'Cadastre o veículo e associe as gaiolas na aba Gaiolas e auditoria.' }),
      h('form', { id: 'xv-form', novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var r = X.novoVeiculo({ placa: placa.value, motorista: motorista.value }, agora());
        if (!r.ok) { erro.textContent = r.erro; return; }
        if (!mutarOp(function (x) {
          if (x.fimCarregamentoAt) throw new Error('Reabra um veículo antes de cadastrar outro após o fim do carregamento.');
          if (x.veiculos.some(function (v) { return X.normalizarPlaca(v.placa) === X.normalizarPlaca(r.veiculo.placa); })) throw new Error('Já existe um veículo com esta placa nesta operação.');
          x.veiculos.push(r.veiculo);
        })) return;
        UI.avisar('Veículo registrado.', 'sucesso'); renderTudo();
      } }, [
        h('div', { class: 'xpt-grid' }, [UI.campo('Placa', placa), UI.campo('Motorista', motorista)]),
        erro,
        h('button', { type: 'submit', class: 'botao botao--primario', text: 'Salvar veículo' })
      ])
    ]));
    if (!o.veiculos.length) {
      return;
    }
    o.veiculos.forEach(function (v) {
      var finalizado = !!v.finalizadoAt;
      var listaGaiolas = (v.gaiolaIds || []).map(function (gid) {
        var g = o.gaiolas.filter(function (x) { return x.id === gid; })[0];
        return g ? h('li', {}, [g.codigo, ' ', (!finalizado && !o.encerradaAt) ? h('button', { type: 'button', class: 'botao botao--texto', dataset: { acao: 'descarregar', veiculo: v.id, gaiola: gid }, text: 'Remover do veículo' }) : null]) : null;
      }).filter(Boolean);
      el.pVeiculos.appendChild(h('section', { class: 'cartao xpt-veiculo' }, [
        h('div', { class: 'cartao__cabecalho' }, [
          h('div', {}, [h('h3', { text: v.placa }), h('p', { class: 'texto-apoio', text: (v.motorista || 'Motorista não informado') + ' · ' + (finalizado ? 'Carregamento finalizado' : 'Em andamento') })]),
          h('span', { class: 'chip chip--neutro', text: listaGaiolas.length + ' rota(s)' }),
          !o.encerradaAt ? h('button', { type: 'button', class: 'botao botao--secundario', dataset: { acao: 'alternar-finalizacao-veiculo', veiculo: v.id }, text: finalizado ? 'Reabrir veículo' : 'Finalizar veículo' }) : null
        ]),
        h('div', {}, [h('h4', { text: 'Rotas associadas (' + listaGaiolas.length + ')' }), listaGaiolas.length ? h('ul', {}, listaGaiolas) : h('p', { class: 'texto-apoio', text: 'Nenhuma rota associada.' }), (function(){ var tv=X.quantidadesDoVeiculo(o,v); return h('p',{class:'texto-apoio',text:'Totais das rotas: Gaiolas f\u00edsicas ('+tv.gaiolasFisicas+') ? Paletes ('+tv.paletes+') ? Redes calculadas ('+tv.redes+')'}); })()])
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
      h('p', { class: 'texto-apoio', text: 'O relatorio separa os totais da operacao dos totais por rota. Produtos sao contabilizados no total geral; gaiolas fisicas e paletes sao somados a partir das quantidades registradas em cada rota. Redes usam G + V e nao incluem paletes.' }),
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
      h('p', { class: 'texto-apoio', text: 'Concluidas: ' + auditoria.concluidas + ' de ' + auditoria.total + ' rotas (' + (auditoria.percentual == null ? '—' : String(auditoria.percentual).replace('.', ',') + '%') + '). Pendentes: ' + auditoria.pendentes + '; não iniciadas: ' + auditoria.naoIniciadas + '. Pendências de ocorrência: ' + pend.length + '.' }),
      h('h3', { text: 'Histórico de auditorias e reauditorias' }),
      o.gaiolas.length ? h('ul', {}, o.gaiolas.map(function (g) {
        var linhas = [];
        if (g.auditoria && (g.auditoria.estado === 'concluida' || g.auditoria.estado.indexOf('concluida_') === 0)) {
          var primeiraReauditoria = g.auditoria.reauditorias && g.auditoria.reauditorias[0];
          var divergenciaOriginal = primeiraReauditoria ? primeiraReauditoria.resultadoOriginal === 'divergencia' : o.ocorrencias.some(function (oc) { return oc.status !== 'resolvido' && X.chave(oc.gaiolaEncontrada) === X.chave(g.codigo); });
          linhas.push('Concluída ' + (divergenciaOriginal ? 'com divergência' : 'sem divergência') + ' | Auditor: ' + (primeiraReauditoria ? primeiraReauditoria.auditorOriginal : g.auditoria.auditor || 'não informado'));
        }
        (g.auditoria && g.auditoria.reauditorias || []).forEach(function (ra) {
          linhas.push((ra.resultado === 'sem_divergencia' ? 'Reauditada sem divergência' : 'Reauditada com divergência') + ' | Auditor: ' + ra.auditor + ' | Ocorrência: ' + ra.ocorrenciaId);
        });
        return linhas.length ? h('li', {}, [h('strong', { text: 'Rota ' + g.codigo }), h('ul', {}, linhas.map(function (linha) { return h('li', { text: linha }); }))]) : null;
      }).filter(Boolean)) : h('p', { class: 'texto-apoio', text: 'Nenhuma rota cadastrada.' }),
      h('h3', { text: 'Ocorrências e resoluções' }),
      o.ocorrencias.length ? h('ul', {}, o.ocorrencias.map(function (oc) {
        return h('li', { text: dataHora(oc.registradaEm) + ' · ' + X.rotuloCategoria(oc) + ' · ' + (oc.produtoId || 'sem identificador') + ' · ' + oc.status + (oc.observacao ? ' · ' + oc.observacao : '') });
      })) : h('p', { class: 'texto-apoio', text: 'Nenhuma ocorrência registrada.' })
    ]));
  }

  function imprimirRelatorioDetalhado(opId) {
    var o = estado.operacoes.filter(function (x) { return x.id === opId; })[0]; if (!o) return;
    var titulo = 'MeliNotepad_XPT_' + (o.diaRef || X.diaRef(Date.parse(o.inicioAt)));
    var totaisRelatorio = X.totais(o), resumoAuditoriaRelatorio = X.resumoAuditoria(o.gaiolas);
    NS.Impressao.imprimir(titulo, function (raiz, criar) {
      raiz.classList.add('print-xpt');
      raiz.appendChild(criar('p', { class: 'print-marca', text: 'MELINOTEPAD  /  EXPEDI\u00c7\u00c3O' }));
      raiz.appendChild(criar('h1', { class: 'print-titulo', text: 'Relat\u00f3rio operacional XPT' }));
      raiz.appendChild(criar('p', { text: 'Data de referência: ' + U.formatarData(new Date(o.inicioAt)) }));
      raiz.appendChild(criar('p', { text: 'Início: ' + dataHora(o.inicioAt) + ' · Fim do carregamento: ' + (o.fimCarregamentoAt ? dataHora(o.fimCarregamentoAt) : 'não registrado') + ' · Encerramento: ' + (o.encerradaAt ? dataHora(o.encerradaAt) : 'operação aberta') }));
      raiz.appendChild(criar('h2', { class: 'print-subtitulo', text: 'Resumo executivo' }));
      raiz.appendChild(criar('div', { class: 'print-indicadores' }, [
        criar('div', { class: 'print-indicador' }, [criar('span', { text: 'Rotas' }), criar('strong', { text: String(totaisRelatorio.rotas) })]),
        criar('div', { class: 'print-indicador' }, [criar('span', { text: 'Gaiolas f\u00edsicas' }), criar('strong', { text: String(totaisRelatorio.gaiolasFisicas) })]),
        criar('div', { class: 'print-indicador' }, [criar('span', { text: 'Paletes nas rotas' }), criar('strong', { text: String(totaisRelatorio.paletesVeiculos) })]),
        criar('div', { class: 'print-indicador' }, [criar('span', { text: 'Produtos' }), criar('strong', { text: String(totaisRelatorio.totalProdutos) })])
      ]));
      raiz.appendChild(criar('p', { class: 'print-info', text: 'Auditoria: ' + resumoAuditoriaRelatorio.concluidas + '/' + resumoAuditoriaRelatorio.total + ' conclu\u00eddas (' + (resumoAuditoriaRelatorio.percentual == null ? '\u2014' : String(resumoAuditoriaRelatorio.percentual).replace('.', ',') + '%') + ') | Pendentes: ' + resumoAuditoriaRelatorio.pendentes + ' | N\u00e3o iniciadas: ' + resumoAuditoriaRelatorio.naoIniciadas + ' | Ocorr\u00eancias pendentes: ' + X.pendentesAbertas(o).length }));
      raiz.appendChild(criar('h2', { class: 'print-subtitulo', text: 'Quantidades da opera\u00e7\u00e3o' }));
      raiz.appendChild(criar('p', { text: 'Pacotes: ' + (o.quantidades.pacotes == null ? '—' : o.quantidades.pacotes) + ' · Volumosos: ' + (o.quantidades.volumosos == null ? '—' : o.quantidades.volumosos) + ' · Extra volumosos: ' + (o.quantidades.extraVolumosos == null ? '—' : o.quantidades.extraVolumosos) + ' · Total de produtos: ' + X.totais(o).totalProdutos }));
      raiz.appendChild(criar('p', { text: 'Paletes registrados na operacao: ' + (o.quantidades.paletes == null ? '—' : o.quantidades.paletes) + ' · Redes: ' + (o.quantidades.redes == null ? '—' : o.quantidades.redes) + ' · Total BK: ' + (o.quantidades.totalBK == null ? '—' : o.quantidades.totalBK) }));
      raiz.appendChild(criar('h2', { class: 'print-subtitulo', text: 'Rotas e auditoria' }));
      var a = X.resumoAuditoria(o.gaiolas);
      raiz.appendChild(criar('p', { text: 'Rotas: ' + a.total + ' · Concluídas: ' + a.concluidas + ' · Pendentes: ' + a.pendentes + ' · Não iniciadas: ' + a.naoIniciadas + ' · Percentual: ' + (a.percentual == null ? '—' : a.percentual + '%') }));
      raiz.appendChild(criar('table', { class: 'print-tabela' }, [
        criar('thead', {}, [criar('tr', {}, ['C\u00f3digo da rota', 'Estado', 'Auditor', 'Data da auditoria', 'Gaiolas f\u00edsicas', 'Paletes'].map(function (x) { return criar('th', { text: x }); }))]),
        criar('tbody', {}, o.gaiolas.map(function (g) { var q = X.quantidadesDaRota(g), qa = g.auditoria && g.auditoria.quantidades || {}; return criar('tr', {}, [
          criar('td', { text: g.codigo }), criar('td', { text: X.rotuloAuditoria(o, g) }), criar('td', { text: g.auditoria.auditor || '-' }),
          criar('td', { text: g.auditoria.em ? dataHora(g.auditoria.em) : '?' }),
          criar('td', { text: qa.g == null ? 'N\u00e3o informado' : String(q.gaiolasFisicas) }),
          criar('td', { text: qa.p == null ? 'N\u00e3o informado' : String(q.paletes) })
        ]); }))
      ]));
      raiz.appendChild(criar('h2', { class: 'print-subtitulo', text: 'Hist\u00f3rico de reauditorias por rota' }));
      var reauditorias = [];
      o.gaiolas.forEach(function (g) {
        (g.auditoria && g.auditoria.reauditorias || []).forEach(function (ra) {
          reauditorias.push(criar('li', { text: 'Rota ' + g.codigo + ' · ' + (ra.resultado === 'sem_divergencia' ? 'Reauditada sem divergência' : 'Reauditada com divergência') + ' · Auditor: ' + ra.auditor + ' · Data: ' + dataHora(ra.em) + ' · Ocorrência: ' + ra.ocorrenciaId + ' · Gaiolas: ' + ra.quantidades.g + ' · Paletes: ' + ra.quantidades.p }));
        });
      });
      raiz.appendChild(reauditorias.length ? criar('ul', {}, reauditorias) : criar('p', { text: 'Nenhuma reauditoria registrada.' }));
      raiz.appendChild(criar('h2', { class: 'print-subtitulo', text: 'Ve\u00edculos, rotas e fotos' }));
      return Promise.all(o.veiculos.map(function (v) { return v.fotoId && F ? F.urlDe(v.fotoId) : Promise.resolve(null); })).then(function (urlsFotos) {
        o.veiculos.forEach(function (v, i) {
          raiz.appendChild(criar('h3', { text: v.placa + (v.motorista ? ' · ' + v.motorista : '') }));
          var tv = X.quantidadesDoVeiculo(o, v);
          raiz.appendChild(criar('p', { text: 'Rotas associadas: ' + tv.rotas + ' | Gaiolas f\u00edsicas: ' + tv.gaiolasFisicas + ' | Paletes das rotas: ' + tv.paletes + ' | Redes calculadas (G + V): ' + tv.redes + ' | Sa\u00edda: ' + (v.saidaAt ? dataHora(v.saidaAt) : 'n\u00e3o registrada') }));
          var codigos = (v.gaiolaIds || []).map(function (gid) { var g = o.gaiolas.filter(function (x) { return x.id === gid; })[0]; return g ? g.codigo : null; }).filter(Boolean);
          raiz.appendChild(criar('p', { text: 'Rotas associadas: ' + (codigos.join(', ') || 'nenhuma') }));
          if (urlsFotos[i]) {
            var imagem = criar('img', { src: urlsFotos[i], alt: 'HAND e lacre juntos — veículo ' + v.placa, class: 'xpt-foto-relatorio' });
            raiz.appendChild(imagem);
            raiz.appendChild(criar('p', { text: 'Fotografia conjunta do HAND e do lacre.' }));
          } else raiz.appendChild(criar('p', { text: 'Foto HAND + lacre: não registrada ou indisponível neste aparelho.' }));
        });
        raiz.appendChild(criar('h2', { text: 'Ocorrências e histórico de resolução' }));
        raiz.appendChild(criar('ul', {}, o.ocorrencias.map(function (oc) {
          var hist = (oc.historico || []).map(function (z) { return dataHora(z.em) + ' ' + z.de + ' → ' + z.para + (z.nota ? ' (' + z.nota + ')' : ''); }).join('; ');
          return criar('li', { text: dataHora(oc.registradaEm) + ' · ' + X.rotuloCategoria(oc) + ' · produto: ' + (oc.produtoId || '—') + ' · tipo: ' + (oc.tipoProduto || '—') + ' · rota encontrada: ' + (oc.gaiolaEncontrada || '—') + ' · rota correta: ' + (oc.gaiolaCorreta || '—') + ' · identificado por: ' + (oc.identificadoPor || '—') + ' · situação: ' + oc.status + ' · observação: ' + (oc.observacao || '—') + (hist ? ' · histórico: ' + hist : '') });
        })));
      });
    }).catch(function (e) { UI.avisar('Não foi possível preparar o relatório: ' + (e.message || e), 'erro'); });
  }

  // ================================================================ montagem e navegação
  function criarEstrutura() {
    UI.limpar(el.raiz);
    var tabela = h('table', { class: 'tabela-modulo' }, [
      thead(['Data', 'Início', 'Fim do carregamento', 'Situação', 'Rotas', 'Pendências', '']),
      h('tbody', { id: 'xo-corpo-ops' })
    ]);
    el.corpoOps = tabela.querySelector('tbody');
    el.tabelaOps = tabela;
    el.vazioOps = h('p', { class: 'texto-apoio', text: 'Nenhuma operação XPT registrada.' });
    el.navPrincipal = h('nav', { class: 'nav-sub xpt-abas', 'aria-label': 'Seções principais do XPT' }, ABA_PRINCIPAL.map(function (a) { return h('button', { type: 'button', class: 'btn-nav' + (a[0] === ui.tela ? ' is-ativo' : ''), dataset: { tela: a[0] }, 'aria-pressed': a[0] === ui.tela ? 'true' : 'false', text: a[1] }); }));
    el.pOperacoes = h('div', { id: 'xo-tela-operacoes' });
    el.pHistorico = h('section', { id: 'xo-tela-historico', hidden: true }, [
      h('div', { class: 'cartao' }, [h('h2', { text: 'Histórico de operações XPT' }), h('p', { class: 'texto-apoio', text: 'O histórico reúne operações encerradas. Abra uma operação para consultar o relatório, copiar, imprimir/salvar em PDF ou excluir.' }),
        h('div', { class: 'xpt-grid' }, [UI.campo('Buscar operação, placa, motorista, rota ou conteúdo', el.histBusca = h('input', { type: 'search', id: 'xh-busca', placeholder: 'Digite para buscar' })), UI.campo('Encerrada a partir de', el.histInicio = h('input', { type: 'date', id: 'xh-inicio' })), UI.campo('Encerrada até', el.histFim = h('input', { type: 'date', id: 'xh-fim' }))]),
        h('div', { class: 'acoes-form' }, [h('button', { type: 'button', class: 'botao botao--secundario', text: 'Limpar filtros', onclick: function () { el.histBusca.value = ''; el.histInicio.value = ''; el.histFim.value = ''; renderHistorico(); } })]),
        h('p', { class: 'texto-apoio', id: 'xh-contagem', 'aria-live': 'polite' }), el.histVazio = h('p', { class: 'texto-apoio', text: 'Nenhuma operação encerrada no histórico.', id: 'xh-vazio', hidden: true }), el.histSemResultados = h('p', { class: 'texto-apoio', text: 'Nenhuma operação corresponde aos filtros.', id: 'xh-sem-resultados', hidden: true }),
        h('div', { class: 'tabela-rolavel xpt-tabela-desktop' }, [h('table', { class: 'tabela-modulo' }, [thead(['Data da operacao', 'Inicio', 'Encerrada em', 'Rotas', 'Veiculos', '']), h('tbody', { id: 'xh-corpo' })])]),
        el.histListaMobile = h('ul', { class: 'xpt-lista-mobile', 'aria-label': 'Histórico de operações encerradas' })]),
      el.histDetalhe = h('section', { class: 'cartao', id: 'xh-detalhe', hidden: true }, [h('div', { class: 'cartao__cabecalho' }, [h('h3', { id: 'xh-detalhe-titulo' }), h('button', { type: 'button', class: 'botao botao--texto', text: 'Fechar detalhes', onclick: fecharHistoricoDetalhe })]),
        h('p', { class: 'texto-apoio', id: 'xh-detalhe-info' }), h('label', { class: 'campo', for: 'xh-relatorio' }, [h('span', { text: 'Relatório completo da operação' }), el.histRelatorio = h('textarea', { id: 'xh-relatorio', rows: '18', readonly: true })]),
        h('div', { class: 'acoes-form' }, [h('button', { type: 'button', class: 'botao botao--secundario', text: 'Copiar relatório', onclick: copiarRelatorioHistorico }), h('button', { type: 'button', class: 'botao botao--secundario', text: 'Imprimir / Salvar como PDF', onclick: imprimirRelatorioHistorico }), h('button', { type: 'button', class: 'botao botao--perigo', text: 'Excluir operação', onclick: excluirOperacaoHistorico })])])
    ]);
    el.corpoHistorico = el.pHistorico.querySelector('#xh-corpo');
    el.histContagem = el.pHistorico.querySelector('#xh-contagem');
    el.histDetalheTitulo = el.pHistorico.querySelector('#xh-detalhe-titulo');
    el.histDetalheInfo = el.pHistorico.querySelector('#xh-detalhe-info');

    el.listaOps = h('section', { class: 'cartao' }, [
      h('div', { class: 'cartao__cabecalho' }, [h('h2', { text: 'Operações XPT' }), h('button', { type: 'button', class: 'botao botao--primario', id: 'xo-nova', text: '+ Nova operação', onclick: novaOperacao })]),
      h('p', { class: 'texto-apoio', text: 'A operação mantém sua data de referência mesmo que atravesse a meia-noite. Fim do carregamento e encerramento são registros separados.' }),
      el.vazioOps, h('div', { class: 'tabela-rolavel xpt-tabela-desktop' }, [tabela]),
      el.listaOpsMobile = h('ul', { class: 'xpt-lista-mobile', 'aria-label': 'Operações XPT' })
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
    el.pOperacoes.appendChild(el.listaOps);
    el.raiz.appendChild(el.navPrincipal); el.raiz.appendChild(el.pOperacoes); el.raiz.appendChild(el.pHistorico); el.raiz.appendChild(el.detalhe);
    el.navPrincipal.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tela]'); if (!b) return;
      ui.tela = b.dataset.tela; renderTudo();
    });
    el.pHistorico.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-acao="detalhe-historico"]'); if (b) abrirHistorico(b.dataset.id);
    });
    [el.histBusca, el.histInicio, el.histFim].forEach(function (x) { x.addEventListener(x === el.histBusca ? 'input' : 'change', renderHistorico); });
    el.navAbas.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-aba]'); if (!b) return;
      ui.aba = b.dataset.aba; renderAba();
    });
    el.listaOps.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-acao="abrir"]'); if (b) abrirOperacao(b.dataset.id);
    });
    el.pVeiculos.addEventListener('click', function (e) {
      var alternar = e.target.closest('button[data-acao="alternar-finalizacao-veiculo"]');
      if (alternar) {
        var opAtual = op();
        var veiculo = opAtual && opAtual.veiculos.filter(function (v) { return v.id === alternar.dataset.veiculo; })[0];
        if (!veiculo || opAtual.encerradaAt) return;
        var reabrir = !!veiculo.finalizadoAt;
        if (!global.confirm(reabrir ? 'Reabrir este veículo para edição?' : 'Finalizar o carregamento deste veículo?')) return;
        var gravou = mutarOp(function (x) {
          var v = x.veiculos.filter(function (z) { return z.id === alternar.dataset.veiculo; })[0];
          if (!v) throw new Error('Veículo não encontrado.');
          v.historico = v.historico || [];
          if (v.finalizadoAt) {
            v.finalizadoAt = null;
            x.fimCarregamentoAt = null;
            v.historico.push({ em: new Date(agora()).toISOString(), acao: 'veiculo_reaberto' });
          } else {
            v.finalizadoAt = new Date(agora()).toISOString();
            v.historico.push({ em: v.finalizadoAt, acao: 'veiculo_finalizado' });
            x.fimCarregamentoAt = x.veiculos.length > 0 && x.veiculos.every(function (item) { return !!item.finalizadoAt; }) ? v.finalizadoAt : null;
          }
        });
        if (gravou) { renderTudo(); UI.avisar(reabrir ? 'Veículo reaberto.' : 'Veículo finalizado.', 'sucesso'); }
        return;
      }
      var b = e.target.closest('button[data-acao="descarregar"]'); if (!b) return;
      var atual = op();
      var vAtual = atual && atual.veiculos.filter(function (v) { return v.id === b.dataset.veiculo; })[0];
      if (!atual || atual.encerradaAt || (vAtual && vAtual.finalizadoAt)) { UI.avisar('Reabra o veículo antes de alterar suas gaiolas.', 'erro'); return; }
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
    var telaHistorico = ui.tela === 'historico';
    el.navPrincipal.hidden = !!ui.opId;
    el.pOperacoes.hidden = !!ui.opId || telaHistorico;
    el.pHistorico.hidden = !!ui.opId || !telaHistorico;
    Array.prototype.forEach.call(el.navPrincipal.querySelectorAll('button[data-tela]'), function (b) {
      var ativo = b.dataset.tela === ui.tela; b.classList.toggle('is-ativo', ativo); b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    });
    if (telaHistorico && !ui.opId) renderHistorico();
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
    if (SaveStatus) { SaveStatus.modulo('XPT'); SaveStatus.aoTentarNovamente(function () { var r = store.tentarNovamente(); if (!r.sucesso) { SaveStatus.erro(r.erro); UI.avisar(r.erro, 'erro'); return; } estado = r.dados; SaveStatus.salvo(); renderTudo(); UI.avisar('Dados XPT salvos com sucesso.', 'sucesso'); }, 'XPT'); }
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
