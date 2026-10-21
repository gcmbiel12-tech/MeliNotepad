/**
 * fotos.js
 * Foto única do HAND e do lacre (juntos) por veículo do XPT.
 *
 * ARMAZENAMENTO ATUAL: IndexedDB deste aparelho (persiste ao fechar e reabrir o app).
 * LIMITAÇÃO: a foto NÃO fica acessível em outros aparelhos — isso exige um serviço de
 * armazenamento central (ainda não configurado/autorizado). O registro guarda
 * `sincronizada: false` para que um envio futuro seja idempotente (mesmo id = mesma foto).
 * Nenhuma foto é apagada por esta camada.
 */
(function (global) {
  'use strict';
  var NS = global.MeliNotepad = global.MeliNotepad || {};
  var DB = 'melinotepad_fotos_v1', STORE = 'fotos';
  var urls = {};

  function abrir() {
    return new Promise(function (res, rej) {
      if (!global.indexedDB) { rej(new Error('Este navegador não oferece armazenamento de fotos (IndexedDB).')); return; }
      var rq = global.indexedDB.open(DB, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE, { keyPath: 'id' }); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error || new Error('Falha ao abrir o armazenamento de fotos.')); };
      rq.onblocked = function () { rej(new Error('Armazenamento de fotos bloqueado por outra aba.')); };
    });
  }
  function transacao(modo, fn) {
    return abrir().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, modo), req = fn(t.objectStore(STORE));
        t.oncomplete = function () { db.close(); res(req ? req.result : undefined); };
        t.onerror = function () { db.close(); rej(t.error || new Error('Falha ao gravar a foto.')); };
        t.onabort = function () { db.close(); rej(t.error || new Error('Gravação da foto cancelada.')); };
      });
    });
  }

  function salvar(reg) { return transacao('readwrite', function (s) { return s.put(reg); }); }
  function obter(id) { return transacao('readonly', function (s) { return s.get(id); }); }

  /** URL (object URL) para exibir/imprimir a foto; null se não existir neste aparelho. */
  function urlDe(id) {
    if (!id) return Promise.resolve(null);
    if (urls[id]) return Promise.resolve(urls[id]);
    return obter(id).then(function (r) {
      if (!r || !r.blob) return null;
      urls[id] = URL.createObjectURL(r.blob); return urls[id];
    });
  }

  function viaImg(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); res(im); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('Não foi possível ler a imagem (formato não suportado neste navegador).')); };
      im.src = u;
    });
  }
  function decodificar(file) {
    if (typeof global.createImageBitmap === 'function') {
      return global.createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }

  /** Reduz (mantendo a proporção, sem distorcer) e converte para JPEG. */
  function processarArquivo(file, maxLado) {
    maxLado = maxLado || 1600;
    if (!file) return Promise.reject(new Error('Nenhuma imagem selecionada.'));
    if (file.type && file.type.indexOf('image/') !== 0) return Promise.reject(new Error('O arquivo selecionado não é uma imagem.'));
    if (file.size > 30 * 1024 * 1024) return Promise.reject(new Error('A imagem é grande demais (máximo 30 MB).'));
    return decodificar(file).then(function (img) {
      var w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
      if (!w || !h) throw new Error('Imagem inválida.');
      var esc = Math.min(1, maxLado / Math.max(w, h)), cw = Math.round(w * esc), ch = Math.round(h * esc);
      var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
      if (img.close) img.close();
      return new Promise(function (res, rej) {
        cv.toBlob(function (b) { b ? res({ blob: b, largura: cw, altura: ch, mime: 'image/jpeg' }) : rej(new Error('Não foi possível converter a imagem.')); }, 'image/jpeg', 0.82);
      });
    });
  }

  /** Pede ao navegador para não descartar o armazenamento (melhor esforço; não garante nada). */
  function pedirPersistencia() {
    try { return global.navigator.storage && global.navigator.storage.persist ? global.navigator.storage.persist() : Promise.resolve(false); }
    catch (e) { return Promise.resolve(false); }
  }

  NS.Fotos = { salvar: salvar, obter: obter, urlDe: urlDe, processarArquivo: processarArquivo, pedirPersistencia: pedirPersistencia };
})(window);
