/**
 * storage.js
 * Única camada do aplicativo que conhece o LocalStorage.
 * A interface (app.js) nunca deve chamar localStorage diretamente:
 * sempre passa por salvarDados()/carregarDados() daqui.
 */
(function (global) {
  'use strict';

  var C = global.MeliNotepad.Constants;

  function estruturaVazia() {
    return {
      versao: C.DATA_VERSION,
      currentSession: null,
      history: []
    };
  }

  // ---------------------------------------------------------------------
  // Validação
  // ---------------------------------------------------------------------

  var CATEGORIA_KEYS = C.CATEGORIES.map(function (c) { return c.key; });
  var STATUS_VALIDOS = [C.STATUS.PENDENTE, C.STATUS.RESOLVIDO];
  var SESSION_STATUS_VALIDOS = [C.SESSION_STATUS.EM_ANDAMENTO, C.SESSION_STATUS.FINALIZADA];

  function erro(lista, msg) {
    lista.push(msg);
    return lista;
  }

  function validarOcorrencia(o, erros, caminho) {
    if (!o || typeof o !== 'object') {
      erro(erros, caminho + ': ocorrência inválida (não é objeto)');
      return;
    }
    if (typeof o.id !== 'string' || !o.id) erro(erros, caminho + '.id inválido');
    if (typeof o.code !== 'string' || !o.code) erro(erros, caminho + '.code inválido');
    if (CATEGORIA_KEYS.indexOf(o.category) === -1) erro(erros, caminho + '.category inválida: ' + o.category);
    if (STATUS_VALIDOS.indexOf(o.status) === -1) erro(erros, caminho + '.status inválido: ' + o.status);
    if (typeof o.createdAt !== 'string' || isNaN(new Date(o.createdAt).getTime())) erro(erros, caminho + '.createdAt inválido');
    if (typeof o.updatedAt !== 'string' || isNaN(new Date(o.updatedAt).getTime())) erro(erros, caminho + '.updatedAt inválido');
    if (o.note !== undefined && o.note !== null && typeof o.note !== 'string') erro(erros, caminho + '.note inválida');
  }

  function validarSessao(s, erros, caminho) {
    if (!s || typeof s !== 'object') {
      erro(erros, caminho + ': sessão inválida (não é objeto)');
      return;
    }
    if (typeof s.id !== 'string' || !s.id) erro(erros, caminho + '.id inválido');
    if (typeof s.startTime !== 'string' || isNaN(new Date(s.startTime).getTime())) erro(erros, caminho + '.startTime inválido');
    if (s.endTime !== null && s.endTime !== undefined) {
      if (typeof s.endTime !== 'string' || isNaN(new Date(s.endTime).getTime())) erro(erros, caminho + '.endTime inválido');
    }
    if (SESSION_STATUS_VALIDOS.indexOf(s.status) === -1) erro(erros, caminho + '.status inválido: ' + s.status);
    if (!Number.isInteger(s.sacas) || s.sacas < 0) erro(erros, caminho + '.sacas inválido');
    if (!Number.isInteger(s.pacotes) || s.pacotes < 0) erro(erros, caminho + '.pacotes inválido');
    if (!Array.isArray(s.occurrences)) {
      erro(erros, caminho + '.occurrences não é lista');
    } else {
      s.occurrences.forEach(function (o, i) {
        validarOcorrencia(o, erros, caminho + '.occurrences[' + i + ']');
      });
    }
  }

  /**
   * Valida a estrutura completa dos dados.
   * Retorna { valido: boolean, erros: string[] }.
   * Nunca lança exceção: problemas inesperados viram um erro na lista.
   */
  function validarDados(dados) {
    var erros = [];
    try {
      if (!dados || typeof dados !== 'object') {
        return { valido: false, erros: ['Dados ausentes ou em formato inesperado.'] };
      }
      if (typeof dados.versao !== 'number') erro(erros, 'versao ausente ou inválida');
      if (dados.currentSession !== null && dados.currentSession !== undefined) {
        validarSessao(dados.currentSession, erros, 'currentSession');
      }
      if (!Array.isArray(dados.history)) {
        erro(erros, 'history não é lista');
      } else {
        dados.history.forEach(function (s, i) {
          validarSessao(s, erros, 'history[' + i + ']');
        });
      }
    } catch (e) {
      erro(erros, 'Falha inesperada ao validar: ' + e.message);
    }
    return { valido: erros.length === 0, erros: erros };
  }

  // ---------------------------------------------------------------------
  // Carregar / salvar
  // ---------------------------------------------------------------------

  /**
   * Carrega os dados do LocalStorage.
   * Retorna sempre { dados, aviso } — "dados" nunca é null/undefined, mesmo em erro:
   * nesse caso devolve uma estrutura vazia e preenche "aviso" com uma mensagem
   * compreensível para exibir na interface (nunca trava a aplicação).
   */
  function carregarDados() {
    var bruto;
    try {
      bruto = global.localStorage.getItem(C.STORAGE_KEY);
    } catch (e) {
      return { dados: estruturaVazia(), aviso: 'Não foi possível acessar o armazenamento local do navegador. Os dados não serão salvos nesta sessão.' };
    }

    if (bruto === null) {
      return { dados: estruturaVazia(), aviso: null };
    }

    var parsed;
    try {
      parsed = JSON.parse(bruto);
    } catch (e) {
      // JSON corrompido: preserva o conteúdo bruto sob outra chave em vez de descartá-lo,
      // e segue com uma estrutura vazia para não travar o aplicativo.
      tentarPreservarDadosCorrompidos(bruto);
      return { dados: estruturaVazia(), aviso: 'Os dados salvos estavam corrompidos (JSON inválido) e não puderam ser lidos. Uma cópia bruta foi preservada no armazenamento local. Iniciando com dados vazios.' };
    }

    var validacao = validarDados(parsed);
    if (!validacao.valido) {
      tentarPreservarDadosCorrompidos(bruto);
      return { dados: estruturaVazia(), aviso: 'Os dados salvos não têm um formato reconhecido (' + validacao.erros.slice(0, 3).join('; ') + '). Uma cópia bruta foi preservada no armazenamento local. Iniciando com dados vazios.' };
    }

    return { dados: parsed, aviso: null };
  }

  function tentarPreservarDadosCorrompidos(bruto) {
    try {
      var chave = C.STORAGE_KEY + '_corrompido_' + Date.now();
      global.localStorage.setItem(chave, bruto);
    } catch (e) {
      // Se nem isso for possível (ex.: quota cheia), não há mais nada a fazer aqui.
    }
  }

  /**
   * Salva os dados no LocalStorage.
   * Retorna { sucesso: boolean, erro?: string }.
   */
  function salvarDados(dados) {
    var validacao = validarDados(dados);
    if (!validacao.valido) {
      return { sucesso: false, erro: 'Dados inválidos, não foram salvos: ' + validacao.erros.slice(0, 3).join('; ') };
    }
    try {
      global.localStorage.setItem(C.STORAGE_KEY, JSON.stringify(dados));
      if (global.document && global.document.dispatchEvent && typeof global.CustomEvent === 'function') {
        global.document.dispatchEvent(new global.CustomEvent('melios:local-change', { detail: { module: 'nex', key: C.STORAGE_KEY } }));
      }
      return { sucesso: true };
    } catch (e) {
      var msg = 'Falha ao salvar os dados localmente.';
      if (e && e.name === 'QuotaExceededError') {
        msg = 'O armazenamento local está cheio. Exporte um backup e remova sessões antigas do histórico para liberar espaço.';
      }
      return { sucesso: false, erro: msg };
    }
  }

  // ---------------------------------------------------------------------
  // Backup (exportar / importar)
  // ---------------------------------------------------------------------

  /** Monta o objeto de backup (string JSON pronta para download). */
  function exportarBackup(dados) {
    var pacote = {
      melinotepadBackup: true,
      exportadoEm: new Date().toISOString(),
      versao: C.DATA_VERSION,
      dados: dados
    };
    return JSON.stringify(pacote, null, 2);
  }

  /**
   * Analisa um texto de backup importado.
   * Retorna { valido, dados?, erros? } sem aplicar nada —
   * quem chama decide se confirma a substituição.
   */
  function importarBackup(texto) {
    var parsed;
    try {
      parsed = JSON.parse(texto);
    } catch (e) {
      return { valido: false, erros: ['O arquivo selecionado não é um JSON válido.'] };
    }

    var dadosCandidatos = parsed && parsed.melinotepadBackup ? parsed.dados : parsed;
    var validacao = validarDados(dadosCandidatos);
    if (!validacao.valido) {
      return { valido: false, erros: validacao.erros };
    }
    return { valido: true, dados: dadosCandidatos };
  }

  global.MeliNotepad.Storage = {
    estruturaVazia: estruturaVazia,
    validarDados: validarDados,
    carregarDados: carregarDados,
    salvarDados: salvarDados,
    exportarBackup: exportarBackup,
    importarBackup: importarBackup
  };
})(window);
