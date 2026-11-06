(function (global) {
  'use strict';

  function byId(id) { return document.getElementById(id); }
  function click(id) {
    var el = byId(id);
    if (el && !el.hidden) el.click();
  }

  function sessaoAtual() {
    var api = global.MeliNotepad && global.MeliNotepad.NexOperations;
    return api && typeof api.getCurrentSession === 'function' ? api.getCurrentSession() : null;
  }

  function formatarNumero(valor) {
    var numero = Number(valor);
    return Number.isFinite(numero) ? numero.toLocaleString('pt-BR') : String(valor == null ? 0 : valor);
  }

  function atualizarResumoNex() {
    var sessao = sessaoAtual();
    var ativa = !!sessao;
    var cardAuditoria = byId('summary-nex-card-auditoria');
    var cardOperacao = byId('summary-nex-card-operacao');
    var cardIniciar = byId('summary-nex-card-iniciar');
    var status = byId('summary-nex-operacao-status');

    if (cardAuditoria) cardAuditoria.hidden = !ativa;
    if (cardOperacao) cardOperacao.hidden = !ativa;
    if (cardIniciar) cardIniciar.hidden = ativa;
    if (status) status.textContent = ativa ? 'Operação em andamento.' : 'Não existe operação ativa.';

    if (ativa) {
      var rotas = Array.isArray(sessao.rotasHybrid) ? sessao.rotasHybrid : [];
      var sacas = byId('summary-nex-sacas');
      var pacotes = byId('summary-nex-pacotes');
      var totalRotas = byId('summary-nex-rotas');
      if (sacas) sacas.textContent = formatarNumero(sessao.sacas);
      if (pacotes) pacotes.textContent = formatarNumero(sessao.pacotes);
      if (totalRotas) totalRotas.textContent = formatarNumero(rotas.length);
    }
  }

  function mostrarResumo(modulo) {
    var qrApp = byId('qr-sacas-app');
    if (qrApp) qrApp.hidden = modulo !== 'qr-sacas';
    if (modulo === 'qr-sacas') {
      var navNex = byId('nex-abas-principais');
      if (navNex) navNex.hidden = true;
      var landingNex = byId('nex-tela-iniciar-operacao');
      if (landingNex) landingNex.hidden = true;
      ['nex', 'xpt', 'intervalos'].forEach(function (m) { var s = byId('tela-summary-' + m); if (s) s.hidden = true; var a = byId(m + '-app'); if (a) a.hidden = true; });
      return;
    }
    ['nex', 'xpt', 'intervalos'].forEach(function (m) {
      var summary = byId('tela-summary-' + m);
      if (summary) summary.hidden = m !== modulo;
      var app = byId(m + '-app');
      if (app) app.hidden = true;
    });

    if (modulo === 'nex') {
      var nav = byId('nex-abas-principais');
      if (nav) nav.hidden = true;
      var landing = byId('nex-tela-iniciar-operacao');
      if (landing) landing.hidden = true;
      ['nex-tab-gaiolas', 'nex-tab-ocorrencias', 'nex-tab-quantidades', 'nex-tab-relatorios'].forEach(function (id) {
        var panel = byId(id);
        if (panel) panel.hidden = true;
      });
      atualizarResumoNex();
    }
  }

  function mostrarInterno(modulo) {
    var summary = byId('tela-summary-' + modulo);
    if (summary) summary.hidden = true;

    if (modulo === 'nex') {
      var ativa = !!byId('painel-sessao-ativa') && !byId('painel-sessao-ativa').hidden;
      var nav = byId('nex-abas-principais');
      var landing = byId('nex-tela-iniciar-operacao');
      if (nav) nav.hidden = !ativa;
      if (landing) landing.hidden = ativa;
      if (!ativa) {
        ['nex-tab-gaiolas', 'nex-tab-ocorrencias', 'nex-tab-quantidades', 'nex-tab-relatorios'].forEach(function (id) {
          var panel = byId(id);
          if (panel) panel.hidden = true;
        });
      }
      return;
    }

    var app = byId(modulo + '-app');
    if (app) app.hidden = false;
  }

  function init() {
    ['nex', 'xpt', 'intervalos'].forEach(function (m) {
      var summary = byId('tela-summary-' + m);
      if (summary) summary.hidden = true;
    });
    ['xpt-app', 'intervalos-app', 'qr-sacas-app'].forEach(function (id) {
      var app = byId(id);
      if (app) app.hidden = true;
    });

    var nav = byId('nex-abas-principais');
    if (nav) nav.hidden = true;

    var appPrincipal = byId('tela-app');
    if (appPrincipal) appPrincipal.hidden = !(global.MeliNotepad && global.MeliNotepad.Shell && global.MeliNotepad.Shell.moduloAtual() === 'app');

    document.addEventListener('melios:modulo', function (event) {
      if (event.detail.modulo === 'app') {
        ['nex', 'xpt', 'intervalos'].forEach(function (m) {
          var summary = byId('tela-summary-' + m);
          if (summary) summary.hidden = true;
          var app = byId(m + '-app');
          if (app) app.hidden = true;
        });
        if (nav) nav.hidden = true;
        var landing = byId('nex-tela-iniciar-operacao');
        if (landing) landing.hidden = true;
        ['nex-tab-gaiolas', 'nex-tab-ocorrencias', 'nex-tab-quantidades', 'nex-tab-relatorios'].forEach(function (id) {
          var panel = byId(id);
          if (panel) panel.hidden = true;
        });
        return;
      }
      mostrarResumo(event.detail.modulo);
    });

    document.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button) return;

      if (button.id === 'summary-nex-operacao') {
        mostrarInterno('nex');
        click('btn-ver-sessao');
      } else if (button.id === 'summary-nex-auditoria') {
        mostrarInterno('nex');
        click('nex-tab-btn-gaiolas');
      } else if (button.id === 'summary-nex-abrir-operacao') {
        mostrarInterno('nex');
        click('nex-tab-btn-quantidades');
      } else if (button.id === 'summary-nex-historico') {
        mostrarInterno('nex');
        click('btn-ver-historico');
      } else if (button.id === 'nex-history-back') {
        var historyView = byId('view-historico');
        if (historyView) historyView.hidden = true;
        var historyScreen = byId('nex-historico-independente');
        if (historyScreen) historyScreen.hidden = true;
        var summary = byId('tela-summary-nex');
        if (summary) summary.hidden = false;
        var landing = byId('nex-tela-iniciar-operacao');
        if (landing) landing.hidden = true;
        var nav = byId('nex-abas-principais');
        if (nav) nav.hidden = true;
        ['nex-tab-gaiolas', 'nex-tab-ocorrencias', 'nex-tab-quantidades', 'nex-tab-relatorios'].forEach(function (id) {
          var panel = byId(id);
          if (panel) panel.hidden = true;
        });
      } else if (button.id === 'summary-xpt-operacoes') {
        mostrarInterno('xpt');
        var operationTab = document.querySelector('#xpt-app button[data-tela="operacoes"]');
        if (operationTab) operationTab.click();
      } else if (button.id === 'summary-xpt-auditoria') {
        mostrarInterno('xpt');
        var auditTab = document.querySelector('#xpt-app button[data-aba="gaiolas"]');
        if (auditTab) auditTab.click();
      } else if (button.id === 'summary-xpt-relatorios') {
        mostrarInterno('xpt');
        var reportTab = document.querySelector('#xpt-app button[data-aba="relatorios"]');
        if (reportTab) reportTab.click();
      } else if (button.id === 'summary-intervalos-ativos') {
        mostrarInterno('intervalos');
        click('iv-aba-ativos');
      } else if (button.id === 'summary-intervalos-cadastros') {
        mostrarInterno('intervalos');
        click('iv-aba-funcionarios');
      } else if (button.id === 'summary-intervalos-historico') {
        mostrarInterno('intervalos');
        click('iv-aba-historico');
      }
    });

    atualizarResumoNex();
    var painelSessao = byId('painel-sessao-ativa');
    if (painelSessao && typeof MutationObserver !== 'undefined') {
      new MutationObserver(atualizarResumoNex).observe(painelSessao, {
        attributes: true,
        attributeFilter: ['hidden']
      });
    }
    document.addEventListener('melios:modulo', atualizarResumoNex);

    var hash = (global.location.hash || '').replace(/^#\/?/, '');
    var modulo = ['nex', 'xpt', 'qr-sacas', 'intervalos'].indexOf(hash) >= 0 ? hash : null;
    if (modulo) mostrarResumo(modulo);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
