/**
 * constants.js
 * Constantes compartilhadas entre todos os módulos do MeliNotepad.
 * Nenhuma lógica de negócio deve viver aqui, apenas valores fixos.
 */
(function (global) {
  'use strict';

  // Versão do esquema de dados salvo no LocalStorage.
  // Se a estrutura dos dados mudar no futuro, incremente este número
  // e trate a migração em storage.js.
  var DATA_VERSION = 1;

  var STORAGE_KEY = 'melinotepad_data_v1';

  // Categorias disponíveis para ocorrências do NEX.
  // "key" é o identificador interno estável (usado para salvar e filtrar).
  // "label" é o texto exibido na interface e nos relatórios.
  // O campo "emoji" é usado só no resumo estilo WhatsApp (ver report.js) para
  // deixar o relatório mais fácil de escanear visualmente quando colado no
  // grupo — não aparece em nenhum outro lugar (tela, PDF).
  var CATEGORIES = [
    { key: 'avariados', label: 'Pacotes avariados e retirados', emoji: '🛠️' },
    { key: 'duplicados_inventario', label: 'Pacotes duplicados/sem produto encaminhados ao inventário', emoji: '📥' },
    { key: 'possiveis_duplicados', label: 'Possíveis duplicados', emoji: '🔁' },
    { key: 'nao_localizados', label: 'Pacotes não localizados em auditoria', emoji: '🔎' },
    { key: 'despachar_nao_agregados', label: 'Pacotes com status "despachar" não agregados', emoji: '🚚' },
    { key: 'bingo', label: 'Bingo', emoji: '🎯' },
    { key: 'faltando', label: 'Faltando', emoji: '❗' }
  ];

  var STATUS = {
    PENDENTE: 'pendente',
    RESOLVIDO: 'resolvido'
  };

  var STATUS_LABEL = {
    pendente: 'Pendente',
    resolvido: 'Resolvido'
  };

  var STATUS_EMOJI = {
    pendente: '🔴',
    resolvido: '✅'
  };

  var SESSION_STATUS = {
    EM_ANDAMENTO: 'em_andamento',
    FINALIZADA: 'finalizada'
  };

  function categoriaLabel(key) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].key === key) return CATEGORIES[i].label;
    }
    return 'Categoria desconhecida';
  }

  global.MeliNotepad = global.MeliNotepad || {};
  global.MeliNotepad.Constants = {
    DATA_VERSION: DATA_VERSION,
    STORAGE_KEY: STORAGE_KEY,
    CATEGORIES: CATEGORIES,
    STATUS: STATUS,
    STATUS_LABEL: STATUS_LABEL,
    STATUS_EMOJI: STATUS_EMOJI,
    SESSION_STATUS: SESSION_STATUS,
    categoriaLabel: categoriaLabel
  };
})(window);
