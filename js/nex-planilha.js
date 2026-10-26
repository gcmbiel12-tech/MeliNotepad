/**
 * nex-planilha.js
 * Leitura e validação da planilha Optimization usada para preparar o NEX.
 * Não grava dados: retorna somente rotas HYBRID validadas e seus totais.
 */
(function (global) {
  'use strict';

  function normalizarCabecalho(valor) {
    return String(valor == null ? '' : valor)
      .replace(/^\uFEFF/, '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]/g, '');
  }

  function textoCelula(valor) {
    return String(valor == null ? '' : valor).trim();
  }

  function inteiroNaoNegativo(valor, coluna, linha) {
    if (typeof valor === 'number') {
      if (Number.isSafeInteger(valor) && valor >= 0) return valor;
      throw new Error('A coluna "' + coluna + '" tem um valor inválido na linha ' + linha + '.');
    }
    var texto = textoCelula(valor);
    if (!texto) throw new Error('A coluna "' + coluna + '" está vazia na linha ' + linha + '.');
    texto = texto.replace(/\s/g, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(texto)) texto = texto.replace(/\./g, '');
    else if (/^\d{1,3}(,\d{3})+$/.test(texto)) texto = texto.replace(/,/g, '');
    if (!/^\d+$/.test(texto)) {
      throw new Error('A coluna "' + coluna + '" deve conter um número inteiro não negativo (linha ' + linha + ').');
    }
    var numero = Number(texto);
    if (!Number.isSafeInteger(numero)) throw new Error('Valor muito grande na coluna "' + coluna + '" (linha ' + linha + ').');
    return numero;
  }

  function interpretarMatriz(matriz) {
    if (!Array.isArray(matriz) || matriz.length < 2) {
      throw new Error('A planilha não contém cabeçalho e linhas de dados.');
    }

    var cabecalhos = matriz[0].map(normalizarCabecalho);
    function coluna(nome) { return cabecalhos.indexOf(normalizarCabecalho(nome)); }
    var idxServico = coluna('Tipos de serviços');
    var idxRota = coluna('ID Otimizado');
    var idxSacas = coluna('Quantidade de sacas');
    var idxPacotes = coluna('Pacotes estimados');
    var faltando = [];
    if (idxServico < 0) faltando.push('Tipos de serviços');
    if (idxRota < 0) faltando.push('ID Otimizado');
    if (idxSacas < 0) faltando.push('Quantidade de sacas');
    if (idxPacotes < 0) faltando.push('Pacotes estimados');
    if (faltando.length) throw new Error('Não encontrei as colunas obrigatórias: ' + faltando.join(', ') + '.');

    var rotas = [];
    var vistas = Object.create(null);
    var totalSacas = 0;
    var totalPacotes = 0;
    var linhasHybrid = 0;

    for (var i = 1; i < matriz.length; i++) {
      var linha = matriz[i] || [];
      if (!linha.some(function (v) { return textoCelula(v) !== ''; })) continue;
      var servico = textoCelula(linha[idxServico]);
      if (!/(^|\W)HYBRID(\W|$)/i.test(servico)) continue;
      linhasHybrid++;

      var idOtimizado = textoCelula(linha[idxRota]);
      if (!idOtimizado) throw new Error('A linha ' + (i + 1) + ' tem serviço HYBRID, mas está sem ID Otimizado.');
      var rota = idOtimizado.replace(/_AM1$/i, '').trim();
      if (!rota) throw new Error('Não foi possível identificar a rota na linha ' + (i + 1) + '.');
      var chaveRota = rota.toLocaleUpperCase('pt-BR');
      if (vistas[chaveRota]) {
        throw new Error('A rota "' + rota + '" aparece mais de uma vez nas linhas HYBRID (' + vistas[chaveRota] + ' e ' + (i + 1) + '). Confira a planilha antes de importar.');
      }
      vistas[chaveRota] = i + 1;

      var sacas = inteiroNaoNegativo(linha[idxSacas], 'Quantidade de sacas', i + 1);
      var pacotes = inteiroNaoNegativo(linha[idxPacotes], 'Pacotes estimados', i + 1);
      totalSacas += sacas;
      totalPacotes += pacotes;
      if (!Number.isSafeInteger(totalSacas) || !Number.isSafeInteger(totalPacotes)) {
        throw new Error('Os totais calculados ultrapassam o limite numérico seguro.');
      }
      rotas.push({ rota: rota, idOtimizado: idOtimizado, servico: servico, sacas: sacas, pacotes: pacotes });
    }

    if (!linhasHybrid || !rotas.length) {
      throw new Error('Não encontrei linhas com serviço HYBRID nesta planilha.');
    }
    return { rotas: rotas, totalSacas: totalSacas, totalPacotes: totalPacotes, linhasHybrid: linhasHybrid };
  }

  function analisarCSV(texto) {
    texto = String(texto || '').replace(/^\uFEFF/, '');
    var primeiraLinha = (texto.split(/\r?\n/, 1)[0] || '');
    var delimitadores = [',', ';', '\t'];
    var delimitador = delimitadores.map(function (d) {
      var n = 0, aspas = false;
      for (var i = 0; i < primeiraLinha.length; i++) {
        if (primeiraLinha[i] === '"') {
          if (aspas && primeiraLinha[i + 1] === '"') i++;
          else aspas = !aspas;
        } else if (!aspas && primeiraLinha[i] === d) n++;
      }
      return { d: d, n: n };
    }).sort(function (a, b) { return b.n - a.n; })[0].d;

    var linhas = [], linha = [], celula = '', aspas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (c === '"') {
        if (aspas && texto[i + 1] === '"') { celula += '"'; i++; }
        else aspas = !aspas;
      } else if (!aspas && c === delimitador) {
        linha.push(celula); celula = '';
      } else if (!aspas && (c === '\n' || c === '\r')) {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        linha.push(celula); linhas.push(linha); linha = []; celula = '';
      } else {
        celula += c;
      }
    }
    if (celula.length || linha.length) { linha.push(celula); linhas.push(linha); }
    return interpretarMatriz(linhas);
  }

  function analisarArquivo(arquivo) {
    var extensao = String(arquivo && arquivo.name || '').split('.').pop().toLowerCase();
    if (extensao === 'csv') {
      return arquivo.text().then(analisarCSV);
    }
    if (extensao === 'xlsx') {
      if (!global.XLSX) return Promise.reject(new Error('O leitor de Excel não foi carregado. Atualize a página e tente novamente.'));
      return arquivo.arrayBuffer().then(function (dados) {
        var workbook = global.XLSX.read(dados, { type: 'array', cellDates: false });
        var nome = workbook.SheetNames && workbook.SheetNames[0];
        if (!nome) throw new Error('O arquivo Excel não contém uma planilha.');
        var matriz = global.XLSX.utils.sheet_to_json(workbook.Sheets[nome], { header: 1, defval: '', raw: true });
        return interpretarMatriz(matriz);
      });
    }
    return Promise.reject(new Error('Formato não suportado. Selecione um arquivo .xlsx ou .csv.'));
  }

  global.MeliNotepad = global.MeliNotepad || {};
  global.MeliNotepad.NexPlanilha = {
    interpretarMatriz: interpretarMatriz,
    analisarCSV: analisarCSV,
    analisarArquivo: analisarArquivo
  };
})(window);
