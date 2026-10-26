(function (global) {
  'use strict';
  var KEY = 'melinotepad_auth_session_v1';
  var cfg = global.MeliNotepadConfig || {};

  function configurado() {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return false;
    try {
      var u = new URL(cfg.supabaseUrl);
      return (u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    } catch (e) { return false; }
  }

  function lerSessao() {
    try {
      var s = JSON.parse(global.sessionStorage.getItem(KEY) || 'null');
      return s && s.access_token && s.refresh_token ? s : null;
    } catch (e) { return null; }
  }

  function guardarSessao(data) {
    if (!data || !data.access_token || !data.refresh_token) return null;
    var sessao = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
      token_type: data.token_type || 'bearer',
      user: data.user || null
    };
    try {
      global.sessionStorage.setItem(KEY, JSON.stringify(sessao));
    } catch (e) {
      throw new Error('O navegador bloqueou o armazenamento temporário da sessão.');
    }
    return sessao;
  }

  function limparSessao() {
    try { global.sessionStorage.removeItem(KEY); } catch (e) { /* sessão já indisponível */ }
  }

  function erroDaResposta(data, status) {
    var msg = data && (data.msg || data.message || data.error_description || data.error);
    if (status === 429) return 'Muitas tentativas. Aguarde antes de tentar novamente.';
    if (status === 401 || status === 403) return msg || 'Credenciais inválidas ou acesso não autorizado.';
    if (status >= 500) return 'O serviço de autenticação está temporariamente indisponível.';
    return msg || ('A solicitação falhou (HTTP ' + status + ').');
  }

  function enviar(url, options) {
    options = options || {};
    var headers = Object.assign({ apikey: cfg.supabaseAnonKey }, options.headers || {});
    if (options.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return global.fetch(cfg.supabaseUrl + url, Object.assign({}, options, { headers: headers }))
      .then(function (res) {
        return res.text().then(function (texto) {
          var data = null;
          if (texto) {
            try { data = JSON.parse(texto); } catch (e) { data = { message: texto }; }
          }
          if (!res.ok) {
            var erro = new Error(erroDaResposta(data, res.status));
            erro.status = res.status;
            throw erro;
          }
          return data;
        });
      });
  }

  function renovar(sessao) {
    if (!sessao || !sessao.refresh_token) return Promise.reject(new Error('Sua sessão expirou. Entre novamente.'));
    return enviar('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: sessao.refresh_token })
    }).then(function (data) {
      return guardarSessao(data);
    }).catch(function (e) {
      limparSessao();
      throw e;
    });
  }

  function sessaoValida() {
    var s = lerSessao();
    if (!s) return Promise.resolve(null);
    if (Number(s.expires_at) * 1000 <= Date.now() + 60000) return renovar(s);
    return Promise.resolve(s);
  }

  function chamadaProtegida(path, options, tentarRenovar) {
    if (!configurado()) return Promise.reject(new Error('A integração Supabase não está configurada.'));
    return sessaoValida().then(function (s) {
      if (!s) throw new Error('Entre na sua conta para continuar.');
      options = options || {};
      options.headers = Object.assign({}, options.headers || {}, { Authorization: 'Bearer ' + s.access_token });
      return enviar(path, options).catch(function (e) {
        if (tentarRenovar !== false && e.status === 401) {
          return renovar(s).then(function (novo) {
            options.headers.Authorization = 'Bearer ' + novo.access_token;
            return enviar(path, options);
          });
        }
        throw e;
      });
    });
  }

  function entrar(email, senha) {
    if (!configurado()) return Promise.reject(new Error('A integração Supabase não está configurada.'));
    return enviar('/auth/v1/token?grant_type=password', {
      method: 'POST', body: JSON.stringify({ email: String(email || '').trim(), password: String(senha || '') })
    }).then(function (data) {
      guardarSessao(data);
      return data.user || null;
    });
  }

  function cadastrar(email, senha) {
    if (!configurado()) return Promise.reject(new Error('A integração Supabase não está configurada.'));
    return enviar('/auth/v1/signup', {
      method: 'POST', body: JSON.stringify({ email: String(email || '').trim(), password: String(senha || '') })
    }).then(function (data) {
      if (data && data.access_token && data.refresh_token) guardarSessao(data);
      return { user: data && data.user || data, autenticado: !!(data && data.access_token) };
    });
  }

  function recuperarSenha(email) {
    if (!configurado()) return Promise.reject(new Error('A integração Supabase não está configurada.'));
    var redirect = encodeURIComponent(global.location.origin + global.location.pathname);
    return enviar('/auth/v1/recover?redirect_to=' + redirect, {
      method: 'POST', body: JSON.stringify({ email: String(email || '').trim() })
    });
  }

  function sair() {
    var s = lerSessao();
    if (!s || !configurado()) { limparSessao(); return Promise.resolve(); }
    return chamadaProtegida('/auth/v1/logout', { method: 'POST' }, false)
      .catch(function () { /* revogação remota é melhor esforço; sempre limpa a sessão local */ })
      .then(limparSessao);
  }

  function capturarCallback() {
    var hash = String(global.location.hash || '').replace(/^#/, '');
    if (!hash || hash.indexOf('access_token=') < 0) return null;
    var params = new URLSearchParams(hash);
    var access = params.get('access_token'), refresh = params.get('refresh_token');
    if (!access || !refresh) return null;
    guardarSessao({
      access_token: access,
      refresh_token: refresh,
      expires_in: Number(params.get('expires_in') || 3600),
      expires_at: params.get('expires_at') ? Number(params.get('expires_at')) : undefined,
      token_type: params.get('token_type') || 'bearer'
    });
    if (global.history && global.history.replaceState) {
      global.history.replaceState(null, '', global.location.pathname + global.location.search);
    }
    return params.get('type') || 'session';
  }

  function atualizarSenha(senha) {
    if (String(senha || '').length < 8) return Promise.reject(new Error('A senha deve ter pelo menos 8 caracteres.'));
    return chamadaProtegida('/auth/v1/user', {
      method: 'PUT', body: JSON.stringify({ password: String(senha) })
    });
  }

  function rpc(nome, argumentos) {
    return chamadaProtegida('/rest/v1/rpc/' + encodeURIComponent(nome), {
      method: 'POST', body: JSON.stringify(argumentos || {})
    });
  }

  function contextoFuncionario() { return rpc('get_my_employee_context', {}); }
  function solicitarAcesso(codigo) { return rpc('request_employee_access', { p_employee_code: String(codigo || '').trim() }); }
  function listarSolicitacoes() { return rpc('list_pending_access_requests', {}); }
  function aprovarSolicitacao(id) { return rpc('approve_employee_access', { p_request_id: id }); }
  function recusarSolicitacao(id) { return rpc('deny_employee_access', { p_request_id: id }); }

  global.MeliNotepad = global.MeliNotepad || {};
  global.MeliNotepad.SupabaseAuth = {
    configurado: configurado,
    sessao: lerSessao,
    entrar: entrar,
    cadastrar: cadastrar,
    recuperarSenha: recuperarSenha,
    capturarCallback: capturarCallback,
    atualizarSenha: atualizarSenha,
    sair: sair,
    rpc: rpc,
    contextoFuncionario: contextoFuncionario,
    solicitarAcesso: solicitarAcesso,
    listarSolicitacoes: listarSolicitacoes,
    aprovarSolicitacao: aprovarSolicitacao,
    recusarSolicitacao: recusarSolicitacao
  };
})(window);
