/**
 * xpt.js — marcador da área XPT nesta entrega parcial.
 * A tela do XPT ainda não foi concluída (ver wip/LEIA-ME.md). Este arquivo NÃO grava
 * nenhum dado: apenas informa o estado. As regras (xpt-regras.js) já existem e têm testes.
 */
(function (global) {
  'use strict';
  function init() {
    var raiz = document.getElementById('modulo-xpt'), UI = global.MeliNotepad && global.MeliNotepad.UI;
    if (!raiz || !UI) return;
    UI.limpar(raiz);
    raiz.appendChild(UI.h('section', { class: 'cartao cartao--amarelo', id: 'xpt-em-desenvolvimento' }, [
      UI.h('h2', { text: 'XPT — em desenvolvimento' }),
      UI.h('p', { class: 'texto-apoio', text: 'Esta área ainda não está disponível. As regras de cálculo (intervalos de gaiolas, auditoria, totais, vínculo gaiola–veículo e ocorrências) já estão implementadas e testadas, mas a tela, a foto do HAND e do lacre e os relatórios ainda não foram concluídos.' }),
      UI.h('p', { class: 'texto-apoio', text: 'Nenhum dado do XPT é gravado nesta versão.' })]));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
