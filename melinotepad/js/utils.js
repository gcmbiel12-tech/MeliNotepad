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
    formatarHora: formatarHora,
    formatarDataHora: formatarDataHora,
    formatarDataCurta: formatarDataCurta,
    formatarNumeroBR: formatarNumeroBR,
    saudacaoPorHorario: saudacaoPorHorario,
    emojiPorHorario: emojiPorHorario,
    paraDatetimeLocal: paraDatetimeLocal,
    ehInteiroNaoNegativo: ehInteiroNaoNegativo,
    normalizarTexto: normalizarTexto,
    normalizarCodigoParaComparacao: normalizarCodigoParaComparacao
  };
})(window);
