/**
 * scanner.js
 * Acesso à câmera e captura manual de códigos de barras/QR Code.
 * A câmera apenas exibe a imagem; BarcodeDetector só é executado após ação explícita.
 */
(function (global) {
  'use strict';

  var streamAtual = null;
  var videoAtual = null;
  var FORMATOS_DESEJADOS = [
    'qr_code', 'ean_13', 'ean_8', 'code_128',
    'code_39', 'upc_a', 'upc_e', 'itf'
  ];

  function contextoSeguro() {
    return global.isSecureContext === true;
  }

  function cameraSuportada() {
    return !!(global.navigator && global.navigator.mediaDevices &&
      global.navigator.mediaDevices.getUserMedia);
  }

  function barcodeDetectorSuportado() {
    return typeof global.BarcodeDetector === 'function' &&
      typeof global.BarcodeDetector.getSupportedFormats === 'function';
  }

  function listarCameras() {
    if (!cameraSuportada() || !global.navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve([]);
    }
    return global.navigator.mediaDevices.enumerateDevices()
      .then(function (devices) {
        return devices.filter(function (d) { return d.kind === 'videoinput'; });
      }).catch(function () { return []; });
  }

  function iniciar(videoEl, deviceId) {
    parar();
    videoAtual = videoEl;
    if (!contextoSeguro()) {
      return Promise.reject(new Error('A câmera exige HTTPS ou acesso via localhost.'));
    }
    if (!cameraSuportada()) {
      return Promise.reject(new Error('Este navegador não oferece acesso à câmera.'));
    }

    var constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    return global.navigator.mediaDevices.getUserMedia(constraints)
      .then(function (stream) {
        streamAtual = stream;
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', '');
        videoEl.muted = true;
        return videoEl.play();
      }).catch(function (e) {
        parar();
        var mensagens = {
          NotAllowedError: 'Permissão de câmera negada. Autorize o acesso à câmera nas configurações do navegador.',
          NotFoundError: 'Nenhuma câmera foi encontrada neste dispositivo.',
          NotReadableError: 'A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.',
          OverconstrainedError: 'A câmera selecionada não atende aos requisitos. Tente selecionar outra câmera.'
        };
        throw new Error(mensagens[e && e.name] ||
          ('Falha ao iniciar a câmera: ' + (e && e.message ? e.message : 'erro desconhecido')));
      });
  }

  // Executa uma única leitura por acionamento do botão de captura.
  function capturar(videoEl, onDetect, onNaoReconhecido) {
    if (!barcodeDetectorSuportado()) {
      return Promise.reject(new Error('Este navegador não oferece suporte à leitura de códigos pela câmera. Digite o código manualmente.'));
    }
    if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
      return Promise.reject(new Error('A câmera ainda está preparando a imagem. Aguarde um instante e tente novamente.'));
    }

    return global.BarcodeDetector.getSupportedFormats().then(function (suportados) {
      var formatos = FORMATOS_DESEJADOS.filter(function (formato) {
        return suportados.indexOf(formato) !== -1;
      });
      if (!formatos.length) {
        throw new Error('O navegador não informou formatos compatíveis para leitura.');
      }
      var detector = new global.BarcodeDetector({ formats: formatos });
      return detector.detect(videoEl);
    }).then(function (codigos) {
      if (!codigos || !codigos.length || !codigos[0].rawValue) {
        if (onNaoReconhecido) onNaoReconhecido('', 'nenhum código foi encontrado na área de identificação');
        return false;
      }

      var codigo = codigos[0];
      var valor = codigo.rawValue;
      var Utils = global.MeliNotepad && global.MeliNotepad.Utils;
      var leitura = Utils ? Utils.extrairIdentificadorDeCodigo(valor) : { ok: true, id: valor };
      if (!leitura.ok) {
        if (onNaoReconhecido) onNaoReconhecido(valor, leitura.motivo);
        return false;
      }
      onDetect(leitura.id, codigo.format || 'desconhecido');
      return true;
    });
  }

  function parar() {
    if (streamAtual) {
      streamAtual.getTracks().forEach(function (track) { track.stop(); });
      streamAtual = null;
    }
    if (videoAtual) {
      videoAtual.pause();
      videoAtual.srcObject = null;
      videoAtual = null;
    }
  }

  global.MeliNotepad = global.MeliNotepad || {};
  global.MeliNotepad.Scanner = {
    contextoSeguro: contextoSeguro,
    cameraSuportada: cameraSuportada,
    barcodeDetectorSuportado: barcodeDetectorSuportado,
    listarCameras: listarCameras,
    iniciar: iniciar,
    capturar: capturar,
    parar: parar
  };
})(window);
