/**
 * shell.js
 * Navegação entre as áreas do MeliNotepad (NEX, XPT, Intervalos).
 * Só alterna a visibilidade: nenhuma área é recriada ou recarregada, então
 * formulários ainda não salvos e dados em tela são preservados ao trocar de área.
 */
(function (global) {
  'use strict';
  var NS = global.MeliNotepad = global.MeliNotepad || {};
  var MODULOS = ['nex', 'xpt', 'intervalos'];
  var CHAVE_UI = 'melinotepad_ui_v1';
  var atual = null;

  function moduloSalvo() {
    try { var v = JSON.parse(global.localStorage.getItem(CHAVE_UI) || '{}'); return v && v.modulo; } catch (e) { return null; }
  }
  function salvarModulo(nome) {
    try { global.localStorage.setItem(CHAVE_UI, JSON.stringify({ modulo: nome })); } catch (e) { /* preferência opcional */ }
  }
  function moduloDoHash() {
    var h = (global.location.hash || '').replace(/^#\/?/, '').split('/')[0];
    return MODULOS.indexOf(h) >= 0 ? h : null;
  }

  function ativar(nome) {
    if (MODULOS.indexOf(nome) < 0) nome = 'nex';
    var mudou = nome !== atual;
    atual = nome;
    MODULOS.forEach(function (m) {
      var el = document.getElementById('modulo-' + m);
      if (el) el.hidden = m !== nome;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab-modulo'), function (t) {
      var ativo = t.dataset.modulo === nome;
      t.classList.toggle('is-ativo', ativo);
      if (ativo) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    var main = document.getElementById('conteudo-principal');
    if (main) main.dataset.modulo = nome;
    var chip = document.getElementById('status-chip'); // o estado da sessão é do NEX
    if (chip) chip.hidden = nome !== 'nex';
    salvarModulo(nome);
    if (global.location.hash !== '#' + nome && global.history && global.history.replaceState) {
      global.history.replaceState(null, '', '#' + nome);
    }
    if (mudou) document.dispatchEvent(new CustomEvent('melios:modulo', { detail: { modulo: nome } }));
  }

  function atualizarOffsetsFixos() {
    var header = document.querySelector('.app-header');
    var abasNex = document.getElementById('nex-abas-principais');
    var raiz = document.documentElement;
    if (header) raiz.style.setProperty('--app-header-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
    if (abasNex) raiz.style.setProperty('--nex-tabs-height', Math.ceil(abasNex.getBoundingClientRect().height) + 'px');
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab-modulo'), function (t) {
      t.addEventListener('click', function () { ativar(t.dataset.modulo); atualizarOffsetsFixos(); });
    });
    global.addEventListener('hashchange', function () { var m = moduloDoHash(); if (m) ativar(m); });
    global.addEventListener('resize', atualizarOffsetsFixos, { passive: true });
    if (global.ResizeObserver) {
      var observador = new ResizeObserver(atualizarOffsetsFixos);
      var header = document.querySelector('.app-header');
      var abasNex = document.getElementById('nex-abas-principais');
      if (header) observador.observe(header);
      if (abasNex) observador.observe(abasNex);
    }
    ativar(moduloDoHash() || moduloSalvo() || 'nex');
    atualizarOffsetsFixos();
    global.requestAnimationFrame(atualizarOffsetsFixos);
  }


  // ------------------------------------------------------------------
  // Utilitários de interface compartilhados pelos módulos novos.
  // Reaproveitam as classes já existentes (toast, modal, botao, campo...).
  // ------------------------------------------------------------------
  function h(tag, props, filhos) {
    var el = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (filhos || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  function limpar(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  function avisar(mensagem, tipo) {
    var cont = document.getElementById('toast-container');
    if (!cont) return;
    var t = h('div', { class: 'toast toast--' + (tipo || 'info'), role: 'status', text: mensagem });
    cont.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4500);
  }

  /** Devolve um <dialog class="modal"> reutilizável (criado uma vez, esvaziado a cada uso). */
  function dialogo(id) {
    var d = document.getElementById(id);
    if (!d) { d = h('dialog', { class: 'modal', id: id }); document.body.appendChild(d); }
    return limpar(d);
  }

  function campo(rotulo, controle, ajuda) {
    var id = controle.id || ('c' + Math.random().toString(36).slice(2, 8));
    controle.id = id;
    return h('div', { class: 'campo' }, [h('label', { for: id, text: rotulo }), controle, ajuda ? h('p', { class: 'campo__ajuda', text: ajuda }) : null]);
  }

  function baixarArquivo(nome, texto, tipo) {
    var blob = new Blob([texto], { type: tipo || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: nome });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  NS.UI = { h: h, limpar: limpar, avisar: avisar, dialogo: dialogo, campo: campo, baixarArquivo: baixarArquivo };

  NS.Shell = { ativar: ativar, moduloAtual: function () { return atual; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
