/**
 * intervalos.js
 * Tela do Controle de Intervalos (módulo independente do NEX e do XPT).
 * Regras de cálculo ficam em intervalos-regras.js; aqui só há interface e gravação.
 * Dados: LocalStorage, chave própria (melinotepad_intervalos_v1) — sem sincronização.
 */
(function (global) {
  'use strict';
  var NS = global.MeliNotepad, R = NS.IntervalosRegras, U = NS.Utils, UI = NS.UI, h = UI.h;
  var MIN = 60000;
  var ABAS = [['ativos', 'Ativos'], ['funcionarios', 'Funcionários'], ['historico', 'Histórico']];

  var store = NS.ModStore.criar({ chave: 'melinotepad_intervalos_v1', rotulo: 'Intervalos', padrao: R.padrao, validar: R.validarDados });
  var estado = R.padrao(), avisoArmazenamento = null;
  var el = {}, ui = { aba: 'ativos', assinatura: '', busca: '', filtro: { func: '', data: '', setor: '*' } };
  var novo = null, detalhe = null;

  function agora() { return U.agora().getTime(); }
  function hhmm(ms) { return U.formatarHora(new Date(ms)); }
  function dataLocal(ms) { return U.paraDatetimeLocal(new Date(ms)).slice(0, 10); }
  function recarregar() { var c = store.carregar(); estado = c.dados; avisoArmazenamento = c.aviso; }
  function mutar(fn) {
    var r = store.mutar(fn);
    if (!r.sucesso) { UI.avisar(r.erro, 'erro'); return null; }
    estado = r.dados; return r;
  }
  function funcionarioPorId(id) { return estado.funcionarios.filter(function (f) { return f.id === id; })[0] || null; }

  // ------------------------------------------------------------------ cadastro
  function criarFuncionario(nome, setor) {
    recarregar();
    nome = R.limpar(nome);
    if (!nome) return { ok: false, erro: 'Informe o nome completo do funcionário.' };
    var dup = R.buscarDuplicado(estado.funcionarios, nome);
    if (dup) return { ok: false, duplicado: dup, erro: 'Já existe um cadastro com este nome: ' + R.rotuloFuncionario(dup) + (dup.ativo ? '' : ' (inativo)') + '.' };
    var f = R.novoFuncionario(nome, R.normalizarSetor(setor, estado.setores), agora());
    var r = mutar(function (d) {
      if (R.buscarDuplicado(d.funcionarios, nome)) throw new Error('Já existe um cadastro com este nome.');
      d.funcionarios.push(f);
      if (f.setor && !d.setores.some(function (s) { return R.normalizar(s) === R.normalizar(f.setor); })) d.setores.push(f.setor);
    });
    return r ? { ok: true, funcionario: f } : { ok: false, erro: '', silencioso: true };
  }

  // -------------------------------------------------- campos duração / saída / entrada
  // ctx: { saidaMs, duracaoMin, entradaMs }. A última edição manda; nada é sobrescrito em silêncio.
  function ligarCampos(ctx, c, aoMudar) {
    function msg(t) { c.msg.textContent = t || ''; }
    c.dur.addEventListener('input', function () {
      var v = R.validarDuracao(c.dur.value);
      if (!v.ok) { msg(v.erro); return; }
      ctx.duracaoMin = v.valor; ctx.entradaManual = false;
      ctx.entradaMs = ctx.saidaMs + ctx.duracaoMin * MIN; c.entrada.value = hhmm(ctx.entradaMs);
      msg(''); if (aoMudar) aoMudar();
    });
    c.saida.addEventListener('change', function () {
      var r = R.resolverSaida(c.saida.value, agora());
      if (!r.ok) { msg(r.erro); c.saida.value = hhmm(ctx.saidaMs); return; }
      ctx.saidaMs = r.ms; ctx.saidaEditada = true; ctx.entradaManual = false;
      ctx.entradaMs = ctx.saidaMs + ctx.duracaoMin * MIN; c.entrada.value = hhmm(ctx.entradaMs);
      msg(''); if (aoMudar) aoMudar();
    });
    c.entrada.addEventListener('change', function () {
      var r = R.resolverEntrada(c.entrada.value, ctx.saidaMs);
      var rc = r.ok ? R.recalcular({ saidaMs: ctx.saidaMs, duracaoMin: ctx.duracaoMin, entradaMs: r.ms }, 'entrada') : r;
      if (!rc.ok) { msg(rc.erro); c.entrada.value = hhmm(ctx.entradaMs); return; }
      ctx.entradaMs = r.ms; ctx.duracaoMin = rc.duracaoMin; ctx.entradaManual = true;
      c.dur.value = ctx.duracaoMin; msg(''); if (aoMudar) aoMudar();
    });
  }
  function criarCampos(ctx) {
    var c = {
      dur: h('input', { type: 'number', inputmode: 'numeric', min: '1', max: String(R.DURACAO_MAX_MIN), step: '1', value: ctx.duracaoMin }),
      saida: h('input', { type: 'time', value: hhmm(ctx.saidaMs), step: '60' }),
      entrada: h('input', { type: 'time', value: hhmm(ctx.entradaMs), step: '60' }),
      msg: h('p', { class: 'texto-aviso', role: 'alert' })
    };
    c.dur.id = 'iv-' + Math.random().toString(36).slice(2, 7); c.saida.id = c.dur.id + 's'; c.entrada.id = c.dur.id + 'e';
    c.bloco = h('div', { class: 'interv-trio' }, [
      UI.campo('Duração (min)', c.dur), UI.campo('HR saída', c.saida), UI.campo('HR entrada', c.entrada)
    ]);
    return c;
  }

  // ------------------------------------------------------------------ NOVO INTERVALO
  function abrirNovo() {
    recarregar();
    var t = agora();
    novo = { f: null, ctx: { saidaMs: t, duracaoMin: R.DURACAO_PADRAO_MIN, entradaMs: t + R.DURACAO_PADRAO_MIN * MIN, saidaEditada: false, entradaManual: false },
             setorTocado: false, salvando: false, confirmouDuplicado: false };
    var dlg = UI.dialogo('dlg-interv-novo');
    var busca = h('input', { type: 'text', id: 'iv-busca', autocomplete: 'off', placeholder: 'Digite o nome para buscar', role: 'combobox', 'aria-autocomplete': 'list', 'aria-controls': 'iv-lista', 'aria-expanded': 'false' });
    var lista = h('ul', { id: 'iv-lista', class: 'lista-escolha', role: 'listbox', 'aria-label': 'Funcionários' });
    var escolhido = h('div', { class: 'interv-escolhido', hidden: true });
    var setor = h('input', { type: 'text', id: 'iv-setor', list: 'interv-setores', autocomplete: 'off', placeholder: 'Opcional' });
    var campos = criarCampos(novo.ctx);
    var erro = h('p', { class: 'texto-aviso', role: 'alert', id: 'iv-erro' });
    var ok = h('button', { type: 'submit', class: 'botao botao--primario', id: 'iv-confirmar', text: 'Liberar intervalo' });

    function renderLista() {
      UI.limpar(lista);
      var q = R.normalizar(busca.value);
      var ativos = estado.funcionarios.filter(function (f) { return f.ativo !== false; })
        .sort(function (a, b) { return R.normalizar(a.nome) < R.normalizar(b.nome) ? -1 : 1; });
      var achados = ativos.filter(function (f) { return !q || R.normalizar(f.nome).indexOf(q) >= 0; }).slice(0, 8);
      achados.forEach(function (f) {
        lista.appendChild(h('li', { role: 'presentation' }, [h('button', { type: 'button', role: 'option', class: 'lista-escolha__item', text: R.rotuloFuncionario(f), onclick: function () { escolher(f); } })]));
      });
      if (q && !R.buscarDuplicado(estado.funcionarios, busca.value)) {
        lista.appendChild(h('li', { role: 'presentation' }, [h('button', { type: 'button', class: 'lista-escolha__item lista-escolha__item--novo', id: 'iv-cadastrar', text: '+ Cadastrar “' + R.limpar(busca.value) + '”', onclick: cadastrarDaBusca })]));
      }
      if (!achados.length && !q) lista.appendChild(h('li', { class: 'texto-apoio', text: 'Nenhum funcionário cadastrado. Digite um nome para cadastrar.' }));
      busca.setAttribute('aria-expanded', String(lista.childNodes.length > 0));
    }
    function escolher(f) {
      novo.f = f; novo.confirmouDuplicado = false; erro.textContent = '';
      if (!novo.setorTocado) setor.value = f.setor || '';
      UI.limpar(escolhido).appendChild(h('span', { class: 'interv-escolhido__nome', text: 'Funcionário: ' + R.rotuloFuncionario(f) }));
      escolhido.appendChild(h('button', { type: 'button', class: 'botao botao--texto', id: 'iv-trocar', text: 'Trocar', onclick: function () { novo.f = null; escolhido.hidden = true; busca.hidden = false; lista.hidden = false; busca.value = ''; renderLista(); busca.focus(); } }));
      escolhido.hidden = false; busca.hidden = true; lista.hidden = true;
    }
    function cadastrarDaBusca() {
      var r = criarFuncionario(busca.value, setor.value);
      if (r.ok) { UI.avisar('Funcionário cadastrado.', 'sucesso'); renderSetores(); escolher(r.funcionario); renderFuncionarios(); }
      else if (r.duplicado) { erro.textContent = r.erro; escolher(r.duplicado); }
      else if (!r.silencioso) erro.textContent = r.erro;
    }
    busca.addEventListener('input', renderLista);
    busca.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); var p = lista.querySelector('.lista-escolha__item'); if (p) p.click(); }
    });
    setor.addEventListener('input', function () { novo.setorTocado = true; });
    ligarCampos(novo.ctx, campos);

    var form = h('form', { novalidate: true, onsubmit: function (e) { e.preventDefault(); confirmarNovo(erro, ok, setor); } }, [
      h('div', { class: 'campo' }, [h('label', { for: 'iv-busca', text: 'Funcionário (obrigatório)' }), busca, escolhido, lista]),
      UI.campo('Setor (opcional)', setor, 'Pode ficar em branco. Se o cadastro tiver setor, ele vem sugerido e pode ser alterado ou limpo.'),
      campos.bloco, campos.msg, erro,
      h('div', { class: 'acoes-form acoes-form--modal' }, [
        h('button', { type: 'button', class: 'botao botao--secundario', id: 'iv-cancelar', text: 'Cancelar', onclick: function () { fecharNovo(); } }), ok])
    ]);
    dlg.appendChild(h('h2', { text: 'Novo intervalo' }));
    dlg.appendChild(h('p', { class: 'texto-apoio', text: 'O contador só começa quando você confirmar.' }));
    dlg.appendChild(form);
    novo.campos = campos; novo.setor = setor;
    renderLista();
    if (!dlg.open) dlg.showModal();
    busca.focus();
  }
  function fecharNovo() { var d = document.getElementById('dlg-interv-novo'); if (d && d.open) d.close(); novo = null; }

  function confirmarNovo(erro, ok, setorInput) {
    if (!novo || novo.salvando) return;
    erro.textContent = '';
    recarregar();
    var f = novo.f && funcionarioPorId(novo.f.id);
    if (!f) { erro.textContent = 'Selecione o funcionário.'; return; }
    var t = agora(), c = novo.ctx;
    var saidaMs = c.saidaEditada ? c.saidaMs : t, duracao = c.duracaoMin, entradaMs;
    if (c.entradaManual) {
      var re = R.resolverEntrada(hhmm(c.entradaMs), saidaMs); if (!re.ok) { erro.textContent = re.erro; return; }
      var rc = R.recalcular({ saidaMs: saidaMs, duracaoMin: duracao, entradaMs: re.ms }, 'entrada'); if (!rc.ok) { erro.textContent = rc.erro; return; }
      entradaMs = re.ms; duracao = rc.duracaoMin;
    } else entradaMs = saidaMs + duracao * MIN;
    var ativos = R.intervalosAtivosDe(estado, f.id);
    if (ativos.length && !novo.confirmouDuplicado) {
      novo.confirmouDuplicado = true; ok.textContent = 'Liberar mesmo assim';
      erro.textContent = f.nome + ' já tem um intervalo em andamento. Confirme para registrar outro.'; return;
    }
    var setor = R.normalizarSetor(setorInput.value, estado.setores);
    var r = R.novoIntervalo({ funcionario: f, setor: setor, duracaoMin: duracao, saidaMs: saidaMs, entradaMs: entradaMs, agoraMs: t });
    if (!r.ok) { erro.textContent = r.erro; return; }
    novo.salvando = true;
    var gravou = mutar(function (d) {
      d.intervalos.push(r.intervalo);
      if (setor && !d.setores.some(function (s) { return R.normalizar(s) === R.normalizar(setor); })) d.setores.push(setor);
    });
    if (!gravou) { novo.salvando = false; return; }
    fecharNovo(); renderTudo(true); UI.avisar('Intervalo liberado: ' + R.primeiroNome(f.nome) + '.', 'sucesso');
  }

  // ------------------------------------------------------------------ detalhe / retorno
  function abrirDetalhe(id, foco) {
    recarregar();
    var i = estado.intervalos.filter(function (x) { return x.id === id; })[0];
    if (!i || i.status !== 'ativo') { renderTudo(true); return; }
    var orig = { saidaMs: Date.parse(i.saidaAt), duracaoMin: i.duracaoPrevistaMin, entradaMs: Date.parse(i.retornoPrevistoAt) };
    detalhe = { id: id, ctx: Object.assign({ saidaEditada: true, entradaManual: false }, orig), orig: orig };
    var dlg = UI.dialogo('dlg-interv-detalhe');
    var campos = criarCampos(detalhe.ctx);
    var erro = h('p', { class: 'texto-aviso', role: 'alert', id: 'idt-erro' });
    var salvar = h('button', { type: 'button', class: 'botao botao--secundario', id: 'idt-salvar', text: 'Salvar alterações', disabled: true });
    var retorno = h('button', { type: 'button', class: 'botao botao--primario btn-grande', id: 'idt-retorno', text: 'REGISTRAR RETORNO' });
    var f = funcionarioPorId(i.funcionarioId);
    function sujo() { var c = detalhe.ctx; return c.saidaMs !== orig.saidaMs || c.duracaoMin !== orig.duracaoMin || c.entradaMs !== orig.entradaMs; }
    function atualizarBotoes() { salvar.disabled = !sujo(); retorno.disabled = sujo(); if (sujo()) erro.textContent = 'Salve as alterações antes de registrar o retorno.'; else if (/Salve as/.test(erro.textContent)) erro.textContent = ''; }
    ligarCampos(detalhe.ctx, campos, atualizarBotoes);
    salvar.addEventListener('click', function () {
      var r = R.editarIntervalo(i, detalhe.ctx, agora());
      if (!r.ok) { erro.textContent = r.erro; return; }
      var g = mutar(function (d) {
        var k = d.intervalos.findIndex(function (x) { return x.id === id; });
        if (k < 0 || d.intervalos[k].status !== 'ativo') throw new Error('Este intervalo já foi encerrado em outra aba.');
        d.intervalos[k] = R.editarIntervalo(d.intervalos[k], detalhe.ctx, agora()).intervalo;
      });
      if (g) { fecharDetalhe(); renderTudo(true); UI.avisar('Horários atualizados. A alteração ficou no histórico.', 'sucesso'); }
    });
    retorno.addEventListener('click', function () {
      if (sujo()) return;
      var g = mutar(function (d) {
        var k = d.intervalos.findIndex(function (x) { return x.id === id; });
        if (k < 0) throw new Error('Intervalo não encontrado.');
        var r = R.registrarRetorno(d.intervalos[k], agora()); if (!r.ok) throw new Error(r.erro);
        d.intervalos[k] = r.intervalo;
      });
      if (g) { fecharDetalhe(); renderTudo(true); UI.avisar('Retorno registrado: ' + R.primeiroNome(i.funcionarioNome) + '.', 'sucesso'); }
    });
    var av = R.avaliar(i, agora());
    dlg.appendChild(h('h2', { text: i.funcionarioNome }));
    dlg.appendChild(h('p', { class: 'texto-apoio', id: 'idt-resumo', text: (i.setor || 'Sem setor') + ' · ' + av.minutos + ' min decorridos · ' + R.rotuloEstado(av) }));
    dlg.appendChild(campos.bloco); dlg.appendChild(campos.msg); dlg.appendChild(erro);
    if (i.alteracoes.length) dlg.appendChild(h('p', { class: 'texto-apoio', text: 'Alterações anteriores neste intervalo: ' + i.alteracoes.length }));
    dlg.appendChild(h('div', { class: 'acoes-form acoes-form--coluna' }, [retorno, salvar,
      h('button', { type: 'button', class: 'botao botao--texto', id: 'idt-fechar', text: 'Fechar', onclick: fecharDetalhe })]));
    if (!dlg.open) dlg.showModal();
    var alvo = { duracao: campos.dur, saida: campos.saida, entrada: campos.entrada }[foco];
    if (alvo) alvo.focus(); else retorno.focus();
  }
  function fecharDetalhe() { var d = document.getElementById('dlg-interv-detalhe'); if (d && d.open) d.close(); detalhe = null; }

  // ------------------------------------------------------------------ renderização
  function renderSetores() {
    var dl = document.getElementById('interv-setores');
    if (!dl) { dl = h('datalist', { id: 'interv-setores' }); document.body.appendChild(dl); }
    UI.limpar(dl); estado.setores.forEach(function (s) { dl.appendChild(h('option', { value: s })); });
  }

  function celula(campo, texto, i, rotulo) {
    return h('button', { type: 'button', class: 'celula-acao', dataset: { campo: campo, id: i.id }, text: texto, 'aria-label': rotulo + ' de ' + i.funcionarioNome + ': ' + texto + '. Tocar para abrir.', title: i.funcionarioNome });
  }

  function renderAtivos(forcar) {
    var t = agora();
    var ord = R.ordenar(estado.intervalos.filter(function (i) { return i.status === 'ativo'; }), t);
    var sig = ord.map(function (x) { var i = x.i; return [i.id, x.av.minutos, x.av.excedido ? 1 : 0, i.saidaAt, i.retornoPrevistoAt, i.duracaoPrevistaMin, i.setor].join(':'); }).join('|');
    if (!forcar && sig === ui.assinatura) return;
    ui.assinatura = sig;
    var ex = ord.filter(function (x) { return x.av.excedido; }).length;
    el.cTotal.textContent = ord.length; el.cPrazo.textContent = ord.length - ex; el.cExc.textContent = ex;
    UI.limpar(el.corpoAtivos);
    ord.forEach(function (x) {
      var i = x.i, av = x.av;
      el.corpoAtivos.appendChild(h('tr', { class: 'interv-linha' + (av.excedido ? ' is-excedido' : ''), dataset: { id: i.id } }, [
        h('td', { class: 'col-status' }, [h('span', { class: 'dot ' + (av.excedido ? 'dot--vermelho' : 'dot--verde'), 'aria-hidden': 'true' }), h('span', { class: 'sr-only', text: R.rotuloEstado(av) })]),
        h('td', { class: 'col-duracao' }, [celula('duracao', av.minutos + ' min', i, 'Duração decorrida (prevista ' + i.duracaoPrevistaMin + ' min)')]),
        h('td', { class: 'col-nome' }, [celula('nome', R.primeiroNome(i.funcionarioNome), i, 'Funcionário')]),
        h('td', {}, [celula('saida', hhmm(Date.parse(i.saidaAt)), i, 'HR saída')]),
        h('td', {}, [celula('entrada', hhmm(Date.parse(i.retornoPrevistoAt)), i, 'HR entrada prevista')]),
        h('td', { class: 'col-setor', text: i.setor || '—' })
      ]));
    });
    el.vazioAtivos.hidden = ord.length > 0;
    el.tabelaAtivos.hidden = ord.length === 0;
  }

  function renderFuncionarios() {
    var q = R.normalizar(ui.busca);
    var lista = estado.funcionarios.filter(function (f) { return !q || R.normalizar(f.nome).indexOf(q) >= 0 || R.normalizar(f.setor).indexOf(q) >= 0; })
      .sort(function (a, b) { return R.normalizar(a.nome) < R.normalizar(b.nome) ? -1 : 1; });
    UI.limpar(el.corpoFunc);
    lista.forEach(function (f) {
      el.corpoFunc.appendChild(h('tr', { dataset: { id: f.id } }, [
        h('td', { text: f.nome }), h('td', { text: f.setor || '—' }), h('td', { text: f.ativo === false ? 'Inativo' : 'Ativo' }),
        h('td', {}, [h('button', { type: 'button', class: 'botao botao--texto', dataset: { acao: 'editar', id: f.id }, text: 'Editar' })])
      ]));
    });
    el.contFunc.textContent = estado.funcionarios.length + ' cadastrado(s)' + (q ? ' · ' + lista.length + ' na busca' : '');
    el.vazioFunc.hidden = lista.length > 0;
  }

  function abrirEdicaoFuncionario(id) {
    recarregar(); var f = funcionarioPorId(id); if (!f) return;
    var dlg = UI.dialogo('dlg-interv-func');
    var nome = h('input', { type: 'text', value: f.nome, autocomplete: 'off' }), setor = h('input', { type: 'text', value: f.setor || '', list: 'interv-setores' });
    var ativo = h('input', { type: 'checkbox', id: 'ef-ativo' }); ativo.checked = f.ativo !== false;
    var erro = h('p', { class: 'texto-aviso', role: 'alert' });
    dlg.appendChild(h('h2', { text: 'Editar funcionário' }));
    dlg.appendChild(h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var n = R.limpar(nome.value); if (!n) { erro.textContent = 'Informe o nome completo.'; return; }
      var dup = R.buscarDuplicado(estado.funcionarios, n, id);
      if (dup) { erro.textContent = 'Já existe outro cadastro com este nome: ' + R.rotuloFuncionario(dup) + '.'; return; }
      var s = R.normalizarSetor(setor.value, estado.setores);
      var g = mutar(function (d) {
        var x = d.funcionarios.filter(function (y) { return y.id === id; })[0]; if (!x) throw new Error('Cadastro não encontrado.');
        if (R.buscarDuplicado(d.funcionarios, n, id)) throw new Error('Já existe outro cadastro com este nome.');
        x.nome = n; x.setor = s; x.ativo = ativo.checked; x.atualizadoEm = new Date(agora()).toISOString();
        if (s && !d.setores.some(function (z) { return R.normalizar(z) === R.normalizar(s); })) d.setores.push(s);
      });
      if (g) { dlg.close(); renderTudo(true); UI.avisar('Cadastro atualizado. Intervalos já registrados não foram alterados.', 'sucesso'); }
    } }, [UI.campo('Nome completo', nome), UI.campo('Setor', setor, 'Alterar o setor não cria outro funcionário nem muda intervalos antigos.'),
      h('label', { class: 'interv-check', for: 'ef-ativo' }, [ativo, ' Cadastro ativo (aparece na liberação)']), erro,
      h('div', { class: 'acoes-form acoes-form--modal' }, [h('button', { type: 'button', class: 'botao botao--secundario', text: 'Cancelar', onclick: function () { dlg.close(); } }), h('button', { type: 'submit', class: 'botao botao--primario', id: 'ef-salvar', text: 'Salvar' })])]));
    dlg.showModal();
  }

  function filtrarHistorico() {
    var f = ui.filtro;
    return estado.intervalos.filter(function (i) { return i.status === 'encerrado'; }).filter(function (i) {
      if (f.func && i.funcionarioId !== f.func) return false;
      if (f.data && dataLocal(Date.parse(i.saidaAt)) !== f.data) return false;
      if (f.setor !== '*' && (f.setor === '' ? !!i.setor : R.normalizar(i.setor) !== R.normalizar(f.setor))) return false;
      return true;
    }).sort(function (a, b) { return Date.parse(b.saidaAt) - Date.parse(a.saidaAt); });
  }

  function renderHistorico() {
    UI.limpar(el.fFunc); el.fFunc.appendChild(h('option', { value: '', text: 'Todos os funcionários' }));
    estado.funcionarios.slice().sort(function (a, b) { return R.normalizar(a.nome) < R.normalizar(b.nome) ? -1 : 1; })
      .forEach(function (f) { el.fFunc.appendChild(h('option', { value: f.id, text: R.rotuloFuncionario(f) })); });
    el.fFunc.value = ui.filtro.func;
    UI.limpar(el.fSetor); el.fSetor.appendChild(h('option', { value: '*', text: 'Todos os setores' })); el.fSetor.appendChild(h('option', { value: '', text: '(sem setor)' }));
    estado.setores.forEach(function (s) { el.fSetor.appendChild(h('option', { value: s, text: s })); });
    el.fSetor.value = ui.filtro.setor; el.fData.value = ui.filtro.data;
    var itens = filtrarHistorico(); UI.limpar(el.corpoHist);
    itens.forEach(function (i) {
      var av = R.avaliar(i, agora()), s = Date.parse(i.saidaAt), r = Date.parse(i.retornoRealAt);
      var real = dataLocal(r) === dataLocal(s) ? hhmm(r) : U.formatarData(new Date(r)) + ' ' + hhmm(r);
      var alt = i.alteracoes.length ? h('details', {}, [h('summary', { text: i.alteracoes.length + ' alteração(ões)' }),
        h('ul', { class: 'interv-alteracoes' }, i.alteracoes.map(function (a) { return h('li', { text: U.formatarDataHora(new Date(a.em)) + ' · ' + nomeCampo(a.campo) + ': ' + valorCampo(a.campo, a.de) + ' → ' + valorCampo(a.campo, a.para) }); }))]) : '—';
      el.corpoHist.appendChild(h('tr', { dataset: { id: i.id } }, [
        h('td', { text: i.funcionarioNome }), h('td', { text: i.setor || '—' }), h('td', { text: U.formatarData(new Date(s)) }), h('td', { text: hhmm(s) }),
        h('td', { text: i.duracaoPrevistaMin + ' min' }), h('td', { text: hhmm(Date.parse(i.retornoPrevistoAt)) }), h('td', { text: real }),
        h('td', { text: av.excedido ? 'Excedeu em ' + (av.minutos - av.limite) + ' min (' + av.minutos + ' min no total)' : 'No prazo (' + av.minutos + ' min)' }), h('td', {}, [alt])
      ]));
    });
    el.contHist.textContent = itens.length + ' intervalo(s) encerrado(s)';
    el.vazioHist.hidden = itens.length > 0;
  }
  function nomeCampo(c) { return { duracaoPrevistaMin: 'duração prevista', saidaAt: 'HR saída', retornoPrevistoAt: 'HR entrada prevista' }[c] || c; }
  function valorCampo(c, v) { return c === 'duracaoPrevistaMin' ? v + ' min' : hhmm(Date.parse(v)); }

  function renderAba() {
    ABAS.forEach(function (a) { el['s_' + a[0]].hidden = a[0] !== ui.aba; });
    Array.prototype.forEach.call(el.nav.querySelectorAll('button'), function (b) { var on = b.dataset.aba === ui.aba; b.classList.toggle('is-ativo', on); b.setAttribute('aria-pressed', String(on)); });
  }
  function renderTudo(forcar) {
    renderSetores(); renderAtivos(forcar); renderFuncionarios(); renderHistorico();
    el.aviso.hidden = !avisoArmazenamento; el.aviso.textContent = avisoArmazenamento || ''; renderAba();
  }

  // ------------------------------------------------------------------ backup do módulo
  function exportar() {
    recarregar();
    UI.baixarArquivo('meliops_intervalos_' + dataLocal(agora()) + '.json', NS.ModStore.exportarJson('intervalos', estado));
    UI.avisar('Backup de Intervalos exportado.', 'sucesso');
  }
  function importar(arquivo) {
    var leitor = new FileReader();
    leitor.onload = function () {
      var b = NS.ModStore.lerBackup(String(leitor.result), 'intervalos');
      if (!b.valido) { UI.avisar(b.erro, 'erro'); return; }
      var cand = Object.assign(R.padrao(), b.dados);
      var erros = R.validarDados(cand);
      if (erros.length) { UI.avisar('Backup inválido: ' + erros[0] + '. Nada foi alterado.', 'erro'); return; }
      var resumo;
      var g = mutar(function (d) {
        resumo = NS.ModStore.mesclar(d, cand, ['funcionarios', 'intervalos']);
        (cand.setores || []).forEach(function (s) { if (!d.setores.some(function (z) { return R.normalizar(z) === R.normalizar(s); })) d.setores.push(s); });
      });
      if (g) { renderTudo(true); UI.avisar('Importação concluída: ' + resumo.inseridos + ' inserido(s), ' + resumo.ignorados + ' já existiam, ' + resumo.conflitos.length + ' conflito(s) mantidos como estavam, ' + resumo.rejeitados.length + ' rejeitado(s). Nada foi apagado.', 'sucesso'); }
    };
    leitor.readAsText(arquivo);
  }

  // ------------------------------------------------------------------ montagem
  function montar() {
    var raiz = UI.limpar(document.getElementById('modulo-intervalos'));
    el.aviso = h('div', { class: 'aviso-sistema', hidden: true });
    el.nav = h('nav', { class: 'app-header__nav nav-sub', 'aria-label': 'Navegação de Intervalos' }, ABAS.map(function (a) {
      return h('button', { type: 'button', class: 'btn-nav', id: 'iv-aba-' + a[0], dataset: { aba: a[0] }, 'aria-pressed': 'false', text: a[1], onclick: function () { ui.aba = a[0]; recarregar(); renderTudo(true); } });
    }));
    raiz.appendChild(el.aviso);
    raiz.appendChild(h('section', { class: 'cartao cartao--identificacao' }, [
      h('h2', { text: 'Controle de Intervalos' }),
      h('p', { class: 'texto-apoio', text: 'Os registros ficam salvos apenas neste aparelho; ainda não há sincronização entre aparelhos.' }), el.nav]));

    // --- Ativos
    el.cTotal = h('span', { class: 'contador__valor', id: 'iv-c-total', text: '0' }); el.cPrazo = h('span', { class: 'contador__valor', id: 'iv-c-prazo', text: '0' }); el.cExc = h('span', { class: 'contador__valor', id: 'iv-c-exc', text: '0' });
    el.corpoAtivos = h('tbody', { id: 'iv-corpo-ativos' });
    el.tabelaAtivos = h('div', { class: 'tabela-rolavel' }, [h('table', { class: 'tabela-modulo tabela-interv', id: 'iv-tabela' }, [
      h('caption', { class: 'sr-only', text: 'Intervalos em andamento, vencidos primeiro' }),
      h('thead', {}, [h('tr', {}, ['Status', 'Duração', 'Primeiro nome', 'HR saída', 'HR entrada', 'Setor'].map(function (t) { return h('th', { scope: 'col', text: t }); }))]), el.corpoAtivos])]);
    el.vazioAtivos = h('p', { class: 'texto-apoio', id: 'iv-vazio', text: 'Nenhum intervalo em andamento.' });
    el.s_ativos = h('section', { id: 'interv-ativos', class: 'modulo' }, [
      h('div', { class: 'cartao' }, [
        h('div', { class: 'contadores', role: 'group', 'aria-label': 'Resumo dos intervalos em andamento' }, [
          h('div', { class: 'contador' }, [el.cTotal, h('span', { class: 'contador__rotulo', text: 'Em andamento' })]),
          h('div', { class: 'contador contador--resolvido' }, [el.cPrazo, h('span', { class: 'contador__rotulo', text: 'No prazo' })]),
          h('div', { class: 'contador contador--vermelho' }, [el.cExc, h('span', { class: 'contador__rotulo', text: 'Excedidos' })])]),
        h('button', { type: 'button', class: 'botao botao--primario btn-grande', id: 'iv-novo', text: '+ NOVO INTERVALO', onclick: abrirNovo }),
        el.vazioAtivos, el.tabelaAtivos])]);
    el.corpoAtivos.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-campo]'); if (b) abrirDetalhe(b.dataset.id, b.dataset.campo);
    });

    // --- Funcionários
    var nome = h('input', { type: 'text', id: 'fn-nome', autocomplete: 'off', placeholder: 'Nome completo' });
    var setor = h('input', { type: 'text', id: 'fn-setor', list: 'interv-setores', autocomplete: 'off', placeholder: 'Opcional' });
    var erro = h('p', { class: 'texto-aviso', role: 'alert', id: 'fn-erro' });
    el.corpoFunc = h('tbody', { id: 'fn-corpo' }); el.contFunc = h('p', { class: 'texto-apoio', id: 'fn-contagem' }); el.vazioFunc = h('p', { class: 'texto-apoio', text: 'Nenhum funcionário encontrado.' });
    var busca = h('input', { type: 'search', id: 'fn-busca', placeholder: 'Buscar por nome ou setor', 'aria-label': 'Buscar funcionário' });
    busca.addEventListener('input', function () { ui.busca = busca.value; renderFuncionarios(); });
    el.s_funcionarios = h('section', { id: 'interv-funcionarios', class: 'modulo', hidden: true }, [
      h('div', { class: 'cartao' }, [h('h3', { text: 'Cadastrar funcionário' }), h('form', { novalidate: true, id: 'fn-form', onsubmit: function (e) {
        e.preventDefault();
        var r = criarFuncionario(nome.value, setor.value);
        if (r.ok) { nome.value = ''; setor.value = ''; erro.textContent = ''; renderTudo(true); UI.avisar('Funcionário cadastrado.', 'sucesso'); }
        else if (!r.silencioso) erro.textContent = r.erro;
      } }, [h('div', { class: 'interv-duas' }, [UI.campo('Nome completo', nome), UI.campo('Setor (opcional)', setor)]), erro,
        h('button', { type: 'submit', class: 'botao botao--primario', id: 'fn-cadastrar', text: 'Cadastrar' })])]),
      h('div', { class: 'cartao' }, [h('h3', { text: 'Funcionários' }), busca, el.contFunc, el.vazioFunc,
        h('div', { class: 'tabela-rolavel' }, [h('table', { class: 'tabela-modulo' }, [h('thead', {}, [h('tr', {}, ['Nome completo', 'Setor', 'Situação', ''].map(function (t) { return h('th', { scope: 'col', text: t }); }))]), el.corpoFunc])])])]);
    el.corpoFunc.addEventListener('click', function (e) { var b = e.target.closest('button[data-acao="editar"]'); if (b) abrirEdicaoFuncionario(b.dataset.id); });

    // --- Histórico
    el.fFunc = h('select', { id: 'hs-func' }); el.fSetor = h('select', { id: 'hs-setor' }); el.fData = h('input', { type: 'date', id: 'hs-data' });
    el.fFunc.addEventListener('change', function () { ui.filtro.func = el.fFunc.value; renderHistorico(); });
    el.fSetor.addEventListener('change', function () { ui.filtro.setor = el.fSetor.value; renderHistorico(); });
    el.fData.addEventListener('change', function () { ui.filtro.data = el.fData.value; renderHistorico(); });
    el.corpoHist = h('tbody', { id: 'hs-corpo' }); el.contHist = h('p', { class: 'texto-apoio', id: 'hs-contagem' }); el.vazioHist = h('p', { class: 'texto-apoio', id: 'hs-vazio', text: 'Nenhum intervalo encerrado com estes filtros.' });
    var arq = h('input', { type: 'file', accept: 'application/json', hidden: true, id: 'iv-arquivo' });
    arq.addEventListener('change', function () { var f = arq.files && arq.files[0]; arq.value = ''; if (f) importar(f); });
    el.s_historico = h('section', { id: 'interv-historico', class: 'modulo', hidden: true }, [
      h('div', { class: 'cartao' }, [h('h3', { text: 'Histórico de intervalos' }),
        h('div', { class: 'interv-filtros' }, [UI.campo('Funcionário', el.fFunc), UI.campo('Data da saída', el.fData), UI.campo('Setor', el.fSetor),
          h('button', { type: 'button', class: 'botao botao--texto', id: 'hs-limpar', text: 'Limpar filtros', onclick: function () { ui.filtro = { func: '', data: '', setor: '*' }; renderHistorico(); } })]),
        el.contHist, el.vazioHist,
        h('div', { class: 'tabela-rolavel' }, [h('table', { class: 'tabela-modulo tabela-hist' }, [h('thead', {}, [h('tr', {}, ['Funcionário', 'Setor', 'Data', 'Saída', 'Prevista', 'Retorno previsto', 'Retorno real', 'Situação', 'Alterações'].map(function (t) { return h('th', { scope: 'col', text: t }); }))]), el.corpoHist])])]),
      h('div', { class: 'cartao' }, [h('h3', { text: 'Backup de Intervalos' }),
        h('p', { class: 'texto-apoio', text: 'Exporta funcionários e intervalos deste aparelho. Ao importar, os dados são mesclados: nada existente é apagado nem substituído, e importar o mesmo arquivo duas vezes não duplica registros.' }),
        h('div', { class: 'acoes-form' }, [h('button', { type: 'button', class: 'botao botao--secundario', id: 'iv-exportar', text: 'Exportar backup (JSON)', onclick: exportar }),
          h('button', { type: 'button', class: 'botao botao--secundario', id: 'iv-importar', text: 'Importar e mesclar (JSON)', onclick: function () { arq.click(); } }), arq])])]);
    [el.s_ativos, el.s_funcionarios, el.s_historico].forEach(function (s) { raiz.appendChild(s); });
  }

  // ------------------------------------------------------------------ relógio de tela
  function atualizarNovoSeAberto() {
    if (!novo) return;
    var c = novo.ctx, campos = novo.campos; if (!campos) return;
    if (!c.saidaEditada) { c.saidaMs = agora(); campos.saida.value = hhmm(c.saidaMs); }
    if (!c.entradaManual && !c.saidaEditada) { c.entradaMs = c.saidaMs + c.duracaoMin * MIN; campos.entrada.value = hhmm(c.entradaMs); }
  }
  function tick() {
    if (global.document.hidden || NS.Shell.moduloAtual() !== 'intervalos') return;
    if (ui.aba === 'ativos' && !detalhe) renderAtivos(false);
    atualizarNovoSeAberto();
  }

  function init() {
    recarregar(); montar(); renderTudo(true);
    store.ouvirOutrasAbas(function () { recarregar(); if (!novo && !detalhe) renderTudo(true); });
    document.addEventListener('melios:modulo', function (e) { if (e.detail.modulo === 'intervalos') { recarregar(); renderTudo(true); } });
    document.addEventListener('visibilitychange', tick);
    global.addEventListener('focus', tick); global.addEventListener('pageshow', tick);
    global.setInterval(tick, 1000);
  }
  NS.Intervalos = { recarregar: recarregar };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
