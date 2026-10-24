(function (global) {
  'use strict';
  var status = null, retry = null, modulo = 'NEX', ultimoErro = '', callbacks = {};
  var estados = {
    NEX: { estado: 'neutro', mensagem: 'Nenhuma alteração pendente', erro: '' },
    XPT: { estado: 'neutro', mensagem: 'Nenhuma alteração pendente', erro: '' }
  };
  function elementos() {
    if (!status) status = global.document.getElementById('save-status');
    if (!retry) retry = global.document.getElementById('save-retry');
    return !!status;
  }
  function mostrar() {
    if (!elementos()) return;
    var item = estados[modulo] || estados.NEX;
    status.className = 'save-status save-status--' + item.estado;
    status.textContent = item.mensagem;
    status.dataset.moduloSalvamento = modulo;
    ultimoErro = item.erro || '';
    if (retry) retry.hidden = item.estado !== 'erro';
  }
  function definir(estado, mensagem, erro) {
    estados[modulo] = { estado: estado, mensagem: mensagem, erro: erro || '' };
    mostrar();
  }
  function selecionarModulo(nome) {
    modulo = nome || 'NEX';
    if (!estados[modulo]) estados[modulo] = { estado: 'neutro', mensagem: 'Nenhuma alteração pendente', erro: '' };
    mostrar();
  }
  global.MeliNotepad = global.MeliNotepad || {};
  global.MeliNotepad.SaveStatus = {
    modulo: selecionarModulo,
    salvando: function () { definir('salvando', '◌ Salvando…'); },
    salvo: function () { definir('salvo', '✓ Salvo'); },
    erro: function (mensagem) { definir('erro', '⚠ Erro ao salvar', mensagem || 'Falha ao salvar.'); },
    ultimoErro: function () { return ultimoErro; },
    aoTentarNovamente: function (callback, nomeModulo) {
      callbacks[nomeModulo || modulo] = callback;
      if (elementos() && retry) retry.onclick = function () {
        var executar = callbacks[modulo];
        if (executar) executar();
      };
    }
  };
  global.document.addEventListener('click', function (e) {
    var tab = e.target.closest && e.target.closest('[data-modulo]');
    if (!tab) return;
    var nome = tab.dataset.modulo;
    if (nome === 'nex' || nome === 'xpt') selecionarModulo(nome.toUpperCase());
  });
  global.addEventListener('beforeunload', function (e) {
    var pendente = Object.keys(estados).some(function (k) { return estados[k].estado === 'erro' || estados[k].estado === 'salvando'; });
    if (!pendente) return;
    e.preventDefault();
    e.returnValue = '';
  });
})(window);
