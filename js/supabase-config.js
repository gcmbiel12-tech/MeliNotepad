/*
 * Configuração pública do cliente Supabase.
 * Preencha apenas com a URL do projeto e a chave publishable/anon pública.
 * NUNCA coloque service_role, senha administrativa ou outro segredo neste arquivo.
 * Também é possível injetar window.MeliNotepadConfig antes deste script no ambiente de hospedagem.
 */
(function (global) {
  'use strict';
  var recebido = global.MeliNotepadConfig || {};
  var cfg = {
    supabaseUrl: String(recebido.supabaseUrl || '').trim().replace(/\/+$/, ''),
    supabaseAnonKey: String(recebido.supabaseAnonKey || '').trim()
  };
  global.MeliNotepadConfig = cfg;

  var urlValida = false;
  try {
    var u = new URL(cfg.supabaseUrl);
    urlValida = (u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1')
      && !!u.host;
  } catch (e) { /* configuração ainda não preenchida */ }

  if (urlValida && cfg.supabaseAnonKey) {
    document.documentElement.classList.add('auth-configured');
  } else if (cfg.supabaseUrl || cfg.supabaseAnonKey) {
    document.documentElement.classList.add('auth-config-incomplete');
  }
})(window);
