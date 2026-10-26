(function (global) {
  'use strict';
  var NS = global.MeliNotepad = global.MeliNotepad || {};
  var A = NS.SupabaseAuth;
  var el = {};
  var contexto = null;
  var ocupado = false;

  function porId(id) { return document.getElementById(id); }
  function mensagem(texto, erro) {
    if (!el.message) return;
    el.message.textContent = texto || '';
    el.message.classList.toggle('is-erro', !!erro);
    el.message.classList.toggle('is-sucesso', !!texto && !erro);
  }
  function mensagemAdmin(texto, erro) {
    el.adminMessage.textContent = texto || '';
    el.adminMessage.classList.toggle('is-erro', !!erro);
  }
  function definirOcupado(valor, form) {
    ocupado = !!valor;
    if (!form) return;
    Array.prototype.forEach.call(form.querySelectorAll('button[type="submit"]'), function (b) {
      b.disabled = ocupado;
    });
  }
  function mostrarLogin(texto, erro) {
    contexto = null;
    document.documentElement.classList.add('auth-configured');
    el.panel.hidden = false;
    el.loginArea.hidden = false;
    el.recoverForm.hidden = true;
    el.resetForm.hidden = true;
    el.requestForm.hidden = true;
    el.header.hidden = true;
    el.localWarning.hidden = true;
    el.adminPanel.hidden = true;
    mensagem(texto || 'Entre com sua conta para continuar.', !!erro);
  }
  function mostrarSemVinculo(texto, erro) {
    contexto = null;
    document.documentElement.classList.add('auth-configured');
    el.panel.hidden = false;
    el.loginArea.hidden = true;
    el.recoverForm.hidden = true;
    el.resetForm.hidden = true;
    el.requestForm.hidden = false;
    el.header.hidden = true;
    el.localWarning.hidden = true;
    el.adminPanel.hidden = true;
    mensagem(texto || 'Sua conta está autenticada, mas ainda não possui acesso operacional ativo.', !!erro);
  }
  function mostrarAplicacao(ctx) {
    contexto = ctx;
    document.documentElement.classList.remove('auth-configured');
    el.panel.hidden = true;
    el.header.hidden = false;
    el.userLabel.textContent = ctx.fullName + ' · ' + ctx.employeeCode;
    el.adminToggle.hidden = ctx.role !== 'administrator';
    el.adminPanel.hidden = true;
    el.localWarning.hidden = false;
    mensagem('');
  }
  function tratarContexto() {
    return A.contextoFuncionario().then(function (ctx) {
      if (ctx && ctx.authorized === true && ctx.employeeCode && ctx.fullName) {
        mostrarAplicacao(ctx);
        return ctx;
      }
      mostrarSemVinculo(ctx && ctx.message || 'Sua conta ainda não possui acesso operacional ativo.');
      return null;
    });
  }
  function recuperarSessao() {
    if (!A.configurado()) return;
    el.panel.hidden = false;
    if (!A.sessao()) {
      mostrarLogin('Entre com sua conta para continuar.');
      return;
    }
    mensagem('Verificando sua autorização…');
    tratarContexto().catch(function (e) {
      mostrarLogin('A sessão existe, mas não foi possível validar a autorização: ' + e.message, true);
    });
  }
  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }
  function formatarData(valor) {
    var d = new Date(valor);
    return isNaN(d.getTime()) ? 'Data indisponível' : d.toLocaleString('pt-BR');
  }
  function elemento(tag, classe, texto) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto !== undefined) n.textContent = texto;
    return n;
  }
  function renderizarSolicitacoes(lista) {
    el.pendingList.textContent = '';
    if (!Array.isArray(lista) || !lista.length) {
      el.pendingList.appendChild(elemento('li', 'auth-pending-list__vazio', 'Nenhuma solicitação pendente.'));
      return;
    }
    lista.forEach(function (item) {
      var li = elemento('li', 'auth-pending-item');
      var detalhes = elemento('div', 'auth-pending-item__detalhes');
      detalhes.appendChild(elemento('strong', '', 'Código: ' + item.employee_code));
      detalhes.appendChild(elemento('span', '', 'Solicitante: ' + (item.requester_email || item.requester_id || 'identidade não disponível')));
      detalhes.appendChild(elemento('span', '', 'Solicitado em: ' + formatarData(item.requested_at)));
      var acoes = elemento('div', 'auth-pending-item__acoes');
      var aprovar = elemento('button', 'botao botao--primario', 'Aprovar');
      var recusar = elemento('button', 'botao botao--perigo', 'Recusar');
      aprovar.type = 'button'; recusar.type = 'button';
      aprovar.addEventListener('click', function () { revisarSolicitacao(item.request_id, true); });
      recusar.addEventListener('click', function () { revisarSolicitacao(item.request_id, false); });
      acoes.appendChild(aprovar); acoes.appendChild(recusar);
      li.appendChild(detalhes); li.appendChild(acoes); el.pendingList.appendChild(li);
    });
  }
  function atualizarSolicitacoes() {
    mensagemAdmin('Carregando solicitações…');
    el.pendingList.textContent = '';
    return A.listarSolicitacoes().then(function (lista) {
      renderizarSolicitacoes(lista);
      mensagemAdmin('');
    }).catch(function (e) {
      mensagemAdmin('Não foi possível carregar as solicitações: ' + e.message, true);
    });
  }
  function revisarSolicitacao(id, aprovar) {
    if (!global.confirm((aprovar ? 'Aprovar' : 'Recusar') + ' esta solicitação? Confirme que a identidade do funcionário foi verificada fora do sistema.')) return;
    mensagemAdmin('Registrando decisão…');
    var acao = aprovar ? A.aprovarSolicitacao : A.recusarSolicitacao;
    acao(id).then(function () {
      mensagemAdmin(aprovar ? 'Acesso aprovado.' : 'Solicitação recusada.');
      return atualizarSolicitacoes();
    }).catch(function (e) {
      mensagemAdmin('A decisão não foi concluída: ' + e.message, true);
    });
  }

  function inicializar() {
    el.panel = porId('auth-panel');
    if (!el.panel || !A || !A.configurado()) return;

    el.message = porId('auth-message');
    el.loginArea = porId('auth-login-area');
    el.loginForm = porId('auth-login-form');
    el.registerForm = porId('auth-register-form');
    el.recoverForm = porId('auth-recover-form');
    el.resetForm = porId('auth-reset-form');
    el.requestForm = porId('auth-request-form');
    el.header = porId('auth-header');
    el.userLabel = porId('auth-user-label');
    el.adminToggle = porId('auth-admin-toggle');
    el.adminPanel = porId('auth-admin-panel');
    el.adminMessage = porId('auth-admin-message');
    el.pendingList = porId('auth-pending-list');
    el.localWarning = porId('auth-local-data-warning');
    var tipoCallback = A.capturarCallback();

    mostrarLogin('Entre com sua conta para continuar.');
    el.loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = porId('auth-login-email').value.trim();
      var senha = porId('auth-login-password').value;
      if (!validarEmail(email) || !senha) { mensagem('Informe um e-mail válido e a senha.', true); return; }
      definirOcupado(true, el.loginForm);
      mensagem('Entrando…');
      A.entrar(email, senha).then(tratarContexto).catch(function (e) {
        mostrarLogin(e.message, true);
      }).finally(function () { definirOcupado(false, el.loginForm); });
    });

    el.registerForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = porId('auth-register-email').value.trim();
      var senha = porId('auth-register-password').value;
      if (!validarEmail(email) || senha.length < 8) {
        mensagem('Informe um e-mail válido e uma senha com pelo menos 8 caracteres.', true); return;
      }
      definirOcupado(true, el.registerForm);
      mensagem('Criando conta…');
      A.cadastrar(email, senha).then(function (resultado) {
        if (resultado.autenticado) return tratarContexto();
        mensagem('Conta criada. Confira o e-mail para confirmar a conta e depois entre no MeliNotepad.');
      }).catch(function (e) { mensagem(e.message, true); })
        .finally(function () { definirOcupado(false, el.registerForm); });
    });

    porId('auth-show-recover').addEventListener('click', function () {
      el.loginArea.hidden = true; el.recoverForm.hidden = false; mensagem('Informe o e-mail usado na conta.');
    });
    porId('auth-cancel-recover').addEventListener('click', function () {
      el.recoverForm.hidden = true; el.loginArea.hidden = false; mensagem('Entre com sua conta para continuar.');
    });
    el.recoverForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = porId('auth-recover-email').value.trim();
      if (!validarEmail(email)) { mensagem('Informe um e-mail válido.', true); return; }
      definirOcupado(true, el.recoverForm);
      mensagem('Enviando instruções…');
      A.recuperarSenha(email).then(function () {
        mensagem('Se a conta existir, as instruções de recuperação serão enviadas ao e-mail informado.');
      }).catch(function (e) { mensagem(e.message, true); })
        .finally(function () { definirOcupado(false, el.recoverForm); });
    });

    el.resetForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var senhaNova = porId('auth-reset-password').value;
      var senhaConfirmada = porId('auth-reset-confirm').value;
      if (senhaNova.length < 8) { mensagem('A senha deve ter pelo menos 8 caracteres.', true); return; }
      if (senhaNova !== senhaConfirmada) { mensagem('As senhas não conferem.', true); return; }
      definirOcupado(true, el.resetForm);
      mensagem('Atualizando senha…');
      A.atualizarSenha(senhaNova).then(function () {
        return A.sair().then(function () { mostrarLogin('Senha alterada. Entre com a nova senha.'); });
      }).catch(function (e) { mensagem(e.message, true); })
        .finally(function () { definirOcupado(false, el.resetForm); });
    });

    el.requestForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var codigo = porId('auth-employee-code').value.trim();
      if (!/^\d{7}$/.test(codigo)) { mensagem('O código deve conter exatamente sete dígitos numéricos.', true); return; }
      definirOcupado(true, el.requestForm);
      mensagem('Enviando solicitação…');
      A.solicitarAcesso(codigo).then(function () {
        mensagem('Solicitação registrada para análise. Esta resposta não confirma se o código está elegível.');
      }).catch(function (e) { mensagem(e.message, true); })
        .finally(function () { definirOcupado(false, el.requestForm); });
    });

    function sair() {
      definirOcupado(true);
      A.sair().finally(function () {
        definirOcupado(false);
        porId('auth-login-password').value = '';
        porId('auth-register-password').value = '';
        document.documentElement.classList.add('auth-configured');
        mostrarLogin('Você saiu da conta.');
      });
    }
    porId('auth-signout').addEventListener('click', sair);
    porId('auth-unlinked-signout').addEventListener('click', sair);

    el.adminToggle.addEventListener('click', function () {
      el.adminPanel.hidden = !el.adminPanel.hidden;
      if (!el.adminPanel.hidden) atualizarSolicitacoes();
    });
    porId('auth-admin-refresh').addEventListener('click', atualizarSolicitacoes);

    if (tipoCallback === 'recovery') {
      el.panel.hidden = false;
      el.loginArea.hidden = true;
      el.recoverForm.hidden = true;
      el.resetForm.hidden = false;
      el.requestForm.hidden = true;
      el.header.hidden = true;
      el.localWarning.hidden = true;
      el.adminPanel.hidden = true;
      mensagem('Defina uma nova senha para sua conta.');
      return;
    }
    recuperarSessao();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar);
  else inicializar();
})(window);
