const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('../lib/carregar');

function criarAuth(responder, configuracao, localizacao) {
  const valores = new Map();
  const chamadas = [];
  const storage = {
    getItem: k => valores.has(k) ? valores.get(k) : null,
    setItem: (k, v) => valores.set(k, String(v)),
    removeItem: k => valores.delete(k)
  };
  const ctx = carregar(['js/supabase-auth.js'], {
    MeliNotepadConfig: configuracao || { supabaseUrl: 'https://project.example', supabaseAnonKey: 'public-test-key' },
    sessionStorage: storage,
    location: Object.assign({ origin: 'https://app.example', pathname: '/index.html', search: '', hash: '' }, localizacao || {}),
    history: { replaceState: function (state, title, url) { ctx.historyUrl = url; } },
    URL,
    URLSearchParams,
    fetch: async (url, options) => {
      chamadas.push({ url: String(url), options: options || {} });
      const resultado = await responder(String(url), options || {}, chamadas.length);
      return {
        ok: resultado.status >= 200 && resultado.status < 300,
        status: resultado.status,
        text: async () => resultado.body == null ? '' : JSON.stringify(resultado.body)
      };
    }
  });
  return { auth: ctx.SupabaseAuth, valores, chamadas };
}

const session = (access, refresh, expires = Math.floor(Date.now() / 1000) + 3600) => ({
  access_token: access, refresh_token: refresh, expires_at: expires,
  token_type: 'bearer', user: { id: 'user-1' }
});

test('Supabase Auth permanece desativado sem URL e chave pública', () => {
  const { auth } = criarAuth(async () => ({ status: 200, body: {} }), { supabaseUrl: '', supabaseAnonKey: '' });
  assert.equal(auth.configurado(), false);
});

test('login guarda tokens na sessionStorage e RPC envia bearer token', async () => {
  const { auth, valores, chamadas } = criarAuth(async (url, options) => {
    if (url.includes('/auth/v1/token?grant_type=password')) {
      assert.equal(options.headers.apikey, 'public-test-key');
      return { status: 200, body: { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600, user: { id: 'user-1' } } };
    }
    if (url.endsWith('/rest/v1/rpc/get_my_employee_context')) {
      assert.equal(options.headers.Authorization, 'Bearer access-1');
      return { status: 200, body: { authorized: true, employeeCode: '0000123', fullName: 'Teste', role: 'operator' } };
    }
    throw new Error('URL inesperada: ' + url);
  });

  const user = await auth.entrar(' test@example.com ', 'senha-de-teste');
  assert.equal(user.id, 'user-1');
  assert.ok(valores.get('melinotepad_auth_session_v1'));
  const ctx = await auth.contextoFuncionario();
  assert.equal(ctx.employeeCode, '0000123');
  assert.equal(chamadas.length, 2);
});

test('sessão próxima da expiração é renovada antes da RPC', async () => {
  const { auth, valores, chamadas } = criarAuth(async (url, options) => {
    if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
      assert.equal(JSON.parse(options.body).refresh_token, 'refresh-old');
      return { status: 200, body: { access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 3600, user: { id: 'user-1' } } };
    }
    if (url.endsWith('/rest/v1/rpc/request_employee_access')) {
      assert.equal(options.headers.Authorization, 'Bearer access-new');
      assert.equal(JSON.parse(options.body).p_employee_code, '0000042');
      return { status: 200, body: { accepted: true, message: 'ok' } };
    }
    throw new Error('URL inesperada: ' + url);
  });
  valores.set('melinotepad_auth_session_v1', JSON.stringify(session('access-old', 'refresh-old', Math.floor(Date.now() / 1000) + 5)));
  const result = await auth.solicitarAcesso('0000042');
  assert.equal(result.accepted, true);
  assert.equal(chamadas.length, 2);
  assert.equal(JSON.parse(valores.get('melinotepad_auth_session_v1')).access_token, 'access-new');
});

test('falha de renovação limpa a sessão expirada', async () => {
  const { auth, valores } = criarAuth(async () => ({ status: 400, body: { message: 'Refresh token expired' } }));
  valores.set('melinotepad_auth_session_v1', JSON.stringify(session('access-old', 'refresh-old', Math.floor(Date.now() / 1000) - 5)));
  await assert.rejects(auth.contextoFuncionario(), /Refresh token expired/);
  assert.equal(valores.has('melinotepad_auth_session_v1'), false);
});

test('logout limpa sessão local mesmo se a revogação remota falhar', async () => {
  const { auth, valores } = criarAuth(async () => ({ status: 401, body: { message: 'Invalid token' } }));
  valores.set('melinotepad_auth_session_v1', JSON.stringify(session('access-old', 'refresh-old')));
  await auth.sair();
  assert.equal(valores.has('melinotepad_auth_session_v1'), false);
});

test('callback de recuperação armazena tokens, limpa a URL e permite atualizar senha', async () => {
  const { auth, valores, chamadas, } = criarAuth(async (url, options) => {
    if (url.endsWith('/auth/v1/user')) {
      assert.equal(options.method, 'PUT');
      assert.equal(options.headers.Authorization, 'Bearer recovery-access');
      assert.equal(JSON.parse(options.body).password, 'nova-senha-segura');
      return { status: 200, body: { id: 'user-1' } };
    }
    throw new Error('URL inesperada: ' + url);
  }, undefined, {
    hash: '#access_token=recovery-access&refresh_token=recovery-refresh&expires_in=3600&type=recovery'
  });
  assert.equal(auth.capturarCallback(), 'recovery');
  assert.equal(JSON.parse(valores.get('melinotepad_auth_session_v1')).access_token, 'recovery-access');
  assert.equal(chamadas.length, 0);
  await auth.atualizarSenha('nova-senha-segura');
  assert.equal(chamadas.length, 1);
});

test('RPC repete uma vez após 401 usando token renovado', async () => {
  let chamadasRpc = 0;
  const { auth, valores } = criarAuth(async (url, options) => {
    if (url.endsWith('/rest/v1/rpc/get_my_employee_context')) {
      chamadasRpc++;
      if (chamadasRpc === 1) return { status: 401, body: { message: 'JWT expirado' } };
      assert.equal(options.headers.Authorization, 'Bearer access-refreshed');
      return { status: 200, body: { authorized: false } };
    }
    if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
      return { status: 200, body: { access_token: 'access-refreshed', refresh_token: 'refresh-refreshed', expires_in: 3600, user: { id: 'user-1' } } };
    }
    throw new Error('URL inesperada: ' + url);
  });
  valores.set('melinotepad_auth_session_v1', JSON.stringify(session('access-old', 'refresh-old')));
  const ctx = await auth.contextoFuncionario();
  assert.equal(ctx.authorized, false);
  assert.equal(chamadasRpc, 2);
});
