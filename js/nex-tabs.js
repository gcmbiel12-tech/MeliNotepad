(function () {
  'use strict';
  var nav = document.getElementById('nex-abas-principais');
  if (!nav) return;
  var tabs = Array.prototype.slice.call(nav.querySelectorAll('[data-nex-tab]'));
  var panels = {
    gaiolas: document.getElementById('nex-tab-gaiolas'),
    ocorrencias: document.getElementById('nex-tab-ocorrencias'),
    quantidades: document.getElementById('nex-tab-quantidades'),
    relatorios: document.getElementById('nex-tab-relatorios')
  };
  nav.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-nex-tab]');
    if (!tab) return;
    var name = tab.getAttribute('data-nex-tab');
    tabs.forEach(function (item) {
      var active = item === tab;
      item.classList.toggle('is-ativo', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
      item.tabIndex = active ? 0 : -1;
    });
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].hidden = key !== name;
    });
  });
  tabs.forEach(function (tab, index) {
    tab.tabIndex = index === 0 ? 0 : -1;
    tab.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      var next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    });
  });
}());