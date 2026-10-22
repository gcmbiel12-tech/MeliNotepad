/**
 * utils.js
 * Funções utilitárias puras (sem efeitos colaterais de DOM ou armazenamento).
 * Formatação de data/hora/número segue o padrão brasileiro (pt-BR).
 */
(function (global) {
  'use strict';

  /**
   * Gera um identificador único e razoavelmente curto.
   * Usa crypto.randomUUID() quando disponível (contexto seguro / navegador atual);
   * caso contrário, recorre a um gerador baseado em timestamp + aleatoriedade.
   */
  function gerarId(prefixo) {
    var p = prefixo ? prefixo + '_' : '';
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return p + global.crypto.randomUUID();
    }
    var parte1 = Date.now().toString(36);
    var parte2 = Math.random().toString(36).slice(2, 10);
    var parte3 = Math.random().toString(36).slice(2, 6);
    return p + parte1 + '-' + parte2 + parte3;
  }

  /** Retorna o Date atual. Isolado em função própria para facilitar testes futuros. */
  function agora() {
    return new Date();
  }

  function doisDigitos(n) {
    return n < 10 ? '0' + n : String(n);
  }

  var FUSO_OPERACIONAL = 'America/Sao_Paulo';
  function partesNoFuso(dataOuIso) {
    var d = dataOuIso instanceof Date ? dataOuIso : new Date(dataOuIso);
    if (isNaN(d.getTime())) return null;
    var partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO_OPERACIONAL, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(d);
    var r = {};
    partes.forEach(function (p) { if (p.type !== 'literal') r[p.type] = p.value; });
    return r;
  }

  /** Data de calendário no fuso operacional, sem deslocamentos fixos de UTC. */
  function dataOperacional(dataOuIso) {
    var p = partesNoFuso(dataOuIso);
    return p ? p.year + '-' + p.month + '-' + p.day : '';
  }

  function formatarDataOperacional(dataOuIso) {
    var data = dataOperacional(dataOuIso);
    return data ? data.slice(8, 10) + '/' + data.slice(5, 7) + '/' + data.slice(0, 4) : '--/--/----';
  }

  function formatarHoraOperacional(dataOuIso) {
    var p = partesNoFuso(dataOuIso);
    return p ? p.hour + ':' + p.minute : '--:--';
  }

  function formatarDataHoraOperacional(dataOuIso) {
    return formatarDataOperacional(dataOuIso) + ' ' + formatarHoraOperacional(dataOuIso);
  }

  function deslocarDataOperacional(data, dias) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return '';
    var p = data.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + dias));
    return d.getUTCFullYear() + '-' + doisDigitos(d.getUTCMonth() + 1) + '-' + doisDigitos(d.getUTCDate());
  }

  function dataHojeOperacional(agora) { return dataOperacional(agora || new Date()); }

  /** Datas ISO de calendário são comparadas inclusivamente; registros não são alterados. */
  function dentroDoPeriodoOperacional(instante, inicio, fim, agora) {
    var data = dataOperacional(instante);
    if (!data) return false;
    var min = inicio || '', max = fim || '';
    if (inicio === 'hoje') min = max = dataHojeOperacional(agora);
    if (inicio === 'ontem') min = max = deslocarDataOperacional(dataHojeOperacional(agora), -1);
    return (!min || data >= min) && (!max || data <= max);
  }

  /** Consulta imutável de histórico; ordena pelo instante operacional fornecido. */
  function consultarHistorico(registros, opcoes) {
    var o = opcoes || {}, periodo = o.periodo || 'todos';
    var inicio = periodo === 'hoje' ? 'hoje' : periodo === 'ontem' ? 'ontem' : periodo === 'data' ? o.data : periodo === 'intervalo' ? o.inicio : '';
    var fim = periodo === 'data' ? o.data : periodo === 'intervalo' ? o.fim : '';
    var busca = String(o.busca || '').trim().toLocaleLowerCase('pt-BR');
    if ((periodo === 'data' && !inicio) || (periodo === 'intervalo' && (!inicio || !fim || inicio > fim))) return [];
    return (registros || []).filter(function (r) {
      var instante = r && r[o.campoData || 'startTime'];
      if (inicio && !dentroDoPeriodoOperacional(instante, inicio, fim, o.agora)) return false;
      return !busca || String((o.buscar && o.buscar(r)) || '').toLocaleLowerCase('pt-BR').indexOf(busca) !== -1;
    }).slice().sort(function (a, b) {
      return new Date(b[o.campoData || 'startTime']) - new Date(a[o.campoData || 'startTime']) || String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  /** Formata um Date (ou ISO string) como DD/MM/AAAA. */
  function formatarData(dataOuIso) {
    var d = dataOuIso instanceof Date ? dataOuIso : new Date(dataOuIso);
    if (isNaN(d.getTime())) return '--/--/----';
    return doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  /** Formata um Date (ou ISO string) como HH:MM, sempre em 24 horas. */
  function formatarHora(dataOuIso) {
    var d = dataOuIso instanceof Date ? dataOuIso : new Date(dataOuIso);
    if (isNaN(d.getTime())) return '--:--';
    return doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
  }

  /** Formata um Date (ou ISO string) como DD/MM/AAAA HH:MM. */
  function formatarDataHora(dataOuIso) {
    return formatarData(dataOuIso) + ' ' + formatarHora(dataOuIso);
  }

  /** Formata um Date (ou ISO string) como DD/MM (sem ano), usado no resumo curto do relatório. */
  function formatarDataCurta(dataOuIso) {
    var d = dataOuIso instanceof Date ? dataOuIso : new Date(dataOuIso);
    if (isNaN(d.getTime())) return '--/--';
    return doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1);
  }

  /** Formata um inteiro no padrão brasileiro (ex.: 7007 -> "7.007"). */
  function formatarNumeroBR(valor) {
    var n = Number(valor);
    if (!isFinite(n)) return '0';
    try {
      return n.toLocaleString('pt-BR');
    } catch (e) {
      // Fallback manual caso toLocaleString não tenha suporte a pt-BR no ambiente.
      var s = String(Math.trunc(n));
      var negativo = s.charAt(0) === '-';
      if (negativo) s = s.slice(1);
      var resultado = '';
      for (var i = 0; i < s.length; i++) {
        var posicaoDaDireita = s.length - i;
        resultado += s.charAt(i);
        if (posicaoDaDireita > 1 && posicaoDaDireita % 3 === 1) resultado += '.';
      }
      return (negativo ? '-' : '') + resultado;
    }
  }

  /**
   * Saudação baseada no horário local do dispositivo.
   * Se, por qualquer motivo, o horário não puder ser determinado,
   * retorna uma saudação neutra em vez de falhar ou inventar um horário.
   */
  function saudacaoPorHorario(data) {
    try {
      var d = data instanceof Date ? data : new Date(data);
      if (isNaN(d.getTime())) return 'Olá!';
      var h = d.getHours();
      if (h >= 5 && h < 12) return 'Bom dia!!!';
      if (h >= 12 && h < 18) return 'Boa tarde!!!';
      return 'Boa noite!!!';
    } catch (e) {
      return 'Olá!';
    }
  }

  /** Emoji que acompanha a saudação no resumo estilo WhatsApp, pelo mesmo critério de horário. */
  function emojiPorHorario(data) {
    try {
      var d = data instanceof Date ? data : new Date(data);
      if (isNaN(d.getTime())) return '👋';
      var h = d.getHours();
      if (h >= 5 && h < 12) return '🌅';
      if (h >= 12 && h < 18) return '☀️';
      return '🌙';
    } catch (e) {
      return '👋';
    }
  }

  /** Formata um Date como valor aceito por <input type="datetime-local"> (hora LOCAL, não UTC). */
  function paraDatetimeLocal(data) {
    var d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) d = new Date();
    return d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate()) +
      'T' + doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
  }


  /**
   * Interpreta o conteúdo bruto lido de um QR Code / código de barras.
   * - Conteúdo com cara de JSON ({, [ ou "): extrai SOMENTE o campo "id"
   *   (ex.: {"id":"48197332782","t":"lm"} -> "48197332782").
   * - Qualquer outro texto (número simples, alfanumérico): é o próprio código.
   * O identificador é sempre devolvido como TEXTO (zeros à esquerda preservados).
   * Retorna { ok:true, id, origem:'json'|'direto' } ou { ok:false, motivo }.
   */
  function extrairIdentificadorDeCodigo(bruto) {
    if (typeof bruto !== 'string') return { ok: false, motivo: 'Conteúdo vazio.' };
    var texto = bruto.trim();
    if (!texto) return { ok: false, motivo: 'Conteúdo vazio.' };

    function idValido(valor) {
      if (typeof valor === 'number') {
        // Número JSON: só inteiros seguros (zeros à esquerda só existem em texto).
        return Number.isSafeInteger(valor) && valor >= 0 ? String(valor) : null;
      }
      if (typeof valor !== 'string') return null;
      var t = valor.trim();
      if (!t || t.length > 128 || /[\u0000-\u001f\u007f]/.test(t)) return null;
      return t;
    }

    var primeiro = texto.charAt(0);
    if (primeiro === '{' || primeiro === '[' || primeiro === '"') {
      var obj;
      try { obj = JSON.parse(texto); } catch (e) {
        return { ok: false, motivo: 'O conteúdo parece JSON, mas é inválido.' };
      }
      var candidato = (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj.id : obj;
      if (candidato !== null && typeof candidato === 'object') candidato = undefined;
      var id = idValido(candidato);
      if (id === null) return { ok: false, motivo: 'O conteúdo não traz um "id" válido.' };
      return { ok: true, id: id, origem: 'json' };
    }

    var direto = idValido(texto);
    if (direto === null) return { ok: false, motivo: 'O código contém caracteres inválidos ou é longo demais.' };
    return { ok: true, id: direto, origem: 'direto' };
  }

  /** Valida se um valor é um inteiro não negativo (aceita string numérica). */
  function ehInteiroNaoNegativo(valor) {
    if (valor === '' || valor === null || valor === undefined) return false;
    var n = Number(valor);
    return Number.isInteger(n) && n >= 0;
  }

  /** Remove espaços nas extremidades e colapsa espaços internos repetidos. */
  function normalizarTexto(texto) {
    if (typeof texto !== 'string') return '';
    return texto.trim().replace(/\s+/g, ' ');
  }

  /**
   * Normaliza um código de pacote para comparação (não para exibição/armazenamento):
   * remove espaços nas pontas e ignora maiúsculas/minúsculas,
   * já que o código é tratado sempre como texto.
   */
  function normalizarCodigoParaComparacao(codigo) {
    return normalizarTexto(codigo).toUpperCase();
  }

  global.MeliNotepad = global.MeliNotepad || {};
  global.MeliNotepad.Utils = {
    gerarId: gerarId,
    agora: agora,
    formatarData: formatarData,
    dataOperacional: dataOperacional,
    dataHojeOperacional: dataHojeOperacional,
    deslocarDataOperacional: deslocarDataOperacional,
    dentroDoPeriodoOperacional: dentroDoPeriodoOperacional,
    consultarHistorico: consultarHistorico,
    formatarDataOperacional: formatarDataOperacional,
    formatarHoraOperacional: formatarHoraOperacional,
    formatarDataHoraOperacional: formatarDataHoraOperacional,
    formatarHora: formatarHora,
    formatarDataHora: formatarDataHora,
    formatarDataCurta: formatarDataCurta,
    formatarNumeroBR: formatarNumeroBR,
    saudacaoPorHorario: saudacaoPorHorario,
    emojiPorHorario: emojiPorHorario,
    paraDatetimeLocal: paraDatetimeLocal,
    ehInteiroNaoNegativo: ehInteiroNaoNegativo,
    extrairIdentificadorDeCodigo: extrairIdentificadorDeCodigo,
    normalizarTexto: normalizarTexto,
    normalizarCodigoParaComparacao: normalizarCodigoParaComparacao
  };
})(window);
