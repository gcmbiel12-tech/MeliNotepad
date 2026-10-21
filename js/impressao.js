/**
 * impressao.js
 * Impressão/PDF dos relatórios dos módulos novos, reaproveitando a folha #print-area
 * e as regras @media print já existentes (o NEX continua usando o seu próprio fluxo).
 * Espera as imagens carregarem antes de abrir a impressão.
 */
(function (global) {
  'use strict';
  var NS = global.MeliNotepad = global.MeliNotepad || {};

  function aguardarImagens(raiz) {
    var imgs = Array.prototype.slice.call(raiz.querySelectorAll('img'));
    return Promise.all(imgs.map(function (im) {
      if (im.complete && im.naturalWidth) return Promise.resolve();
      return new Promise(function (res) { im.onload = res; im.onerror = res; setTimeout(res, 5000); });
    }));
  }

  function imprimir(titulo, construir) {
    var raiz = document.getElementById('print-area');
    NS.UI.limpar(raiz);
    return Promise.resolve(construir(raiz, NS.UI.h)).then(function () { return aguardarImagens(raiz); }).then(function () {
      var original = document.title, feito = false;
      function restaurar() { if (feito) return; feito = true; document.title = original; global.removeEventListener('afterprint', restaurar); }
      document.title = titulo;
      global.addEventListener('afterprint', restaurar);
      setTimeout(restaurar, 3000);
      global.print();
    });
  }

  NS.Impressao = { imprimir: imprimir };
})(window);
