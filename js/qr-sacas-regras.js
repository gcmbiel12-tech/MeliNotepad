(function (global) {
  'use strict';
  var NS = global.MeliNotepad = global.MeliNotepad || {};

  function numeroInteiro(valor) {
    var n = Number(String(valor).trim());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }

  function parsearSelecao(texto) {
    var bruto = String(texto || '').trim();
    if (!bruto) return { valido: false, erro: 'Informe ao menos um número ou intervalo.' };
    var partes = bruto.split(',');
    var numeros = [];
    var vistos = Object.create(null);
    for (var i = 0; i < partes.length; i++) {
      var item = partes[i].trim();
      if (!item) return { valido: false, erro: 'Há um item vazio na seleção.' };
      var faixa = item.match(/^(\d+)\s*-\s*(\d+)$/);
      if (faixa) {
        var inicio = numeroInteiro(faixa[1]);
        var fim = numeroInteiro(faixa[2]);
        if (!inicio || !fim || fim < inicio) return { valido: false, erro: 'Intervalo inválido: ' + item + '.' };
        if (fim - inicio > 5000 || numeros.length + (fim - inicio + 1) > 5000) {
          return { valido: false, erro: 'A seleção excede o limite de 5.000 sacas.' };
        }
        for (var n = inicio; n <= fim; n++) {
          if (!vistos[n]) { vistos[n] = true; numeros.push(n); }
        }
      } else {
        var unico = numeroInteiro(item);
        if (!unico) return { valido: false, erro: 'Número ou intervalo inválido: ' + item + '.' };
        if (!vistos[unico]) { vistos[unico] = true; numeros.push(unico); }
      }
      if (numeros.length > 5000) return { valido: false, erro: 'A seleção excede o limite de 5.000 sacas.' };
    }
    return { valido: true, numeros: numeros };
  }

  function interpretarPayload(bruto) {
    var objeto;
    try { objeto = typeof bruto === 'string' ? JSON.parse(bruto) : bruto; }
    catch (e) { return { valido: false, erro: 'O conteúdo do QR Code não é um JSON válido.' }; }
    if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
      return { valido: false, erro: 'O QR Code não contém um objeto JSON.' };
    }
    if (objeto.container_id === undefined || objeto.container_id === null || String(objeto.container_id).trim() === '') {
      return { valido: false, erro: 'O QR Code não contém container_id.' };
    }
    if (typeof objeto.facility_id !== 'string' || !objeto.facility_id.trim()) {
      return { valido: false, erro: 'O QR Code não contém facility_id.' };
    }
    if (objeto.assignment === undefined || objeto.assignment === null || !numeroInteiro(objeto.assignment)) {
      return { valido: false, erro: 'O QR Code não contém um assignment numérico válido.' };
    }
    return { valido: true, payload: {
      container_id: objeto.container_id,
      facility_id: objeto.facility_id,
      assignment: String(numeroInteiro(objeto.assignment))
    } };
  }

  function ajustarSequencia(sacas, indice, novoNumero) {
    if (!Array.isArray(sacas) || indice < 0 || indice >= sacas.length) {
      return { valido: false, erro: 'Saca não encontrada para edição.' };
    }
    var novo = numeroInteiro(novoNumero);
    if (!novo) return { valido: false, erro: 'Informe um número inteiro positivo.' };
    var atual = numeroInteiro(sacas[indice].numero);
    if (!atual) return { valido: false, erro: 'A numeração atual da saca é inválida.' };
    var delta = novo - atual;
    var copia = sacas.map(function (s, i) {
      var numero = numeroInteiro(s.numero);
      var atualizado = i >= indice ? numero + delta : numero;
      return Object.assign({}, s, {
        numero: String(atualizado),
        payload: s.payload ? Object.assign({}, s.payload, i >= indice ? { assignment: String(atualizado) } : {}) : null
      });
    });
    var usados = Object.create(null);
    for (var i = 0; i < copia.length; i++) {
      var chave = copia[i].numero;
      if (usados[chave]) return { valido: false, erro: 'A alteração criaria números duplicados nesta rota (' + chave + ').' };
      usados[chave] = true;
    }
    return { valido: true, sacas: copia };
  }

  NS.QRSacasRegras = {
    numeroInteiro: numeroInteiro,
    parsearSelecao: parsearSelecao,
    interpretarPayload: interpretarPayload,
    ajustarSequencia: ajustarSequencia
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NS.QRSacasRegras;
})(typeof window !== 'undefined' ? window : globalThis);
