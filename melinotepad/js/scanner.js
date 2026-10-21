
/**
 * scanner.js
 * Acesso à câmera e leitura de códigos de barras/QR Code.
 */
(function (global) {
  'use strict';

  var streamAtual = null;
  var detector = null;
  var loopAtivo = false;
  var rafId = null;
  var erroFrames = 0;
  var ultimoCodigo = '';
  var ultimoTempoCodigo = 0;
  var callbackNaoReconhecido = null;

  var FORMATOS_DESEJADOS = [
    'qr_code',
    'ean_13',
    'ean_8',
    'code_128',
    'code_39',
    'upc_a',
    'upc_e',
    'itf'
  ];

  function contextoSeguro() {
    return global.isSecureContext === true;
  }

  function cameraSuportada() {
    return !!(
      global.navigator &&
      global.navigator.mediaDevices &&
      global.navigator.mediaDevices.getUserMedia
    );
  }

  function barcodeDetectorSuportado() {
    return (
      typeof global.BarcodeDetector === 'function' &&
      typeof global.BarcodeDetector.getSupportedFormats === 'function'
    );
  }

  function listarCameras() {
    if (
      !cameraSuportada() ||
      !global.navigator.mediaDevices.enumerateDevices
    ) {
      return Promise.resolve([]);
    }

    return global.navigator.mediaDevices.enumerateDevices()
      .then(function (devices) {
        return devices.filter(function (d) {
          return d.kind === 'videoinput';
        });
      })
      .catch(function () {
        return [];
      });
  }

  // onNaoReconhecido (opcional): chamado quando o conteúdo lido não é um código
  // utilizável (ex.: JSON sem "id"). A leitura continua; nada é entregue a onDetect.
  function iniciar(videoEl, deviceId, onDetect, onError, onNaoReconhecido) {
    pararInterno();
    callbackNaoReconhecido = typeof onNaoReconhecido === 'function' ? onNaoReconhecido : null;

    if (!contextoSeguro()) {
      var erroSeguro = new Error(
        'A câmera exige HTTPS ou acesso via localhost.'
      );
      onError(erroSeguro.message);
      return Promise.reject(erroSeguro);
    }

    if (!cameraSuportada()) {
      var erroCamera = new Error(
        'Este navegador não oferece acesso à câmera.'
      );
      onError(erroCamera.message);
      return Promise.reject(erroCamera);
    }

    if (!barcodeDetectorSuportado()) {
      var erroDetector = new Error(
        'Este navegador não oferece suporte completo à leitura automática. ' +
        'Use um navegador compatível ou digite o código manualmente.'
      );
      onError(erroDetector.message);
      return Promise.reject(erroDetector);
    }

    var constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
      audio: false
    };

    return global.navigator.mediaDevices
      .getUserMedia(constraints)
      .then(function (stream) {
        streamAtual = stream;
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', '');
        videoEl.muted = true;

        return videoEl.play();
      })
      .then(function () {
        return global.BarcodeDetector.getSupportedFormats();
      })
      .then(function (suportados) {
        var formatos = FORMATOS_DESEJADOS.filter(function (formato) {
          return suportados.indexOf(formato) !== -1;
        });

        if (formatos.length === 0) {
          throw new Error(
            'A câmera abriu, mas o navegador não informou formatos ' +
            'de código compatíveis para leitura.'
          );
        }

        detector = new global.BarcodeDetector({
          formats: formatos
        });

        console.info(
          '[MeliNotepad] Formatos de leitura disponíveis:',
          formatos
        );

        erroFrames = 0;
        ultimoCodigo = '';
        ultimoTempoCodigo = 0;
        loopAtivo = true;

        agendarDeteccao(videoEl, onDetect, onError);
      })
      .catch(function (e) {
        pararInterno();

        var msg;

        if (e && e.name === 'NotAllowedError') {
          msg =
            'Permissão de câmera negada. Autorize o acesso à câmera ' +
            'nas configurações do navegador.';
        } else if (e && e.name === 'NotFoundError') {
          msg = 'Nenhuma câmera foi encontrada neste dispositivo.';
        } else if (e && e.name === 'NotReadableError') {
          msg =
            'A câmera está sendo usada por outro aplicativo. ' +
            'Feche-o e tente novamente.';
        } else if (e && e.name === 'OverconstrainedError') {
          msg =
            'A câmera selecionada não atende aos requisitos. ' +
            'Tente selecionar outra câmera.';
        } else {
          msg = 'Falha ao iniciar a leitura: ' +
            (e && e.message ? e.message : 'erro desconhecido');
        }

        onError(msg);
        throw e;
      });
  }

  function agendarDeteccao(videoEl, onDetect, onError) {
    if (!loopAtivo || !detector) return;

    if (
      videoEl.readyState < 2 ||
      videoEl.videoWidth === 0 ||
      videoEl.videoHeight === 0
    ) {
      rafId = global.requestAnimationFrame(function () {
        agendarDeteccao(videoEl, onDetect, onError);
      });
      return;
    }

    detector.detect(videoEl)
      .then(function (codigos) {
        erroFrames = 0;

        if (!codigos || codigos.length === 0) return;

        var codigo = codigos[0];
        var valor = codigo.rawValue;

        if (!valor) return;

        var agora = Date.now();

        // Evita registrar repetidamente o mesmo código
        // enquanto ele permanece diante da câmera.
        if (
          valor === ultimoCodigo &&
          agora - ultimoTempoCodigo < 2000
        ) {
          return;
        }

        ultimoCodigo = valor;
        ultimoTempoCodigo = agora;

        // Interpreta o conteúdo (ex.: {"id":"4819...","t":"lm"} -> "4819...") ANTES de
        // qualquer campo ser preenchido ou registro ser criado.
        var Utils = global.MeliNotepad && global.MeliNotepad.Utils;
        var leitura = Utils ? Utils.extrairIdentificadorDeCodigo(valor) : { ok: true, id: valor };
        if (!leitura.ok) {
          if (callbackNaoReconhecido) callbackNaoReconhecido(valor, leitura.motivo);
          return;
        }
        onDetect(leitura.id, codigo.format || 'desconhecido');
      })
      .catch(function (e) {
        erroFrames++;

        // Não interrompe por uma falha isolada de leitura.
        // Após várias falhas consecutivas, informa o problema.
        if (erroFrames === 10) {
          console.warn(
            '[MeliNotepad] Falhas consecutivas na detecção:',
            e
          );

          if (onError) {
            onError(
              'A câmera está aberta, mas o leitor está encontrando ' +
              'falhas ao processar as imagens. Tente fechar e abrir ' +
              'a câmera novamente.'
            );
          }
        }
      })
      .then(function () {
        if (loopAtivo) {
          rafId = global.requestAnimationFrame(function () {
            agendarDeteccao(videoEl, onDetect, onError);
          });
        }
      });
  }

  function pararInterno() {
    loopAtivo = false;

    if (rafId !== null) {
      global.cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (streamAtual) {
      streamAtual.getTracks().forEach(function (track) {
        track.stop();
      });
      streamAtual = null;
    }

    detector = null;
  }

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
