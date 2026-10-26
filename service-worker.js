/**
 * service-worker.js
 * Estratégia: cache-first para os arquivos estáticos essenciais, com
 * atualização de versão explícita e tratamento de falhas de rede.
 *
 * IMPORTANTE: este cache guarda apenas a casca estática do aplicativo
 * (HTML, CSS, JS, manifesto, ícones). Nenhum dado operacional (sessões,
 * ocorrências ou snapshots remotos) é armazenado por este service worker.
 * O estado local continua no LocalStorage; quando habilitada, a sincronização
 * fala diretamente com as RPCs do Supabase pela página.
 *
 * Para atualizar o cache depois de alterar os arquivos do projeto,
 * incremente CACHE_VERSION abaixo. Veja o README para o passo a passo.
 */

var CACHE_VERSION = 'v13';
var CACHE_NAME = 'melinotepad-estatico-' + CACHE_VERSION;

var ARQUIVOS_ESSENCIAIS = [
  './',
  './index.html',
  './css/styles.css',
  './css/modulos.css',
  './css/auth.css',
  './js/supabase-config.js',
  './js/supabase-auth.js',
  './js/supabase-sync.js',
  './js/auth-ui.js',
  './js/save-status.js',
  './js/constants.js',
  './js/utils.js',
  './js/storage.js',
  './js/vendor/xlsx.full.min.js',
  './js/nex-planilha.js',
  './js/scanner.js',
  './js/report.js',
  './js/app.js',
  './js/modulo-store.js',
  './js/shell.js',
  './js/intervalos-regras.js',
  './js/relatorios-historico.js',
  './js/intervalos.js',
  './js/xpt-regras.js',
  './js/fotos.js',
  './js/impressao.js',
  './js/xpt.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Cacheia cada arquivo individualmente (em vez de cache.addAll, que é
      // tudo-ou-nada: se UM arquivo falhar ao buscar — um ícone instável na
      // hospedagem, por exemplo — addAll rejeita por inteiro e NADA fica em
      // cache, nem o próprio index.html). Assim, uma falha isolada não
      // derruba o cache offline inteiro.
      return Promise.all(ARQUIVOS_ESSENCIAIS.map(function (caminho) {
        return cache.add(caminho).catch(function (erro) {
          console.warn('[service-worker] Falha ao cachear "' + caminho + '":', erro);
        });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(
        nomes
          .filter(function (nome) { return nome !== CACHE_NAME; })
          .map(function (nome) { return caches.delete(nome); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (evento) {
  // Só tratamos requisições GET da própria origem; o restante (ex.: chamadas
  // de outras origens) segue direto para a rede sem passar pelo cache.
  if (evento.request.method !== 'GET') return;

  var url = new URL(evento.request.url);
  if (url.origin !== self.location.origin) return;

  var ehNavegacao = evento.request.mode === 'navigate';

  evento.respondWith(
    caches.match(evento.request).then(function (respostaEmCache) {
      if (respostaEmCache) return respostaEmCache;

      return fetch(evento.request).then(function (respostaDaRede) {
        if (respostaDaRede && respostaDaRede.ok) {
          var copia = respostaDaRede.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(evento.request, copia);
          });
        }
        return respostaDaRede;
      }).catch(function () {
        if (!ehNavegacao) {
          return new Response('', { status: 503, statusText: 'Offline e recurso não disponível em cache.' });
        }
        // Sem rede e este item não está em cache: tenta a página principal
        // já cacheada como alternativa. CRÍTICO: isso nunca pode resolver
        // para "undefined" -- um respondWith() sem uma Response de verdade
        // é exatamente o que faz o Chrome mostrar "ERR_FAILED" em vez do
        // app (foi o bug encontrado nesta versão: o fallback abaixo não
        // tinha uma segunda alternativa garantida quando o cache também
        // falhava).
        return caches.match('./index.html').then(function (pagina) {
          if (pagina) return pagina;
          return new Response(
            '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<title>MeliNotepad — sem conexão</title></head>' +
            '<body style="font-family:sans-serif;padding:24px;max-width:480px;margin:0 auto">' +
            '<h1>MeliNotepad — sem conexão</h1>' +
            '<p>Não foi possível carregar o MeliNotepad agora, e esta página ainda não está ' +
            'disponível para uso offline neste aparelho.</p>' +
            '<p>Conecte-se à internet e abra o app de novo para que ele termine de ' +
            'preparar o uso offline.</p>' +
            '</body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      });
    })
  );
});
