/**
 * intervalos-regras.js
 * Regras do Controle de Intervalos — funções puras (sem DOM nem armazenamento),
 * para poderem ser testadas com precisão. O tempo é sempre calculado a partir de
 * horários gravados + o "agora" recebido, nunca de um contador em memória.
 */
(function (global) {
  'use strict';
  var NS = global.MeliNotepad = global.MeliNotepad || {};

  var DURACAO_PADRAO_MIN = 60;
  var DURACAO_MAX_MIN = 1440;
  var MIN = 60000;

  // ------------------------------------------------------------ nomes e setores
  function limpar(t) { return String(t == null ? '' : t).trim().replace(/\s+/g, ' '); }
  function normalizar(t) {
    return limpar(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function primeiroNome(nome) { return limpar(nome).split(' ')[0] || ''; }

  /** Cadastro já existente com o MESMO nome completo (sem distinguir acento, caixa ou espaços). */
  function buscarDuplicado(funcionarios, nome, ignorarId) {
    var alvo = normalizar(nome);
    for (var i = 0; i < funcionarios.length; i++) {
      var f = funcionarios[i];
      if (f.id !== ignorarId && normalizar(f.nome) === alvo) return f;
    }
    return null;
  }

  /** Outros cadastros com o mesmo primeiro nome (homônimos parciais). */
  function homonimos(funcionarios, funcionario) {
    var p = normalizar(primeiroNome(funcionario.nome));
    return funcionarios.filter(function (f) { return f.id !== funcionario.id && normalizar(primeiroNome(f.nome)) === p; });
  }

  /** Texto para escolher um funcionário: nome completo + setor (distingue homônimos). */
  function rotuloFuncionario(f) { return f.nome + (f.setor ? ' · ' + f.setor : ''); }

  /** Reaproveita a grafia de um setor já existente (sem distinguir caixa/acento); '' = sem setor. */
  function normalizarSetor(texto, setores) {
    var t = limpar(texto);
    if (!t) return '';
    var alvo = normalizar(t);
    for (var i = 0; i < (setores || []).length; i++) if (normalizar(setores[i]) === alvo) return setores[i];
    return t;
  }

  // ------------------------------------------------------------ tempo e estado
  function validarDuracao(v) {
    var n = Number(v);
    if (v === '' || v === null || v === undefined || !Number.isInteger(n) || n < 1 || n > DURACAO_MAX_MIN) {
      return { ok: false, erro: 'Informe a duração em minutos, inteira, de 1 a ' + DURACAO_MAX_MIN + '.' };
    }
    return { ok: true, valor: n };
  }

  /** Estado de um intervalo no instante agoraMs (ativo: até agora; encerrado: até o retorno real). */
  function avaliar(i, agoraMs) {
    var saida = Date.parse(i.saidaAt);
    var fim = i.retornoRealAt ? Date.parse(i.retornoRealAt) : agoraMs;
    var decorridoMs = Math.max(0, fim - saida);
    var minutos = Math.floor(decorridoMs / MIN);            // o que a tela mostra
    var limite = i.duracaoPrevistaMin;
    return {
      decorridoMs: decorridoMs, minutos: minutos, limite: limite,
      excedido: minutos > limite,                            // 60 min = verde; 61 min = vermelho
      atrasoMs: decorridoMs - limite * MIN,
      restanteMs: limite * MIN - decorridoMs
    };
  }

  function rotuloEstado(av) {
    return av.excedido ? 'Excedido há ' + (av.minutos - av.limite) + ' min' : 'No prazo';
  }

  /** Vencidos primeiro (maior atraso -> menor); depois os dentro do limite (mais perto de vencer -> mais longe). */
  function ordenar(ativos, agoraMs) {
    var itens = ativos.map(function (i) { return { i: i, av: avaliar(i, agoraMs) }; });
    itens.sort(function (a, b) {
      if (a.av.excedido !== b.av.excedido) return a.av.excedido ? -1 : 1;
      var d = a.av.excedido ? b.av.atrasoMs - a.av.atrasoMs : a.av.restanteMs - b.av.restanteMs;
      if (d !== 0) return d;
      var s = Date.parse(a.i.saidaAt) - Date.parse(b.i.saidaAt);   // desempate estável: saída mais antiga
      if (s !== 0) return s;
      return a.i.id < b.i.id ? -1 : a.i.id > b.i.id ? 1 : 0;
    });
    return itens;
  }

  // ------------------------------------------------------------ horários HH:MM
  function lerHHMM(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    return h > 23 || mi > 59 ? null : { h: h, m: mi };
  }

  /** HR saída digitada: hoje nesse horário; se ficaria no futuro, é o dia anterior (virada de dia). */
  function resolverSaida(hhmm, agoraMs) {
    var p = lerHHMM(hhmm); if (!p) return { ok: false, erro: 'Horário de saída inválido.' };
    var d = new Date(agoraMs); d.setHours(p.h, p.m, 0, 0);
    if (d.getTime() > agoraMs + MIN) d.setDate(d.getDate() - 1);
    return { ok: true, ms: d.getTime() };
  }

  /** HR entrada digitada: depois da saída; se o horário for menor, cruza a meia-noite. */
  function resolverEntrada(hhmm, saidaMs) {
    var p = lerHHMM(hhmm); if (!p) return { ok: false, erro: 'Horário de entrada inválido.' };
    var saidaMin = Math.floor(saidaMs / MIN) * MIN;
    var d = new Date(saidaMs); d.setHours(p.h, p.m, 0, 0);
    if (d.getTime() === saidaMin) return { ok: false, erro: 'A HR entrada precisa ser depois da HR saída.' };
    if (d.getTime() < saidaMin) d.setDate(d.getDate() + 1);
    return { ok: true, ms: d.getTime() };
  }

  /**
   * Mantém duração / saída / entrada coerentes depois de uma edição:
   *  - duração ou saída mudaram -> entrada = saída + duração
   *  - entrada mudou           -> duração = entrada - saída (o horário digitado é respeitado)
   */
  function recalcular(t, campo) {
    var r = { saidaMs: t.saidaMs, duracaoMin: t.duracaoMin, entradaMs: t.entradaMs };
    if (campo === 'entrada') {
      var min = Math.round((t.entradaMs - t.saidaMs) / MIN);
      if (!(min >= 1)) return { ok: false, erro: 'A HR entrada precisa ser depois da HR saída.' };
      if (min > DURACAO_MAX_MIN) return { ok: false, erro: 'A duração não pode passar de ' + DURACAO_MAX_MIN + ' minutos.' };
      r.duracaoMin = min;
    } else {
      r.entradaMs = t.saidaMs + t.duracaoMin * MIN;
    }
    r.ok = true; return r;
  }

  // ------------------------------------------------------------ registros
  function novoId(prefixo) {
    var U = NS.Utils;
    return U && U.gerarId ? U.gerarId(prefixo) : prefixo + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function iso(ms) { return new Date(ms).toISOString(); }

  function novoFuncionario(nome, setor, agoraMs) {
    return { id: novoId('fun'), nome: limpar(nome), setor: limpar(setor), ativo: true, criadoEm: iso(agoraMs), atualizadoEm: iso(agoraMs) };
  }

  /** Cria o registro NA CONFIRMAÇÃO: `liberadoEm` é o instante real e nunca muda. */
  function novoIntervalo(o) {
    var d = validarDuracao(o.duracaoMin); if (!d.ok) return d;
    if (!o.funcionario) return { ok: false, erro: 'Selecione o funcionário.' };
    var saidaMs = o.saidaMs;
    if (saidaMs > o.agoraMs + MIN) return { ok: false, erro: 'A HR saída não pode estar no futuro.' };
    return {
      ok: true,
      intervalo: {
        id: novoId('int'), funcionarioId: o.funcionario.id, funcionarioNome: o.funcionario.nome,
        setor: limpar(o.setor), liberadoEm: iso(o.agoraMs), saidaAt: iso(saidaMs),
        duracaoPrevistaMin: d.valor, retornoPrevistoAt: iso(o.entradaMs != null ? o.entradaMs : saidaMs + d.valor * MIN),
        retornoRealAt: null, status: 'ativo', alteracoes: []
      }
    };
  }

  /** Aplica novos valores de duração/saída/entrada registrando cada mudança no histórico do intervalo. */
  function editarIntervalo(i, t, agoraMs) {
    var d = validarDuracao(t.duracaoMin); if (!d.ok) return d;
    if (t.saidaMs > agoraMs + MIN) return { ok: false, erro: 'A HR saída não pode estar no futuro.' };
    if (!(t.entradaMs > t.saidaMs)) return { ok: false, erro: 'A HR entrada precisa ser depois da HR saída.' };
    var novo = JSON.parse(JSON.stringify(i)), em = iso(agoraMs);
    var pares = [['duracaoPrevistaMin', i.duracaoPrevistaMin, d.valor], ['saidaAt', i.saidaAt, iso(t.saidaMs)], ['retornoPrevistoAt', i.retornoPrevistoAt, iso(t.entradaMs)]];
    pares.forEach(function (p) {
      if (p[1] !== p[2]) { novo.alteracoes.push({ em: em, campo: p[0], de: p[1], para: p[2] }); novo[p[0]] = p[2]; }
    });
    return { ok: true, intervalo: novo, mudou: novo.alteracoes.length !== i.alteracoes.length };
  }

  function registrarRetorno(i, agoraMs) {
    if (i.status !== 'ativo') return { ok: false, erro: 'Este intervalo já foi encerrado.' };
    var novo = JSON.parse(JSON.stringify(i));
    novo.retornoRealAt = iso(Math.max(agoraMs, Date.parse(i.saidaAt)));
    novo.status = 'encerrado';
    return { ok: true, intervalo: novo };
  }

  function intervalosAtivosDe(dados, funcionarioId) {
    return dados.intervalos.filter(function (i) { return i.status === 'ativo' && i.funcionarioId === funcionarioId; });
  }

  // ------------------------------------------------------------ dados do módulo
  function padrao() { return { versao: 1, rev: 0, funcionarios: [], intervalos: [], setores: ['NEX', 'XPT'] }; }

  function validarDados(d) {
    var e = [];
    if (!d || typeof d !== 'object') return ['dados ausentes'];
    if (!Array.isArray(d.funcionarios)) e.push('funcionarios não é lista');
    if (!Array.isArray(d.intervalos)) e.push('intervalos não é lista');
    if (!Array.isArray(d.setores)) e.push('setores não é lista');
    if (e.length) return e;
    var ids = {};
    d.funcionarios.forEach(function (f, k) {
      if (!f || typeof f.id !== 'string' || !f.id) e.push('funcionarios[' + k + '].id inválido');
      else if (ids[f.id]) e.push('id repetido: ' + f.id); else ids[f.id] = 1;
      if (!f || typeof f.nome !== 'string' || !limpar(f.nome)) e.push('funcionarios[' + k + '].nome inválido');
    });
    d.intervalos.forEach(function (i, k) {
      var p = 'intervalos[' + k + ']';
      if (!i || typeof i.id !== 'string' || !i.id) { e.push(p + '.id inválido'); return; }
      if (ids[i.id]) e.push('id repetido: ' + i.id); else ids[i.id] = 1;
      if (typeof i.funcionarioId !== 'string') e.push(p + '.funcionarioId inválido');
      if (isNaN(Date.parse(i.saidaAt))) e.push(p + '.saidaAt inválido');
      if (!Number.isInteger(i.duracaoPrevistaMin) || i.duracaoPrevistaMin < 1) e.push(p + '.duracaoPrevistaMin inválida');
      if (i.status !== 'ativo' && i.status !== 'encerrado') e.push(p + '.status inválido');
      if (i.status === 'encerrado' && isNaN(Date.parse(i.retornoRealAt))) e.push(p + '.retornoRealAt inválido');
      if (!Array.isArray(i.alteracoes)) e.push(p + '.alteracoes inválido');
    });
    return e;
  }

  NS.IntervalosRegras = {
    DURACAO_PADRAO_MIN: DURACAO_PADRAO_MIN, DURACAO_MAX_MIN: DURACAO_MAX_MIN,
    limpar: limpar, normalizar: normalizar, primeiroNome: primeiroNome, buscarDuplicado: buscarDuplicado,
    homonimos: homonimos, rotuloFuncionario: rotuloFuncionario, normalizarSetor: normalizarSetor,
    validarDuracao: validarDuracao, avaliar: avaliar, rotuloEstado: rotuloEstado, ordenar: ordenar,
    resolverSaida: resolverSaida, resolverEntrada: resolverEntrada, recalcular: recalcular,
    novoFuncionario: novoFuncionario, novoIntervalo: novoIntervalo, editarIntervalo: editarIntervalo,
    registrarRetorno: registrarRetorno, intervalosAtivosDe: intervalosAtivosDe, padrao: padrao, validarDados: validarDados
  };
})(window);
