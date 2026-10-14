/**
 * app.js
 * Orquestra a interface: mantém o estado em memória, chama storage.js para
 * persistir, scanner.js para a câmera e report.js para os relatórios.
 * Nenhum HTML de dados do usuário é inserido via innerHTML — sempre
 * createElement()/textContent, para eliminar risco de HTML executável.
 */
(function () {
  'use strict';

  var C = window.MeliNotepad.Constants;
  var U = window.MeliNotepad.Utils;
  var Storage = window.MeliNotepad.Storage;
  var Scanner = window.MeliNotepad.Scanner;
  var Report = window.MeliNotepad.Report;

  // -----------------------------------------------------------------------
  // Estado em memória
  // -----------------------------------------------------------------------
  var estado = {
    dados: null,
    filtros: { categoria: '', status: '', codigo: '' },
    editandoOcorrenciaId: null,
    importPendente: null,
    historicoAbertoId: null
  };

  // Trava de reentrância simples: impede que um clique duplo real (dois
  // eventos de clique praticamente simultâneos) crie dois registros a
  // partir do mesmo envio do formulário. Diferente de um temporizador fixo,
  // ela libera assim que o registro atual termina, sem atrapalhar o
  // próximo código digitado ou lido em seguida — fluxo comum na conferência.
  var registrandoOcorrencia = false;

  // -----------------------------------------------------------------------
  // Referências de DOM (preenchidas em init())
  // -----------------------------------------------------------------------
  var $ = {};

  function mapearElementos() {
    var ids = [
      'status-chip', 'btn-ver-sessao', 'btn-ver-historico', 'avisos-sistema',
      'view-sessao', 'view-historico',
      'painel-inicio', 'form-iniciar-sessao', 'input-sacas', 'input-pacotes', 'pacotes-formatado',
      'painel-sessao-ativa', 'btn-editar-totais', 'btn-nova-sessao-bloqueio',
      'info-data', 'info-sacas', 'info-pacotes',
      'form-editar-totais', 'input-sacas-edit', 'input-pacotes-edit', 'btn-cancelar-editar-totais',
      'btn-abrir-camera', 'btn-fechar-camera', 'label-select-camera', 'select-camera', 'video-camera', 'aviso-camera',
      'form-registrar-ocorrencia', 'input-codigo', 'select-categoria', 'input-observacao',
      'contagem-total', 'contagem-pendente', 'contagem-resolvida',
      'filtro-categoria', 'filtro-status', 'filtro-codigo', 'btn-limpar-filtros',
      'lista-ocorrencias-vazia', 'lista-ocorrencias',
      'btn-pre-visualizar', 'btn-finalizar-sessao', 'painel-relatorio', 'texto-relatorio',
      'area-copia-manual',
      'lista-historico', 'historico-vazio',
      'detalhe-historico', 'detalhe-historico-info', 'detalhe-historico-ocorrencias', 'detalhe-historico-relatorio',
      'btn-fechar-detalhe-historico', 'btn-copiar-resumo-historico', 'btn-gerar-pdf-historico', 'aviso-copiar-historico',
      'btn-restaurar-relatorio-historico', 'btn-excluir-sessao-historico',
      'btn-exportar-backup', 'btn-importar-backup', 'input-importar-arquivo',
      'modal-confirmar', 'modal-confirmar-titulo', 'modal-confirmar-mensagem', 'modal-confirmar-cancelar', 'modal-confirmar-ok',
      'modal-editar', 'form-editar-ocorrencia', 'edit-codigo', 'edit-categoria', 'edit-observacao', 'btn-cancelar-editar',
      'modal-importar', 'modal-importar-resumo', 'btn-cancelar-importar', 'btn-confirmar-importar',
      'modal-sessao-bloqueio', 'btn-bloqueio-finalizar', 'btn-bloqueio-descartar', 'btn-bloqueio-cancelar',
      'modal-finalizar', 'modal-finalizar-aviso-pendentes', 'form-finalizar', 'finalizar-horario', 'btn-cancelar-finalizar',
      'print-area', 'toast-container'
    ];
    ids.forEach(function (id) {
      $[camelizar(id)] = document.getElementById(id);
    });
  }

  function camelizar(id) {
    return id.replace(/-([a-z0-9])/g, function (_, c) { return c.toUpperCase(); });
  }

  // -----------------------------------------------------------------------
  // Utilidades de interface: toast e diálogo de confirmação genérico
  // -----------------------------------------------------------------------

  function toast(mensagem, tipo) {
    var div = document.createElement('div');
    div.className = 'toast toast--' + (tipo || 'info');
    div.setAttribute('role', 'status');
    div.textContent = mensagem;
    $.toastContainer.appendChild(div);
    setTimeout(function () {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 4500);
  }

  function confirmar(opcoes) {
    return new Promise(function (resolve) {
      $.modalConfirmarTitulo.textContent = opcoes.titulo || 'Confirmar ação';
      $.modalConfirmarMensagem.textContent = opcoes.mensagem || '';
      $.modalConfirmarOk.textContent = opcoes.confirmarLabel || 'Confirmar';
      $.modalConfirmarCancelar.textContent = opcoes.cancelarLabel || 'Cancelar';
      $.modalConfirmarOk.className = 'botao ' + (opcoes.perigo ? 'botao--perigo' : 'botao--primario');

      function limpar() {
        $.modalConfirmarOk.removeEventListener('click', onOk);
        $.modalConfirmarCancelar.removeEventListener('click', onCancelar);
        $.modalConfirmar.removeEventListener('cancel', onCancelEvt);
      }
      function onOk() { limpar(); $.modalConfirmar.close(); resolve(true); }
      function onCancelar() { limpar(); $.modalConfirmar.close(); resolve(false); }
      function onCancelEvt() { limpar(); resolve(false); }

      $.modalConfirmarOk.addEventListener('click', onOk);
      $.modalConfirmarCancelar.addEventListener('click', onCancelar);
      $.modalConfirmar.addEventListener('cancel', onCancelEvt);
      $.modalConfirmar.showModal();
    });
  }

  function avisoSistema(mensagem) {
    if (!mensagem) return;
    var div = document.createElement('div');
    div.className = 'aviso-sistema';
    div.textContent = mensagem;
    $.avisosSistema.appendChild(div);
  }

  // -----------------------------------------------------------------------
  // Persistência
  // -----------------------------------------------------------------------

  function persistir() {
    var resultado = Storage.salvarDados(estado.dados);
    if (!resultado.sucesso) {
      toast(resultado.erro, 'erro');
    }
    return resultado.sucesso;
  }

  function sessaoAtiva() {
    return estado.dados.currentSession;
  }

  // -----------------------------------------------------------------------
  // Inicialização de selects estáticos (categorias)
  // -----------------------------------------------------------------------

  function popularSelectCategorias(selectEl, incluirTodas) {
    while (selectEl.firstChild) selectEl.removeChild(selectEl.firstChild);
    if (incluirTodas) {
      var optTodas = document.createElement('option');
      optTodas.value = '';
      optTodas.textContent = 'Todas';
      selectEl.appendChild(optTodas);
    } else {
      var optPlaceholder = document.createElement('option');
      optPlaceholder.value = '';
      optPlaceholder.textContent = 'Selecione uma categoria';
      optPlaceholder.disabled = true;
      optPlaceholder.selected = true;
      selectEl.appendChild(optPlaceholder);
    }
    C.CATEGORIES.forEach(function (cat) {
      var opt = document.createElement('option');
      opt.value = cat.key;
      opt.textContent = cat.label;
      selectEl.appendChild(opt);
    });
  }

  // -----------------------------------------------------------------------
  // Renderização: cabeçalho / navegação
  // -----------------------------------------------------------------------

  function renderStatusChip() {
    var sessao = sessaoAtiva();
    $.statusChip.classList.remove('chip--neutro', 'chip--ativo');
    if (sessao) {
      $.statusChip.textContent = 'Em andamento';
      $.statusChip.classList.add('chip--ativo');
    } else {
      $.statusChip.textContent = 'Sem sessão ativa';
      $.statusChip.classList.add('chip--neutro');
    }
  }

  function mudarView(nome) {
    var sessaoView = nome === 'sessao';
    $.viewSessao.hidden = !sessaoView;
    $.viewHistorico.hidden = sessaoView;
    $.btnVerSessao.classList.toggle('is-ativo', sessaoView);
    $.btnVerHistorico.classList.toggle('is-ativo', !sessaoView);
    $.btnVerSessao.setAttribute('aria-pressed', String(sessaoView));
    $.btnVerHistorico.setAttribute('aria-pressed', String(!sessaoView));
  }

  // -----------------------------------------------------------------------
  // Renderização: painel principal (início / sessão ativa)
  // -----------------------------------------------------------------------

  function renderPainelPrincipal() {
    var sessao = sessaoAtiva();
    $.painelInicio.hidden = !!sessao;
    $.painelSessaoAtiva.hidden = !sessao;
    if (!sessao) return;

    $.infoData.textContent = U.formatarData(sessao.startTime);
    $.infoSacas.textContent = U.formatarNumeroBR(sessao.sacas);
    $.infoPacotes.textContent = U.formatarNumeroBR(sessao.pacotes);
  }

  // -----------------------------------------------------------------------
  // Renderização: lista de ocorrências (+ filtros e contadores)
  // -----------------------------------------------------------------------

  function ocorrenciasFiltradas(lista) {
    var f = estado.filtros;
    return lista.filter(function (o) {
      if (f.categoria && o.category !== f.categoria) return false;
      if (f.status && o.status !== f.status) return false;
      if (f.codigo) {
        var alvo = o.code.toLowerCase();
        if (alvo.indexOf(f.codigo.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  function criarItemOcorrencia(o, somenteLeitura) {
    var li = document.createElement('li');
    li.className = 'item-ocorrencia item-ocorrencia--' + o.status;
    li.dataset.id = o.id;

    var cabecalho = document.createElement('div');
    cabecalho.className = 'item-ocorrencia__cabecalho';

    var codigo = document.createElement('span');
    codigo.className = 'item-ocorrencia__codigo';
    codigo.textContent = o.code;
    cabecalho.appendChild(codigo);

    var statusBadge = document.createElement('span');
    statusBadge.className = 'badge badge--' + o.status;
    statusBadge.textContent = C.STATUS_LABEL[o.status];
    cabecalho.appendChild(statusBadge);

    li.appendChild(cabecalho);

    var categoria = document.createElement('p');
    categoria.className = 'item-ocorrencia__categoria';
    categoria.textContent = C.categoriaLabel(o.category);
    li.appendChild(categoria);

    var meta = document.createElement('p');
    meta.className = 'item-ocorrencia__meta';
    meta.textContent = 'Registrado em ' + U.formatarDataHora(o.createdAt);
    if (o.updatedAt && o.updatedAt !== o.createdAt) {
      meta.textContent += ' • Atualizado em ' + U.formatarDataHora(o.updatedAt);
    }
    li.appendChild(meta);

    if (o.note) {
      var nota = document.createElement('p');
      nota.className = 'item-ocorrencia__nota';
      nota.textContent = o.note;
      li.appendChild(nota);
    }

    if (!somenteLeitura) {
      var acoes = document.createElement('div');
      acoes.className = 'item-ocorrencia__acoes';

      var btnToggle = document.createElement('button');
      btnToggle.type = 'button';
      btnToggle.className = 'botao botao--texto';
      btnToggle.dataset.action = o.status === C.STATUS.PENDENTE ? 'resolver' : 'reabrir';
      btnToggle.textContent = o.status === C.STATUS.PENDENTE ? 'Marcar resolvida' : 'Reabrir';
      acoes.appendChild(btnToggle);

      var btnEditar = document.createElement('button');
      btnEditar.type = 'button';
      btnEditar.className = 'botao botao--texto';
      btnEditar.dataset.action = 'editar';
      btnEditar.textContent = 'Editar';
      acoes.appendChild(btnEditar);

      var btnExcluir = document.createElement('button');
      btnExcluir.type = 'button';
      btnExcluir.className = 'botao botao--texto botao--perigo-texto';
      btnExcluir.dataset.action = 'excluir';
      btnExcluir.textContent = 'Excluir';
      acoes.appendChild(btnExcluir);

      li.appendChild(acoes);
    }

    return li;
  }

  function renderListaOcorrencias() {
    var sessao = sessaoAtiva();
    if (!sessao) return;

    var total = sessao.occurrences.length;
    var pendentes = sessao.occurrences.filter(function (o) { return o.status === C.STATUS.PENDENTE; }).length;
    $.contagemTotal.textContent = String(total);
    $.contagemPendente.textContent = String(pendentes);
    $.contagemResolvida.textContent = String(total - pendentes);

    var filtradas = ocorrenciasFiltradas(sessao.occurrences).slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    while ($.listaOcorrencias.firstChild) $.listaOcorrencias.removeChild($.listaOcorrencias.firstChild);
    $.listaOcorrenciasVazia.hidden = filtradas.length > 0;
    filtradas.forEach(function (o) {
      $.listaOcorrencias.appendChild(criarItemOcorrencia(o, false));
    });
  }

  // -----------------------------------------------------------------------
  // Renderização: histórico
  // -----------------------------------------------------------------------

  function renderHistoricoLista() {
    var historico = estado.dados.history.slice().sort(function (a, b) {
      return new Date(b.endTime || b.startTime) - new Date(a.endTime || a.startTime);
    });

    while ($.listaHistorico.firstChild) $.listaHistorico.removeChild($.listaHistorico.firstChild);
    $.historicoVazio.hidden = historico.length > 0;

    historico.forEach(function (sessao) {
      var status = Report.contarStatus(sessao.occurrences);
      var li = document.createElement('li');
      li.className = 'item-historico';

      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'item-historico__botao';
      botao.dataset.id = sessao.id;

      var linha1 = document.createElement('span');
      linha1.className = 'item-historico__data';
      linha1.textContent = U.formatarData(sessao.startTime) + ' • Finalizado às ' + (sessao.endTime ? U.formatarHora(sessao.endTime) : '—');
      botao.appendChild(linha1);

      var linha2 = document.createElement('span');
      linha2.className = 'item-historico__resumo';
      linha2.textContent = 'Sacas: ' + U.formatarNumeroBR(sessao.sacas) + ' • Pacotes: ' + U.formatarNumeroBR(sessao.pacotes) +
        ' • Ocorrências: ' + status.total + ' (' + status.pendentes + ' pendentes, ' + status.resolvidas + ' resolvidas)';
      botao.appendChild(linha2);

      li.appendChild(botao);
      $.listaHistorico.appendChild(li);
    });
  }

  function abrirDetalheHistorico(sessaoId) {
    var sessao = estado.dados.history.find(function (s) { return s.id === sessaoId; });
    if (!sessao) return;
    estado.historicoAbertoId = sessaoId;

    while ($.detalheHistoricoInfo.firstChild) $.detalheHistoricoInfo.removeChild($.detalheHistoricoInfo.firstChild);
    var campos = [
      ['Data', U.formatarData(sessao.startTime)],
      ['Finalização', sessao.endTime ? U.formatarHora(sessao.endTime) : '—'],
      ['Sacas', U.formatarNumeroBR(sessao.sacas)],
      ['Pacotes', U.formatarNumeroBR(sessao.pacotes)]
    ];
    campos.forEach(function (par) {
      var div = document.createElement('div');
      var dt = document.createElement('dt');
      dt.textContent = par[0];
      var dd = document.createElement('dd');
      dd.textContent = par[1];
      div.appendChild(dt);
      div.appendChild(dd);
      $.detalheHistoricoInfo.appendChild(div);
    });

    while ($.detalheHistoricoOcorrencias.firstChild) $.detalheHistoricoOcorrencias.removeChild($.detalheHistoricoOcorrencias.firstChild);
    sessao.occurrences.slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }).forEach(function (o) {
      $.detalheHistoricoOcorrencias.appendChild(criarItemOcorrencia(o, true));
    });

    $.detalheHistoricoRelatorio.value = Report.gerarTextoRelatorio(sessao);
    $.avisoCopiarHistorico.textContent = '';
    $.detalheHistorico.hidden = false;
  }

  function fecharDetalheHistorico() {
    estado.historicoAbertoId = null;
    $.detalheHistorico.hidden = true;
  }

  function sessaoHistoricoAberta() {
    return estado.dados.history.find(function (s) { return s.id === estado.historicoAbertoId; });
  }

  function restaurarRelatorioHistorico() {
    var sessao = sessaoHistoricoAberta();
    if (!sessao) return;
    $.detalheHistoricoRelatorio.value = Report.gerarTextoRelatorio(sessao);
    toast('Texto do relatório restaurado.', 'info');
  }

  function excluirSessaoHistorico() {
    var sessao = sessaoHistoricoAberta();
    if (!sessao) return;
    var status = Report.contarStatus(sessao.occurrences);
    confirmar({
      titulo: 'Excluir sessão do histórico',
      mensagem: 'Excluir a conferência de ' + U.formatarData(sessao.startTime) + ' (' + status.total + ' ocorrência(s))? Esta ação não pode ser desfeita e não existe backup automático — exporte um backup antes, se precisar guardar esses dados.',
      confirmarLabel: 'Excluir sessão',
      cancelarLabel: 'Cancelar',
      perigo: true
    }).then(function (ok) {
      if (!ok) return;
      estado.dados.history = estado.dados.history.filter(function (s) { return s.id !== sessao.id; });
      if (!persistir()) return;
      fecharDetalheHistorico();
      renderHistoricoLista();
      toast('Sessão excluída do histórico.', 'info');
    });
  }

  // -----------------------------------------------------------------------
  // Render geral
  // -----------------------------------------------------------------------

  function renderTudo() {
    renderStatusChip();
    renderPainelPrincipal();
    if (sessaoAtiva()) renderListaOcorrencias();
    renderHistoricoLista();
  }

  // -----------------------------------------------------------------------
  // Eventos: iniciar sessão
  // -----------------------------------------------------------------------

  function aoEnviarIniciarSessao(e) {
    e.preventDefault();
    var sacas = $.inputSacas.value;
    var pacotes = $.inputPacotes.value;
    if (!U.ehInteiroNaoNegativo(sacas) || !U.ehInteiroNaoNegativo(pacotes)) {
      toast('Informe números inteiros não negativos para sacas e pacotes.', 'erro');
      return;
    }
    var agora = U.agora().toISOString();
    var novaSessao = {
      id: U.gerarId('sess'),
      startTime: agora,
      endTime: null,
      status: C.SESSION_STATUS.EM_ANDAMENTO,
      sacas: parseInt(sacas, 10),
      pacotes: parseInt(pacotes, 10),
      occurrences: []
    };
    estado.dados.currentSession = novaSessao;
    if (!persistir()) return;
    $.formIniciarSessao.reset();
    $.pacotesFormatado.textContent = '';
    renderTudo();
    toast('Conferência iniciada.', 'sucesso');
  }

  function aoDigitarPacotes() {
    var v = $.inputPacotes.value;
    $.pacotesFormatado.textContent = U.ehInteiroNaoNegativo(v) ? 'Será exibido como ' + U.formatarNumeroBR(v) : '';
  }

  // -----------------------------------------------------------------------
  // Eventos: editar totais
  // -----------------------------------------------------------------------

  function abrirEdicaoTotais() {
    var sessao = sessaoAtiva();
    $.inputSacasEdit.value = sessao.sacas;
    $.inputPacotesEdit.value = sessao.pacotes;
    $.formEditarTotais.hidden = false;
  }

  function cancelarEdicaoTotais() {
    $.formEditarTotais.hidden = true;
  }

  function aoSalvarTotais(e) {
    e.preventDefault();
    var sacas = $.inputSacasEdit.value;
    var pacotes = $.inputPacotesEdit.value;
    if (!U.ehInteiroNaoNegativo(sacas) || !U.ehInteiroNaoNegativo(pacotes)) {
      toast('Informe números inteiros não negativos para sacas e pacotes.', 'erro');
      return;
    }
    var sessao = sessaoAtiva();
    sessao.sacas = parseInt(sacas, 10);
    sessao.pacotes = parseInt(pacotes, 10);
    if (!persistir()) return;
    $.formEditarTotais.hidden = true;
    renderPainelPrincipal();
    toast('Totais atualizados.', 'sucesso');
  }

  // -----------------------------------------------------------------------
  // Eventos: bloqueio de nova sessão
  // -----------------------------------------------------------------------

  function abrirBloqueioNovaSessao() {
    $.modalSessaoBloqueio.showModal();
  }

  function aoClicarBloqueioFinalizar() {
    $.modalSessaoBloqueio.close();
    document.getElementById('titulo-finalizar').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function aoClicarBloqueioCancelar() {
    $.modalSessaoBloqueio.close();
  }

  function aoClicarBloqueioDescartar() {
    $.modalSessaoBloqueio.close();
    var sessao = sessaoAtiva();
    var qtd = sessao.occurrences.length;
    var mensagem = qtd > 0
      ? 'Todas as ' + qtd + ' ocorrências registradas nesta sessão serão perdidas permanentemente. Esta ação não pode ser desfeita.'
      : 'Esta sessão não possui ocorrências registradas. Esta ação não pode ser desfeita.';
    confirmar({
      titulo: 'Descartar sessão atual',
      mensagem: mensagem,
      confirmarLabel: 'Descartar sessão',
      cancelarLabel: 'Cancelar',
      perigo: true
    }).then(function (ok) {
      if (!ok) return;
      estado.dados.currentSession = null;
      if (!persistir()) return;
      renderTudo();
      toast('Sessão descartada.', 'info');
    });
  }

  // -----------------------------------------------------------------------
  // Eventos: câmera
  // -----------------------------------------------------------------------

  function resetarUiCamera() {
    $.btnAbrirCamera.hidden = false;
    $.btnFecharCamera.hidden = true;
    $.videoCamera.hidden = true;
    $.selectCamera.hidden = true;
    $.labelSelectCamera.hidden = true;
  }

  function aoDetectarCodigo(valor, formato) {
    Scanner.parar();
    resetarUiCamera();
    $.inputCodigo.value = U.normalizarTexto(valor);
    $.avisoCamera.textContent = 'Código lido (' + formato + '). Confira e registre abaixo.';
    $.selectCategoria.focus();
  }

  function aoErroCamera(mensagem) {
    resetarUiCamera();
    $.avisoCamera.textContent = mensagem;
  }

  function abrirCamera() {
    $.avisoCamera.textContent = '';
    if (!Scanner.cameraSuportada() || !Scanner.barcodeDetectorSuportado()) {
      aoErroCamera('Este navegador não é compatível com a leitura de código pela câmera. Digite o código manualmente abaixo.');
      return;
    }
    $.videoCamera.hidden = false;
    $.btnAbrirCamera.hidden = true;
    $.btnFecharCamera.hidden = false;

    Scanner.iniciar($.videoCamera, null, aoDetectarCodigo, aoErroCamera).then(function () {
      return Scanner.listarCameras();
    }).then(function (cameras) {
      if (cameras.length > 1) {
        while ($.selectCamera.firstChild) $.selectCamera.removeChild($.selectCamera.firstChild);
        cameras.forEach(function (c, i) {
          var opt = document.createElement('option');
          opt.value = c.deviceId;
          opt.textContent = c.label || ('Câmera ' + (i + 1));
          $.selectCamera.appendChild(opt);
        });
        $.selectCamera.hidden = false;
        $.labelSelectCamera.hidden = false;
      }
    }).catch(function () { /* erro já tratado em aoErroCamera */ });
  }

  function fecharCamera() {
    Scanner.parar();
    resetarUiCamera();
    $.avisoCamera.textContent = '';
  }

  function aoTrocarCamera() {
    var deviceId = $.selectCamera.value;
    Scanner.parar();
    Scanner.iniciar($.videoCamera, deviceId, aoDetectarCodigo, aoErroCamera);
  }

  // -----------------------------------------------------------------------
  // Eventos: registrar ocorrência
  // -----------------------------------------------------------------------

  function buscarDuplicados(codigo) {
    var sessao = sessaoAtiva();
    var alvo = U.normalizarCodigoParaComparacao(codigo);
    return sessao.occurrences.filter(function (o) {
      return U.normalizarCodigoParaComparacao(o.code) === alvo;
    });
  }

  function salvarNovaOcorrencia(codigo, categoria, status, nota) {
    var sessao = sessaoAtiva();
    var agora = U.agora().toISOString();
    sessao.occurrences.push({
      id: U.gerarId('occ'),
      code: codigo,
      category: categoria,
      status: status,
      createdAt: agora,
      updatedAt: agora,
      note: nota || undefined
    });
    if (!persistir()) return false;
    renderListaOcorrencias();
    return true;
  }

  /** Lê o status marcado nos botões segmentados do formulário de registro ('' se nenhum marcado). */
  function statusEscolhidoNoFormulario() {
    var marcado = $.formRegistrarOcorrencia.querySelector('input[name="status-ocorrencia"]:checked');
    return marcado ? marcado.value : '';
  }

  function limparSelecaoDeStatus() {
    var radios = $.formRegistrarOcorrencia.querySelectorAll('input[name="status-ocorrencia"]');
    radios.forEach(function (r) { r.checked = false; });
  }

  function aoEnviarRegistrarOcorrencia(e) {
    e.preventDefault();
    if (registrandoOcorrencia) return;

    var codigo = U.normalizarTexto($.inputCodigo.value);
    var categoria = $.selectCategoria.value;
    var status = statusEscolhidoNoFormulario();
    var nota = U.normalizarTexto($.inputObservacao.value);

    if (!codigo) {
      toast('Informe o código do pacote.', 'erro');
      return;
    }
    if (!categoria) {
      toast('Selecione a categoria da ocorrência.', 'erro');
      return;
    }
    if (!status) {
      toast('Selecione o status da ocorrência: Pendente ou Resolvido.', 'erro');
      return;
    }

    registrandoOcorrencia = true;

    var duplicados = buscarDuplicados(codigo);
    var prosseguir;
    if (duplicados.length > 0) {
      var categoriasEncontradas = Array.from(new Set(duplicados.map(function (o) {
        return C.categoriaLabel(o.category) + ' (' + C.STATUS_LABEL[o.status] + ')';
      }))).join('; ');
      prosseguir = confirmar({
        titulo: 'Código já registrado nesta sessão',
        mensagem: 'O código "' + codigo + '" já aparece em: ' + categoriasEncontradas + '. Deseja registrar mesmo assim?',
        confirmarLabel: 'Registrar mesmo assim',
        cancelarLabel: 'Cancelar'
      });
    } else {
      prosseguir = Promise.resolve(true);
    }

    prosseguir.then(function (ok) {
      if (!ok) { registrandoOcorrencia = false; return; }
      var sucesso = salvarNovaOcorrencia(codigo, categoria, status, nota);
      registrandoOcorrencia = false;
      if (!sucesso) return;
      $.inputCodigo.value = '';
      $.inputObservacao.value = '';
      limparSelecaoDeStatus();
      $.inputCodigo.focus();
      toast('Ocorrência registrada.', 'sucesso');
    });
  }

  // -----------------------------------------------------------------------
  // Eventos: ações na lista de ocorrências (delegação de evento)
  // -----------------------------------------------------------------------

  function aoClicarListaOcorrencias(e) {
    var botao = e.target.closest('button[data-action]');
    if (!botao) return;
    var li = botao.closest('.item-ocorrencia');
    var id = li && li.dataset.id;
    if (!id) return;
    var sessao = sessaoAtiva();
    var ocorrencia = sessao.occurrences.find(function (o) { return o.id === id; });
    if (!ocorrencia) return;

    var acao = botao.dataset.action;
    if (acao === 'resolver' || acao === 'reabrir') {
      ocorrencia.status = acao === 'resolver' ? C.STATUS.RESOLVIDO : C.STATUS.PENDENTE;
      ocorrencia.updatedAt = U.agora().toISOString();
      if (!persistir()) return;
      renderListaOcorrencias();
    } else if (acao === 'editar') {
      abrirEdicaoOcorrencia(ocorrencia);
    } else if (acao === 'excluir') {
      confirmar({
        titulo: 'Excluir ocorrência',
        mensagem: 'Remover o código "' + ocorrencia.code + '" desta sessão? Esta ação não pode ser desfeita.',
        confirmarLabel: 'Excluir',
        cancelarLabel: 'Cancelar',
        perigo: true
      }).then(function (ok) {
        if (!ok) return;
        sessao.occurrences = sessao.occurrences.filter(function (o) { return o.id !== id; });
        if (!persistir()) return;
        renderListaOcorrencias();
        toast('Ocorrência excluída.', 'info');
      });
    }
  }

  // -----------------------------------------------------------------------
  // Eventos: editar ocorrência (modal)
  // -----------------------------------------------------------------------

  function abrirEdicaoOcorrencia(ocorrencia) {
    estado.editandoOcorrenciaId = ocorrencia.id;
    $.editCodigo.value = ocorrencia.code;
    $.editCategoria.value = ocorrencia.category;
    $.editObservacao.value = ocorrencia.note || '';
    $.modalEditar.showModal();
  }

  function aoEnviarEditarOcorrencia(e) {
    e.preventDefault();
    var sessao = sessaoAtiva();
    var ocorrencia = sessao.occurrences.find(function (o) { return o.id === estado.editandoOcorrenciaId; });
    if (!ocorrencia) { $.modalEditar.close(); return; }

    var codigo = U.normalizarTexto($.editCodigo.value);
    var categoria = $.editCategoria.value;
    var nota = U.normalizarTexto($.editObservacao.value);

    if (!codigo || !categoria) {
      toast('Informe o código e a categoria.', 'erro');
      return;
    }

    ocorrencia.code = codigo;
    ocorrencia.category = categoria;
    ocorrencia.note = nota || undefined;
    ocorrencia.updatedAt = U.agora().toISOString();

    if (!persistir()) return;
    $.modalEditar.close();
    renderListaOcorrencias();
    toast('Ocorrência atualizada.', 'sucesso');
  }

  // -----------------------------------------------------------------------
  // Eventos: filtros
  // -----------------------------------------------------------------------

  function aoMudarFiltros() {
    estado.filtros.categoria = $.filtroCategoria.value;
    estado.filtros.status = $.filtroStatus.value;
    estado.filtros.codigo = $.filtroCodigo.value;
    renderListaOcorrencias();
  }

  function limparFiltros() {
    $.filtroCategoria.value = '';
    $.filtroStatus.value = '';
    $.filtroCodigo.value = '';
    estado.filtros = { categoria: '', status: '', codigo: '' };
    renderListaOcorrencias();
  }

  // -----------------------------------------------------------------------
  // Eventos: pré-visualizar e finalizar
  // -----------------------------------------------------------------------

  function preVisualizarRelatorio() {
    var sessao = sessaoAtiva();
    $.textoRelatorio.textContent = Report.gerarTextoRelatorio(sessao);
    $.painelRelatorio.hidden = false;
    $.painelRelatorio.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function finalizarSessao() {
    var sessao = sessaoAtiva();
    var pendentes = sessao.occurrences.filter(function (o) { return o.status === C.STATUS.PENDENTE; }).length;

    if (pendentes > 0) {
      $.modalFinalizarAvisoPendentes.textContent = pendentes + ' ocorrência(s) ainda está(ão) pendente(s). Elas continuam pendentes no relatório — isso não impede a finalização, mas confira se não esqueceu nada.';
      $.modalFinalizarAvisoPendentes.hidden = false;
    } else {
      $.modalFinalizarAvisoPendentes.hidden = true;
    }

    // Horário de finalização vem preenchido com "agora" por conveniência, mas é
    // sempre digitado/confirmado manualmente pelo usuário — nunca gravado sozinho.
    $.finalizarHorario.value = U.paraDatetimeLocal(U.agora());
    $.modalFinalizar.showModal();
  }

  function aoConfirmarFinalizar(e) {
    e.preventDefault();
    var valor = $.finalizarHorario.value;
    if (!valor) {
      toast('Informe a data e o horário de finalização.', 'erro');
      return;
    }
    var dataFinal = new Date(valor);
    if (isNaN(dataFinal.getTime())) {
      toast('Data/horário de finalização inválido.', 'erro');
      return;
    }

    var sessao = sessaoAtiva();
    sessao.endTime = dataFinal.toISOString();
    sessao.status = C.SESSION_STATUS.FINALIZADA;
    estado.dados.history.push(JSON.parse(JSON.stringify(sessao)));
    estado.dados.currentSession = null;
    if (!persistir()) return;

    $.modalFinalizar.close();
    $.painelRelatorio.hidden = true;
    renderTudo();
    mudarView('historico');
    abrirDetalheHistorico(sessao.id);
    toast('Conferência finalizada.', 'sucesso');
  }

  // -----------------------------------------------------------------------
  // Copiar resumo (compartilhado entre sessão ativa e histórico)
  // -----------------------------------------------------------------------

  function copiarTexto(texto, avisoEl, textareaEl) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(function () {
        avisoEl.textContent = 'Resumo copiado para a área de transferência.';
        textareaEl.hidden = true;
      }).catch(function () { copiarComFallback(texto, avisoEl, textareaEl); });
    } else {
      copiarComFallback(texto, avisoEl, textareaEl);
    }
  }

  function copiarComFallback(texto, avisoEl, textareaEl) {
    textareaEl.value = texto;
    textareaEl.hidden = false;
    textareaEl.focus();
    textareaEl.select();
    var copiou = false;
    try {
      copiou = document.execCommand && document.execCommand('copy');
    } catch (e) {
      copiou = false;
    }
    if (copiou) {
      avisoEl.textContent = 'Resumo copiado para a área de transferência.';
    } else {
      avisoEl.textContent = 'Não foi possível copiar automaticamente. O texto está selecionado abaixo — use Ctrl+C (ou Cmd+C) para copiar.';
    }
  }

  // -----------------------------------------------------------------------
  // Gerar PDF (via impressão do navegador)
  // -----------------------------------------------------------------------

  function montarAreaImpressao(sessao) {
    var d = Report.montarDadosCompletos(sessao);
    var raiz = $.printArea;
    while (raiz.firstChild) raiz.removeChild(raiz.firstChild);

    function el(tag, classe, texto) {
      var elemento = document.createElement(tag);
      if (classe) elemento.className = classe;
      if (texto !== undefined) elemento.textContent = texto;
      return elemento;
    }

    raiz.appendChild(el('h1', 'print-titulo', d.nomeApp));

    var infoSessao = el('p', 'print-info');
    infoSessao.textContent = 'Sessão ' + d.sessaoId + ' • ' + d.estado + ' • Data: ' + d.data + ' • Finalização: ' + d.horaFim;
    raiz.appendChild(infoSessao);

    var totais = el('p', 'print-totais');
    totais.textContent = 'Sacas: ' + d.sacas + '    Pacotes: ' + d.pacotes;
    raiz.appendChild(totais);

    d.categorias.forEach(function (cat) {
      var bloco = el('section', 'print-categoria');
      bloco.appendChild(el('h2', null, cat.label + ' (' + cat.quantidade + ')'));
      if (cat.itens.length === 0) {
        bloco.appendChild(el('p', 'print-zero', 'Zero'));
      } else {
        var ul = document.createElement('ul');
        cat.itens.forEach(function (item) {
          var li = document.createElement('li');
          var principal = item.code + ' — ' + item.status;
          li.textContent = item.nota ? principal + ' (Obs.: ' + item.nota + ')' : principal;
          ul.appendChild(li);
        });
        bloco.appendChild(ul);
      }
      raiz.appendChild(bloco);
    });

    var resumoFinal = el('p', 'print-resumo');
    resumoFinal.textContent = 'Total de ocorrências: ' + d.totalOcorrencias + '    Pendentes: ' + d.pendentes + '    Resolvidas: ' + d.resolvidas;
    raiz.appendChild(resumoFinal);

    raiz.appendChild(el('p', 'print-rodape', 'Nex Finalizado (' + d.horaFim + ')'));
  }

  function gerarPdf(sessao) {
    montarAreaImpressao(sessao);
    var tituloOriginal = document.title;
    document.title = Report.nomeArquivoSugerido(sessao);

    var restaurado = false;
    function restaurar() {
      if (restaurado) return;
      restaurado = true;
      document.title = tituloOriginal;
      window.removeEventListener('afterprint', restaurar);
    }
    window.addEventListener('afterprint', restaurar);
    setTimeout(restaurar, 3000);

    window.print();
  }

  // -----------------------------------------------------------------------
  // Backup: exportar / importar
  // -----------------------------------------------------------------------

  function exportarBackup() {
    var texto = Storage.exportarBackup(estado.dados);
    var blob = new Blob([texto], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var hoje = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'melinotepad_backup_' + hoje + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Backup exportado.', 'sucesso');
  }

  function aoSelecionarArquivoBackup(e) {
    var arquivo = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;

    var leitor = new FileReader();
    leitor.onload = function () {
      var resultado = Storage.importarBackup(String(leitor.result));
      if (!resultado.valido) {
        toast('Arquivo de backup inválido: ' + resultado.erros[0], 'erro');
        return;
      }
      estado.importPendente = resultado.dados;
      var qtdHistorico = resultado.dados.history.length;
      var temSessaoAtiva = !!resultado.dados.currentSession;
      $.modalImportarResumo.textContent = 'O arquivo contém ' + qtdHistorico + ' sessão(ões) no histórico' +
        (temSessaoAtiva ? ' e uma sessão em andamento.' : '.');
      $.modalImportar.showModal();
    };
    leitor.onerror = function () {
      toast('Não foi possível ler o arquivo selecionado.', 'erro');
    };
    leitor.readAsText(arquivo);
  }

  function confirmarImportacao() {
    if (!estado.importPendente) { $.modalImportar.close(); return; }
    var resultado = Storage.salvarDados(estado.importPendente);
    if (!resultado.sucesso) {
      toast(resultado.erro, 'erro');
      return;
    }
    estado.dados = estado.importPendente;
    estado.importPendente = null;
    $.modalImportar.close();
    fecharDetalheHistorico();
    renderTudo();
    toast('Backup importado com sucesso.', 'sucesso');
  }

  function cancelarImportacao() {
    estado.importPendente = null;
    $.modalImportar.close();
  }

  // -----------------------------------------------------------------------
  // Service worker (funcionamento offline)
  // -----------------------------------------------------------------------

  function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return; // exige HTTPS ou localhost
    navigator.serviceWorker.register('./service-worker.js').catch(function (e) {
      console.info('Service worker não registrado:', e && e.message);
    });
  }

  // -----------------------------------------------------------------------
  // Carregamento inicial dos dados
  // -----------------------------------------------------------------------

  function carregarEstadoInicial() {
    var resultado = Storage.carregarDados();
    estado.dados = resultado.dados;
    if (resultado.aviso) avisoSistema(resultado.aviso);
  }

  // -----------------------------------------------------------------------
  // Wire de eventos
  // -----------------------------------------------------------------------

  function conectarEventos() {
    $.btnVerSessao.addEventListener('click', function () { mudarView('sessao'); });
    $.btnVerHistorico.addEventListener('click', function () { mudarView('historico'); });

    $.formIniciarSessao.addEventListener('submit', aoEnviarIniciarSessao);
    $.inputPacotes.addEventListener('input', aoDigitarPacotes);

    $.btnEditarTotais.addEventListener('click', abrirEdicaoTotais);
    $.btnCancelarEditarTotais.addEventListener('click', cancelarEdicaoTotais);
    $.formEditarTotais.addEventListener('submit', aoSalvarTotais);

    $.btnNovaSessaoBloqueio.addEventListener('click', abrirBloqueioNovaSessao);
    $.btnBloqueioFinalizar.addEventListener('click', aoClicarBloqueioFinalizar);
    $.btnBloqueioCancelar.addEventListener('click', aoClicarBloqueioCancelar);
    $.btnBloqueioDescartar.addEventListener('click', aoClicarBloqueioDescartar);

    $.btnAbrirCamera.addEventListener('click', abrirCamera);
    $.btnFecharCamera.addEventListener('click', fecharCamera);
    $.selectCamera.addEventListener('change', aoTrocarCamera);

    $.formRegistrarOcorrencia.addEventListener('submit', aoEnviarRegistrarOcorrencia);
    $.listaOcorrencias.addEventListener('click', aoClicarListaOcorrencias);

    $.formEditarOcorrencia.addEventListener('submit', aoEnviarEditarOcorrencia);
    $.btnCancelarEditar.addEventListener('click', function () { $.modalEditar.close(); });

    $.filtroCategoria.addEventListener('change', aoMudarFiltros);
    $.filtroStatus.addEventListener('change', aoMudarFiltros);
    $.filtroCodigo.addEventListener('input', aoMudarFiltros);
    $.btnLimparFiltros.addEventListener('click', limparFiltros);

    $.btnPreVisualizar.addEventListener('click', preVisualizarRelatorio);
    $.btnFinalizarSessao.addEventListener('click', finalizarSessao);
    $.formFinalizar.addEventListener('submit', aoConfirmarFinalizar);
    $.btnCancelarFinalizar.addEventListener('click', function () { $.modalFinalizar.close(); });

    $.listaHistorico.addEventListener('click', function (e) {
      var botao = e.target.closest('.item-historico__botao');
      if (botao) abrirDetalheHistorico(botao.dataset.id);
    });
    $.btnFecharDetalheHistorico.addEventListener('click', fecharDetalheHistorico);
    $.btnExcluirSessaoHistorico.addEventListener('click', excluirSessaoHistorico);
    $.btnRestaurarRelatorioHistorico.addEventListener('click', restaurarRelatorioHistorico);
    $.btnCopiarResumoHistorico.addEventListener('click', function () {
      // Copia exatamente o que está na caixa de texto (o usuário pode ter editado),
      // não um texto gerado na hora — ver "Restaurar texto gerado" para voltar ao original.
      copiarTexto($.detalheHistoricoRelatorio.value, $.avisoCopiarHistorico, $.areaCopiaManual);
    });
    $.btnGerarPdfHistorico.addEventListener('click', function () {
      var sessao = sessaoHistoricoAberta();
      if (sessao) gerarPdf(sessao);
    });

    $.btnExportarBackup.addEventListener('click', exportarBackup);
    $.btnImportarBackup.addEventListener('click', function () { $.inputImportarArquivo.click(); });
    $.inputImportarArquivo.addEventListener('change', aoSelecionarArquivoBackup);
    $.btnConfirmarImportar.addEventListener('click', confirmarImportacao);
    $.btnCancelarImportar.addEventListener('click', cancelarImportacao);

    window.addEventListener('beforeunload', function () {
      Scanner.parar();
    });
  }

  // -----------------------------------------------------------------------
  // Início
  // -----------------------------------------------------------------------

  function init() {
    mapearElementos();
    carregarEstadoInicial();
    popularSelectCategorias($.selectCategoria, false);
    popularSelectCategorias($.filtroCategoria, true);
    popularSelectCategorias($.editCategoria, false);
    conectarEventos();
    renderTudo();
    registrarServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
