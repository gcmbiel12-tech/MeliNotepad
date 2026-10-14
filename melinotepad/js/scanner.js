/**
 * scanner.js
 * Encapsula o acesso à câmera e a leitura de código de barras/QR Code.
 *
 * Usa a BarcodeDetector nativa do navegador (Shape Detection API).
 * Suporte real (out/2026): Chrome/Edge/Samsung Internet em Android, e Chrome
 * desktop em parte das plataformas. Firefox não suporta. Safari mantém a API
 * desativada por padrão. Por isso a digitação manual (ver app.js) é sempre
 * o caminho garantido, nunca apenas um extra.
 *
 * Acessar a câmera exige um "contexto seguro": HTTPS, ou http://localhost
 * durante o desenvolvimento. Em qualquer outro endereço http:// o navegador
 * bloqueia getUserMedia silenciosamente ou com erro de permissão.
 */
(function (global) {
  'use strict';

  var streamAtual = null;
  var detector = null;
  var loopAtivo = false;
  var rafId = null;

  function contextoSeguro() {
    return global.isSecureContext === true;
  }

  function cameraSuportada() {
    return !!(global.navigator && global.navigator.mediaDevices && global.navigator.mediaDevices.getUserMedia);
  }

  function barcodeDetectorSuportado() {
    return typeof global.BarcodeDetector === 'function';
  }

  /** Lista as câmeras disponíveis (rótulos só ficam legíveis após a permissão ser concedida). */
  function listarCameras() {
    if (!cameraSuportada() || !global.navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve([]);
    }
    return global.navigator.mediaDevices.enumerateDevices().then(function (devices) {
      return devices.filter(function (d) { return d.kind === 'videoinput'; });
    }).catch(function () {
      return [];
    });
  }

  /**
   * Inicia a câmera e o loop de detecção.
   * @param {HTMLVideoElement} videoEl
   * @param {string} [deviceId] - id de um dispositivo específico (opcional)
   * @param {function(string, string): void} onDetect - chamado com (valor, formato) a cada código novo
   * @param {function(string): void} onError - chamado com uma mensagem amigável em caso de falha
   * @returns {Promise<void>}
   */
  function iniciar(videoEl, deviceId, onDetect, onError) {
    if (!contextoSeguro()) {
      onError('A leitura pela câmera exige uma conexão segura (HTTPS) ou acesso via localhost. Use a digitação manual nesta conexão.');
      return Promise.reject(new Error('contexto inseguro'));
    }
    if (!cameraSuportada()) {
      onError('Este navegador não oferece acesso à câmera. Use a digitação manual.');
      return Promise.reject(new Error('getUserMedia indisponível'));
    }
    if (!barcodeDetectorSuportado()) {
      onError('Este navegador não é compatível com a leitura automática de códigos. Use a digitação manual.');
      return Promise.reject(new Error('BarcodeDetector indisponível'));
    }

    var constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } },
      audio: false
    };

    return global.navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      streamAtual = stream;
      videoEl.srcObject = stream;
      return videoEl.play();
    }).then(function () {
      try {
        detector = new global.BarcodeDetector();
      } catch (e) {
        detector = new global.BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf']
        });
      }
      loopAtivo = true;
      agendarDeteccao(videoEl, onDetect, onError);
    }).catch(function (e) {
      var msg = 'Não foi possível acessar a câmera.';
      if (e && e.name === 'NotAllowedError') {
        msg = 'Permissão de câmera negada. Autorize o acesso nas configurações do navegador ou use a digitação manual.';
      } else if (e && e.name === 'NotFoundError') {
        msg = 'Nenhuma câmera foi encontrada neste dispositivo. Use a digitação manual.';
      } else if (e && e.name === 'NotReadableError') {
        msg = 'A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente, ou use a digitação manual.';
      }
      onError(msg);
      pararInterno();
      throw e;
    });
  }

  function agendarDeteccao(videoEl, onDetect, onError) {
    if (!loopAtivo) return;
    detector.detect(videoEl).then(function (codigos) {
      if (codigos && codigos.length > 0) {
        var c = codigos[0];
        onDetect(c.rawValue, c.format || 'desconhecido');
      }
    }).catch(function () {
      // Falhas pontuais de um único frame não devem interromper a leitura;
      // apenas tentamos novamente no próximo quadro.
    }).then(function () {
      if (loopAtivo) {
        rafId = global.requestAnimationFrame(function () { agendarDeteccao(videoEl, onDetect, onError); });
      }
    });
  }

  function pararInterno() {
    loopAtivo = false;
    if (rafId) {
      global.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (streamAtual) {
      streamAtual.getTracks().forEach(function (t) { t.stop(); });
      streamAtual = null;
    }
    detector = null;
  }

  /** Para a câmera e o loop de detecção, liberando o dispositivo. */
  function parar() {
    pararInterno();
  }

  global.MeliNotepad = global.MeliNotepad || {};
  global.MeliNotepad.Scanner = {
    contextoSeguro: contextoSeguro,
    cameraSuportada: cameraSuportada,
    barcodeDetectorSuportado: barcodeDetectorSuportado,
    listarCameras: listarCameras,
    iniciar: iniciar,
    parar: parar
  };
})(window);
