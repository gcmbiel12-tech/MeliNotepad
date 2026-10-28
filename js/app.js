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
  var SaveStatus = window.MeliNotepad.SaveStatus;
  var Scanner = window.MeliNotepad.Scanner;
  var Report = window.MeliNotepad.Report;
  var Relatorios = window.MeliNotepad.RelatoriosHistorico;
  var relatorioUiNex = null;

  // -----------------------------------------------------------------------
  // Estado em memória
  // -----------------------------------------------------------------------
  var estado = {
    dados: null,
    filtros: { categoria: '', status: '', codigo: '' },
    editandoOcorrenciaId: null,
    importPendente: null,
    historicoAbertoId: null,
    filtroHistorico: { periodo: 'todos', data: '', inicio: '', fim: '', busca: '', categoria: '', status: '' }
  };

  // Trava de reentrância simples: impede que um clique duplo real (dois
  // eventos de clique praticamente simultâneos) crie dois registros a
  // partir do mesmo envio do formulário. Diferente de um temporizador fixo,
  // ela libera assim que o registro atual termina, sem atrapalhar o
  // próximo código digitado ou lido em seguida — fluxo comum na conferência.
  var registrandoOcorrencia = false;
  var importacaoNex = { resultado: null, arquivoNome: '', totaisAlterados: false, lendo: false };

  // -----------------------------------------------------------------------
  // Referências de DOM (preenchidas em init())
  // -----------------------------------------------------------------------
  var $ = {};

  function mapearElementos() {
    var ids = [
      'status-chip', 'save-status', 'save-retry', 'btn-ver-sessao', 'btn-ver-historico', 'avisos-sistema',
      'view-sessao', 'view-historico',
      'painel-inicio', 'form-iniciar-sessao', 'input-sacas', 'input-pacotes', 'pacotes-formatado',
      'input-data-operacao', 'nex-arquivo-planilha', 'nex-area-importacao', 'nex-selecionar-planilha',
      'nex-arquivo-estado', 'nex-importacao-previa', 'nex-importacao-resumo', 'nex-importacao-rotas',
      'painel-sessao-ativa', 'btn-editar-totais', 'btn-nova-sessao-bloqueio',
      'info-data', 'info-sacas', 'info-pacotes', 'info-rotas-wrap', 'info-rotas-hybrid',
      'form-editar-totais', 'input-sacas-edit', 'input-pacotes-edit', 'btn-cancelar-editar-totais',
      'btn-abrir-camera', 'btn-fechar-camera', 'label-select-camera', 'select-camera', 'video-camera', 'aviso-camera',
      'form-registrar-ocorrencia', 'input-codigo', 'select-categoria', 'ajuda-categoria', 'input-observacao',
      'input-tipo-produto', 'input-rota-ocorrencia', 'input-saca-ocorrencia', 'select-gaiola-encontrada', 'input-gaiola-correta', 'input-encontrado-por',
      'input-data-hora-ocorrencia', 'input-descricao-outra', 'campo-categoria-outra',
      'contagem-total', 'contagem-pendente', 'contagem-resolvida',
      'filtro-categoria', 'filtro-status', 'filtro-codigo', 'btn-ver-pendentes', 'btn-limpar-filtros',
      'lista-ocorrencias-vazia', 'lista-ocorrencias',
      'btn-pre-visualizar', 'btn-finalizar-sessao', 'painel-relatorio', 'texto-relatorio',
      'area-copia-manual',
      'lista-historico', 'historico-vazio',
      'historico-sem-resultados', 'historico-periodo', 'historico-data', 'historico-data-wrap',
      'historico-inicio', 'historico-fim', 'historico-inicio-wrap', 'historico-fim-wrap', 'historico-busca', 'historico-categoria', 'historico-status', 'historico-limpar',
      'nex-relatorio-historico',
      'detalhe-historico', 'detalhe-historico-info', 'detalhe-historico-ocorrencias', 'detalhe-historico-relatorio',
      'btn-fechar-detalhe-historico', 'btn-copiar-resumo-historico', 'btn-gerar-pdf-historico', 'aviso-copiar-historico',
      'btn-restaurar-relatorio-historico', 'btn-excluir-sessao-historico',
      'btn-exportar-backup', 'btn-importar-backup', 'input-importar-arquivo',
      'modal-confirmar', 'modal-confirmar-titulo', 'modal-confirmar-mensagem', 'modal-confirmar-cancelar', 'modal-confirmar-ok',
      'modal-editar', 'form-editar-ocorrencia', 'edit-codigo', 'edit-categoria', 'edit-observacao', 'btn-cancelar-editar',
      'modal-importar', 'modal-importar-resumo', 'btn-cancelar-importar', 'btn-confirmar-importar',
      'modal-sessao-bloqueio', 'btn-bloqueio-finalizar', 'btn-bloqueio-descartar', 'btn-bloqueio-cancelar',
      'modal-finalizar', 'modal-finalizar-resumo', 'modal-finalizar-aviso-pendentes', 'form-finalizar', 'finalizar-horario', 'btn-cancelar-finalizar',
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
    if (SaveStatus) { SaveStatus.modulo('NEX'); SaveStatus.salvando(); }
    var resultado = Storage.salvarDados(estado.dados);
    if (!resultado.sucesso) {
      if (SaveStatus) SaveStatus.erro(resultado.erro);
      toast(resultado.erro, 'erro');
      return false;
    }
    if (SaveStatus) SaveStatus.salvo();
    return true;
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

  function atualizarAjudaCategoria() {
    var descricoes = {
      bingo: 'Bingo: produto que não foi encontrado fisicamente durante a auditoria.',
      faltando: 'Faltando: pacote a mais, que não deveria estar naquele local.'
    };
    $.ajudaCategoria.textContent = descricoes[$.selectCategoria.value] || 'Selecione a categoria que melhor descreve a ocorrência.';
    if ($.campoCategoriaOutra) $.campoCategoriaOutra.hidden = $.selectCategoria.value !== 'outra';
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

    $.infoData.textContent = U.formatarDataOperacional(sessao.startTime);
    $.infoSacas.textContent = U.formatarNumeroBR(sessao.sacas);
    $.infoPacotes.textContent = U.formatarNumeroBR(sessao.pacotes);
    var rotasHybrid = Array.isArray(sessao.rotasHybrid) ? sessao.rotasHybrid : [];
    $.infoRotasWrap.hidden = rotasHybrid.length === 0;
    $.infoRotasHybrid.textContent = rotasHybrid.map(function (r) { return r.rota; }).join(', ');
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

    var detalhesOcorrencia = [];
    if (o.tipoProduto) detalhesOcorrencia.push('Tipo do produto: ' + o.tipoProduto);
    if (o.rota) detalhesOcorrencia.push('Rota: ' + o.rota);
    if (o.saca) detalhesOcorrencia.push('Saca: ' + o.saca);
    if (o.gaiolaEncontrada) detalhesOcorrencia.push('Gaiola encontrada: ' + o.gaiolaEncontrada);
    if (o.gaiolaCorreta) detalhesOcorrencia.push('Gaiola correta: ' + o.gaiolaCorreta);
    if (o.encontradoPor) detalhesOcorrencia.push('Encontrado por: ' + o.encontradoPor);
    if (o.descricaoOutra) detalhesOcorrencia.push('Descrição: ' + o.descricaoOutra);
    if (o.note) detalhesOcorrencia.push('Observações: ' + o.note);
    if (detalhesOcorrencia.length) {
      var nota = document.createElement('p');
      nota.className = 'item-ocorrencia__nota';
      nota.textContent = detalhesOcorrencia.join(' · ');
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
    var mostrandoPendentes = estado.filtros.status === C.STATUS.PENDENTE;
    $.btnVerPendentes.textContent = mostrandoPendentes ? 'Ver todas' : 'Ver pendentes';
    $.btnVerPendentes.setAttribute('aria-pressed', String(mostrandoPendentes));

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
    var f = estado.filtroHistorico;
    var todos = estado.dados.history.slice();
    var termoHistorico = U.normalizarTexto(f.busca || '').toLocaleLowerCase('pt-BR');
    var historico = U.consultarHistorico(todos, {
      periodo: f.periodo, data: f.data, inicio: f.inicio, fim: f.fim, busca: '',
      campoData: 'startTime'
    }).filter(function (sessao) {
      var ocorrencias = sessao.occurrences || [];
      if (!f.categoria && !f.status && !termoHistorico) return true;
      return ocorrencias.some(function (o) {
        if (f.categoria && o.category !== f.categoria) return false;
        if (f.status && o.status !== f.status) return false;
        if (termoHistorico) {
          var texto = [o.code || '', C.categoriaLabel(o.category), o.note || ''].join(' ').toLocaleLowerCase('pt-BR');
          if (texto.indexOf(termoHistorico) === -1) return false;
        }
        return true;
      });
    });

    while ($.listaHistorico.firstChild) $.listaHistorico.removeChild($.listaHistorico.firstChild);
    $.historicoVazio.hidden = todos.length > 0;
    $.historicoSemResultados.hidden = todos.length === 0 || historico.length > 0;
    $.historicoDataWrap.hidden = f.periodo !== 'data';
    $.historicoInicioWrap.hidden = $.historicoFimWrap.hidden = f.periodo !== 'intervalo';

    var diaAtual = null;
    historico.forEach(function (sessao) {
      var dia = U.dataOperacional(sessao.startTime);
      if (dia !== diaAtual) {
        diaAtual = dia;
        var grupo = document.createElement('li');
        grupo.className = 'historico-grupo-dia';
        grupo.textContent = U.formatarDataOperacional(sessao.startTime);
        $.listaHistorico.appendChild(grupo);
      }
      var status = Report.contarStatus(sessao.occurrences);
      var li = document.createElement('li');
      li.className = 'item-historico';

      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'item-historico__botao';
      botao.dataset.id = sessao.id;

      var linha1 = document.createElement('span');
      linha1.className = 'item-historico__data';
      linha1.textContent = U.formatarDataOperacional(sessao.startTime) + ' • Iniciado às ' + U.formatarHoraOperacional(sessao.startTime) + ' • Finalizado às ' + (sessao.endTime ? U.formatarHoraOperacional(sessao.endTime) : '—');
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
      ['Data', U.formatarDataOperacional(sessao.startTime)],
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
      mensagem: 'Excluir a conferência de ' + U.formatarDataOperacional(sessao.startTime) + ' (' + status.total + ' ocorrência(s))? Esta ação não pode ser desfeita e não existe backup automático — exporte um backup antes, se precisar guardar esses dados.',
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

  function valorDataHoraLocal(data) {
    var d = data || new Date();
    function dois(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()) +
      'T' + dois(d.getHours()) + ':' + dois(d.getMinutes());
  }

  function formatarTamanhoArquivo(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' KB';
    return (bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' MB';
  }

  function limparElemento(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function mostrarEstadoArquivoNex(mensagem, tipo, arquivo) {
    limparElemento($.nexArquivoEstado);
    if (mensagem) {
      var texto = document.createElement('p');
      texto.className = tipo === 'erro' ? 'nex-importacao__erro' : 'texto-apoio';
      texto.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
      texto.textContent = mensagem;
      $.nexArquivoEstado.appendChild(texto);
    }
    if (arquivo) {
      var acoes = document.createElement('div');
      acoes.className = 'nex-importacao__arquivo';
      var detalhe = document.createElement('span');
      detalhe.textContent = arquivo.name + ' (' + formatarTamanhoArquivo(arquivo.size) + ')';
      var remover = document.createElement('button');
      remover.type = 'button';
      remover.className = 'botao botao--texto';
      remover.textContent = 'Remover arquivo';
      remover.addEventListener('click', removerPlanilhaNex);
      acoes.appendChild(detalhe);
      acoes.appendChild(remover);
      $.nexArquivoEstado.appendChild(acoes);
    }
  }

  function renderizarPreviaImportacaoNex(resultado) {
    limparElemento($.nexImportacaoRotas);
    resultado.rotas.forEach(function (r) {
      var item = document.createElement('li');
      var nome = document.createElement('strong');
      nome.textContent = r.rota;
      var detalhe = document.createElement('span');
      detalhe.textContent = 'Sacas: ' + U.formatarNumeroBR(r.sacas) + ' · Pacotes estimados: ' + U.formatarNumeroBR(r.pacotes);
      item.appendChild(nome);
      item.appendChild(detalhe);
      $.nexImportacaoRotas.appendChild(item);
    });
    $.nexImportacaoResumo.textContent = resultado.rotas.length + ' rota(s) HYBRID identificada(s). Totais importados: ' +
      U.formatarNumeroBR(resultado.totalSacas) + ' sacas e ' + U.formatarNumeroBR(resultado.totalPacotes) + ' pacotes estimados.';
    $.nexImportacaoPrevia.hidden = false;
  }

  function processarPlanilhaNex(arquivo) {
    if (!arquivo) return;
    var extensao = String(arquivo.name || '').split('.').pop().toLowerCase();
    if (extensao !== 'csv' && extensao !== 'xlsx') {
      mostrarEstadoArquivoNex('Formato não suportado. Selecione um arquivo .xlsx ou .csv.', 'erro');
      $.nexArquivoPlanilha.value = '';
      return;
    }
    if (!arquivo.size || arquivo.size < 0) {
      mostrarEstadoArquivoNex('O arquivo está vazio. Selecione outra planilha.', 'erro');
      $.nexArquivoPlanilha.value = '';
      return;
    }
    if (arquivo.size > 20 * 1024 * 1024) {
      mostrarEstadoArquivoNex('O arquivo excede o limite de 20 MB para importação.', 'erro');
      $.nexArquivoPlanilha.value = '';
      return;
    }
    var temValoresManuais = $.inputSacas.value !== '' || $.inputPacotes.value !== '';
    if ((importacaoNex.totaisAlterados || (!importacaoNex.resultado && temValoresManuais)) &&
        !window.confirm('A importação preencherá novamente os totais de sacas e pacotes. Deseja continuar?')) {
      $.nexArquivoPlanilha.value = '';
      return;
    }

    importacaoNex.lendo = true;
    $.nexSelecionarPlanilha.disabled = true;
    mostrarEstadoArquivoNex('Lendo e validando a planilha…');
    window.MeliNotepad.NexPlanilha.analisarArquivo(arquivo).then(function (resultado) {
      importacaoNex.resultado = resultado;
      importacaoNex.arquivoNome = arquivo.name;
      importacaoNex.totaisAlterados = false;
      $.inputSacas.value = String(resultado.totalSacas);
      $.inputPacotes.value = String(resultado.totalPacotes);
      aoDigitarPacotes();
      renderizarPreviaImportacaoNex(resultado);
      mostrarEstadoArquivoNex('Planilha validada: ' + arquivo.name + '. Somente as linhas HYBRID foram consideradas.', 'sucesso', arquivo);
    }).catch(function (erro) {
      mostrarEstadoArquivoNex(erro && erro.message ? erro.message : 'Não foi possível ler a planilha.', 'erro');
      $.nexArquivoPlanilha.value = '';
    }).then(function () {
      importacaoNex.lendo = false;
      $.nexSelecionarPlanilha.disabled = false;
    });
  }

  function removerPlanilhaNex() {
    importacaoNex.resultado = null;
    importacaoNex.arquivoNome = '';
    importacaoNex.totaisAlterados = false;
    $.nexArquivoPlanilha.value = '';
    $.nexImportacaoPrevia.hidden = true;
    limparElemento($.nexImportacaoRotas);
    mostrarEstadoArquivoNex('Planilha removida. Os totais atuais foram mantidos e podem ser editados manualmente.');
  }

  function configurarImportacaoNex() {
    $.inputDataOperacao.value = valorDataHoraLocal(new Date());
    $.nexSelecionarPlanilha.addEventListener('click', function () { if (!importacaoNex.lendo) $.nexArquivoPlanilha.click(); });
    $.nexArquivoPlanilha.addEventListener('change', function () {
      var arquivo = $.nexArquivoPlanilha.files && $.nexArquivoPlanilha.files[0];
      if (arquivo) processarPlanilhaNex(arquivo);
    });
    $.nexAreaImportacao.addEventListener('click', function (e) {
      if (e.target === $.nexAreaImportacao || e.target.tagName === 'P' || e.target.tagName === 'SPAN') {
        if (!importacaoNex.lendo) $.nexArquivoPlanilha.click();
      }
    });
    $.nexAreaImportacao.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!importacaoNex.lendo) $.nexArquivoPlanilha.click(); }
    });
    $.nexAreaImportacao.addEventListener('dragenter', function (e) { e.preventDefault(); $.nexAreaImportacao.classList.add('is-arrastando'); });
    $.nexAreaImportacao.addEventListener('dragover', function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; $.nexAreaImportacao.classList.add('is-arrastando'); });
    $.nexAreaImportacao.addEventListener('dragleave', function (e) {
      if (!$.nexAreaImportacao.contains(e.relatedTarget)) $.nexAreaImportacao.classList.remove('is-arrastando');
    });
    $.nexAreaImportacao.addEventListener('drop', function (e) {
      e.preventDefault();
      $.nexAreaImportacao.classList.remove('is-arrastando');
      var arquivos = e.dataTransfer && e.dataTransfer.files;
      if (!arquivos || !arquivos.length) { mostrarEstadoArquivoNex('Não foi possível receber o arquivo arrastado. Selecione-o pelo botão.', 'erro'); return; }
      processarPlanilhaNex(arquivos[0]);
    });
    mostrarEstadoArquivoNex('Nenhum arquivo selecionado. Você também pode preencher os totais manualmente.');
    $.inputSacas.addEventListener('input', function () { if (importacaoNex.resultado) importacaoNex.totaisAlterados = true; });
    $.inputPacotes.addEventListener('input', function () { if (importacaoNex.resultado) importacaoNex.totaisAlterados = true; });
  }

  function aoEnviarIniciarSessao(e) {
    e.preventDefault();
    if (importacaoNex.lendo) { toast('Aguarde a conclusão da leitura da planilha antes de iniciar a operação.', 'info'); return; }
    if (sessaoAtiva()) { toast('Já existe uma conferência em andamento. Retome a sessão atual.', 'erro'); renderTudo(); return; }
    var sacas = $.inputSacas.value;
    var pacotes = $.inputPacotes.value;
    if (!U.ehInteiroNaoNegativo(sacas) || !U.ehInteiroNaoNegativo(pacotes)) {
      toast('Informe números inteiros não negativos para sacas e pacotes.', 'erro');
      return;
    }
    var dataOperacao = new Date($.inputDataOperacao.value);
    if (!$.inputDataOperacao.value || isNaN(dataOperacao.getTime())) {
      toast('Informe uma data e hora válidas para a operação.', 'erro');
      $.inputDataOperacao.focus();
      return;
    }
    var novaSessao = {
      id: U.gerarId('sess'),
      startTime: dataOperacao.toISOString(),
      endTime: null,
      status: C.SESSION_STATUS.EM_ANDAMENTO,
      sacas: parseInt(sacas, 10),
      pacotes: parseInt(pacotes, 10),
      rotasHybrid: importacaoNex.resultado ? importacaoNex.resultado.rotas : [],
      planilhaOptimization: importacaoNex.resultado ? importacaoNex.arquivoNome : null,
      occurrences: []
    };
    estado.dados.currentSession = novaSessao;
    if (!persistir()) return;
    $.formIniciarSessao.reset();
    $.pacotesFormatado.textContent = '';
    importacaoNex = { resultado: null, arquivoNome: '', totaisAlterados: false, lendo: false };
    $.nexArquivoPlanilha.value = '';
    $.nexImportacaoPrevia.hidden = true;
    limparElemento($.nexImportacaoRotas);
    mostrarEstadoArquivoNex('Nenhum arquivo selecionado. Você também pode preencher os totais manualmente.');
    $.inputDataOperacao.value = valorDataHoraLocal(new Date());
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

  function aoCodigoNaoReconhecido(bruto, motivo) {
    $.avisoCamera.textContent = 'Código não reconhecido (' + motivo + ') Nada foi preenchido; aponte para outro código ou digite manualmente.';
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

    Scanner.iniciar($.videoCamera, null, aoDetectarCodigo, aoErroCamera, aoCodigoNaoReconhecido).then(function () {
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
    Scanner.iniciar($.videoCamera, deviceId, aoDetectarCodigo, aoErroCamera, aoCodigoNaoReconhecido);
  }

  // -----------------------------------------------------------------------
  // Eventos: registrar ocorrência
  // -----------------------------------------------------------------------

  function buscarDuplicados(codigo, ignorarId) {
    var sessao = sessaoAtiva();
    var alvo = U.normalizarCodigoParaComparacao(codigo);
    return sessao.occurrences.filter(function (o) {
      return o.id !== ignorarId && U.normalizarCodigoParaComparacao(o.code) === alvo;
    });
  }

  function salvarNovaOcorrencia(codigo, categoria, status, nota, detalhes) {
    var sessao = sessaoAtiva();
    var agora = U.agora().toISOString();
    sessao.occurrences.push({
      id: U.gerarId('occ'),
      code: codigo,
      category: categoria,
      status: status,
      createdAt: detalhes.quando || agora,
      updatedAt: agora,
      note: nota || undefined,
      tipoProduto: detalhes.tipoProduto || undefined,
      rota: detalhes.rota || undefined,
      saca: detalhes.saca || undefined,
      gaiolaEncontrada: detalhes.gaiolaEncontrada || undefined,
      gaiolaCorreta: detalhes.gaiolaCorreta || undefined,
      encontradoPor: detalhes.encontradoPor || undefined,
      descricaoOutra: detalhes.descricaoOutra || undefined
    });
    if (!persistir()) { sessao.occurrences.pop(); return false; }
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

  // Códigos digitados/colados (ou enviados por leitor externo que "digita" no campo)
  // passam pela mesma interpretação da câmera: JSON válido -> só o "id"; JSON
  // inválido ou sem "id" é recusado. Códigos comuns seguem exatamente como digitados.
  function interpretarCodigoDigitado(textoNormalizado) {
    var leitura = U.extrairIdentificadorDeCodigo(textoNormalizado);
    if (!leitura.ok) return { ok: false, motivo: leitura.motivo };
    return { ok: true, codigo: leitura.origem === 'json' ? leitura.id : textoNormalizado };
  }

  function aoEnviarRegistrarOcorrencia(e) {
    e.preventDefault();
    if (registrandoOcorrencia) return;

    var codigo = U.normalizarTexto($.inputCodigo.value);
    var categoria = $.selectCategoria.value;
    var status = statusEscolhidoNoFormulario();
    var nota = U.normalizarTexto($.inputObservacao.value);
    var detalhes = {
      tipoProduto: U.normalizarTexto($.inputTipoProduto.value),
      rota: U.normalizarTexto($.inputRotaOcorrencia.value),
      saca: U.normalizarTexto($.inputSacaOcorrencia.value),
      gaiolaEncontrada: U.normalizarTexto($.selectGaiolaEncontrada.value),
      gaiolaCorreta: U.normalizarTexto($.inputGaiolaCorreta.value),
      encontradoPor: U.normalizarTexto($.inputEncontradoPor.value),
      quando: $.inputDataHoraOcorrencia.value ? new Date($.inputDataHoraOcorrencia.value).toISOString() : U.agora().toISOString(),
      descricaoOutra: U.normalizarTexto($.inputDescricaoOutra.value)
    };

    if (!codigo) {
      toast('Informe o código do pacote.', 'erro');
      return;
    }
    if (!categoria) {
      toast('Selecione a categoria da ocorrência.', 'erro');
      return;
    }
    if (categoria === 'outra' && !detalhes.descricaoOutra) {
      toast('Descreva a ocorrência quando selecionar a categoria Outra.', 'erro');
      $.inputDescricaoOutra.focus();
      return;
    }
    if (!$.inputDataHoraOcorrencia.value || isNaN(new Date($.inputDataHoraOcorrencia.value).getTime())) {
      toast('Informe uma data e hora válidas.', 'erro');
      return;
    }
    if (!status) {
      toast('Selecione o status da ocorrência: Pendente ou Resolvido.', 'erro');
      return;
    }
    var leituraCodigo = interpretarCodigoDigitado(codigo);
    if (!leituraCodigo.ok) {
      toast('Código não reconhecido: ' + leituraCodigo.motivo + ' Nada foi registrado.', 'erro');
      return;
    }
    codigo = leituraCodigo.codigo;

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
      var sucesso = salvarNovaOcorrencia(codigo, categoria, status, nota, detalhes);
      registrandoOcorrencia = false;
      if (!sucesso) return;
      $.inputCodigo.value = '';
      $.inputObservacao.value = '';
      $.inputTipoProduto.value = '';
      $.inputRotaOcorrencia.value = '';
      $.inputSacaOcorrencia.value = '';
      $.selectGaiolaEncontrada.value = '';
      $.inputGaiolaCorreta.value = '';
      $.inputEncontradoPor.value = '';
      $.inputDescricaoOutra.value = '';
      $.inputDataHoraOcorrencia.value = U.paraDatetimeLocal(U.agora());
      $.campoCategoriaOutra.hidden = true;
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
    var leituraEdicao = interpretarCodigoDigitado(codigo);
    if (!leituraEdicao.ok) {
      toast('Código não reconhecido: ' + leituraEdicao.motivo + ' Nada foi alterado.', 'erro');
      return;
    }
    codigo = leituraEdicao.codigo;

    var duplicados = buscarDuplicados(codigo, ocorrencia.id);
    var prosseguir = duplicados.length ? confirmar({
      titulo: 'Código já registrado nesta sessão',
      mensagem: 'O código "' + codigo + '" já aparece em outra ocorrência: ' + duplicados.map(function (o) {
        return C.categoriaLabel(o.category) + ' (' + C.STATUS_LABEL[o.status] + ')';
      }).join('; ') + '. Deseja manter o código repetido?',
      confirmarLabel: 'Salvar mesmo assim', cancelarLabel: 'Cancelar'
    }) : Promise.resolve(true);

    prosseguir.then(function (ok) {
      if (!ok) return;
      var codigoAnterior = ocorrencia.code, categoriaAnterior = ocorrencia.category;
      var notaAnterior = ocorrencia.note, atualizadoAnterior = ocorrencia.updatedAt;
      ocorrencia.code = codigo;
      ocorrencia.category = categoria;
      ocorrencia.note = nota || undefined;
      ocorrencia.updatedAt = U.agora().toISOString();
      if (!persistir()) {
        ocorrencia.code = codigoAnterior; ocorrencia.category = categoriaAnterior;
        ocorrencia.note = notaAnterior; ocorrencia.updatedAt = atualizadoAnterior;
        return;
      }
      $.modalEditar.close();
      renderListaOcorrencias();
      toast('Ocorrência atualizada.', 'sucesso');
    });
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

  function alternarFiltroPendentes() {
    $.filtroStatus.value = estado.filtros.status === C.STATUS.PENDENTE ? '' : C.STATUS.PENDENTE;
    aoMudarFiltros();
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
    var status = Report.contarStatus(sessao.occurrences);
    var porCategoria = Report.contarPorCategoria(sessao.occurrences);
    var linhasResumo = [
      'Ocorrências: ' + status.total,
      'Pendentes: ' + status.pendentes,
      'Resolvidas: ' + status.resolvidas
    ];
    C.CATEGORIES.forEach(function (cat) {
      var quantidade = porCategoria[cat.key].length;
      if (quantidade) linhasResumo.push(cat.label + ': ' + quantidade);
    });
    $.modalFinalizarResumo.textContent = linhasResumo.join('\n');
    var pendentes = status.pendentes;

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

    var sessaoAtivaAtual = sessaoAtiva();
    if (!sessaoAtivaAtual) { toast('Não há conferência ativa para finalizar.', 'erro'); return; }
    // Trabalha numa cópia para que uma falha de persistência não deixe a sessão ativa
    // parcialmente marcada como finalizada em memória.
    var sessao = JSON.parse(JSON.stringify(sessaoAtivaAtual));
    // Idempotência: reenvio do formulário não deve duplicar o histórico.
    if (estado.dados.history.some(function (s) { return s.id === sessao.id; })) {
      estado.dados.currentSession = null;
      if (!persistir()) return;
      $.modalFinalizar.close(); renderTudo(); mudarView('historico'); abrirDetalheHistorico(sessao.id); return;
    }
    sessao.endTime = dataFinal.toISOString();
    sessao.status = C.SESSION_STATUS.FINALIZADA;
    estado.dados.history.push(JSON.parse(JSON.stringify(sessao)));
    estado.dados.currentSession = null;
    if (!persistir()) { estado.dados.history = estado.dados.history.filter(function (s) { return s.id !== sessao.id; }); estado.dados.currentSession = sessao; return; }

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

  // -----------------------------------------------------------------------
  // Backup: exportar / importar
  // -----------------------------------------------------------------------

  function exportarBackup() {
    var texto = Storage.exportarBackup(estado.dados);
    var blob = new Blob([texto], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var hoje = U.dataHojeOperacional(new Date());
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
    $.selectCategoria.addEventListener('change', atualizarAjudaCategoria);
    $.inputDataHoraOcorrencia.value = U.paraDatetimeLocal(U.agora());
    $.listaOcorrencias.addEventListener('click', aoClicarListaOcorrencias);

    $.formEditarOcorrencia.addEventListener('submit', aoEnviarEditarOcorrencia);
    $.btnCancelarEditar.addEventListener('click', function () { $.modalEditar.close(); });

    $.filtroCategoria.addEventListener('change', aoMudarFiltros);
    $.filtroStatus.addEventListener('change', aoMudarFiltros);
    $.filtroCodigo.addEventListener('input', aoMudarFiltros);
    $.btnVerPendentes.addEventListener('click', alternarFiltroPendentes);
    $.btnLimparFiltros.addEventListener('click', limparFiltros);

    $.btnPreVisualizar.addEventListener('click', preVisualizarRelatorio);
    $.btnFinalizarSessao.addEventListener('click', finalizarSessao);
    $.formFinalizar.addEventListener('submit', aoConfirmarFinalizar);
    $.btnCancelarFinalizar.addEventListener('click', function () { $.modalFinalizar.close(); });

    $.listaHistorico.addEventListener('click', function (e) {
      var botao = e.target.closest('.item-historico__botao');
      if (botao) abrirDetalheHistorico(botao.dataset.id);
    });
    function atualizarFiltroHistorico() {
      estado.filtroHistorico = {
        periodo: $.historicoPeriodo.value, data: $.historicoData.value,
        inicio: $.historicoInicio.value, fim: $.historicoFim.value, busca: $.historicoBusca.value,
        categoria: $.historicoCategoria.value, status: $.historicoStatus.value
      };
      renderHistoricoLista();
    }
    $.historicoPeriodo.addEventListener('change', atualizarFiltroHistorico);
    $.historicoData.addEventListener('change', atualizarFiltroHistorico);
    $.historicoInicio.addEventListener('change', atualizarFiltroHistorico);
    $.historicoFim.addEventListener('change', atualizarFiltroHistorico);
    $.historicoBusca.addEventListener('input', atualizarFiltroHistorico);
    $.historicoCategoria.addEventListener('change', atualizarFiltroHistorico);
    $.historicoStatus.addEventListener('change', atualizarFiltroHistorico);
    $.historicoLimpar.addEventListener('click', function () {
      $.historicoPeriodo.value = 'todos'; $.historicoData.value = ''; $.historicoInicio.value = ''; $.historicoFim.value = ''; $.historicoBusca.value = '';
      $.historicoCategoria.value = ''; $.historicoStatus.value = '';
      atualizarFiltroHistorico();
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
      if (sessao && relatorioUiNex) relatorioUiNex.abrir({ periodo: 'dia', inicio: U.dataOperacional(sessao.startTime), tipo: 'detalhado' });
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

  // API restrita à interface de rotas/sacas. A persistência continua no armazenamento NEX existente.
  window.MeliNotepad.NexOperations = {
    getCurrentSession: function () { return estado.dados ? sessaoAtiva() : null; },
    importPlanilha: function (arquivo) {
      var sessao = sessaoAtiva();
      if (!sessao) return Promise.reject(new Error('Não há operação ativa para atualizar.'));
      if (!arquivo || !arquivo.size || arquivo.size > 20 * 1024 * 1024) return Promise.reject(new Error('Selecione um arquivo válido de até 20 MB.'));
      return window.MeliNotepad.NexPlanilha.analisarArquivo(arquivo).then(function (resultado) {
        var snapshot = JSON.parse(JSON.stringify(sessao));
        if (!Array.isArray(sessao.rotasHybrid)) sessao.rotasHybrid = [];
        resultado.rotas.forEach(function (importada) {
          var existente = sessao.rotasHybrid.find(function (r) { return String(r.rota).toLocaleLowerCase('pt-BR') === String(importada.rota).toLocaleLowerCase('pt-BR'); });
          if (existente) {
            existente.idOtimizado = importada.idOtimizado;
            existente.servico = importada.servico;
            existente.sacas = importada.sacas;
            existente.pacotes = importada.pacotes;
            if (!Array.isArray(existente.sacasIndividuais)) existente.sacasIndividuais = [];
          } else {
            sessao.rotasHybrid.push({ rota: importada.rota, idOtimizado: importada.idOtimizado, servico: importada.servico, sacas: importada.sacas, pacotes: importada.pacotes, sacasIndividuais: [], origem: 'planilha' });
          }
        });
        sessao.sacas = resultado.totalSacas;
        sessao.pacotes = resultado.totalPacotes;
        sessao.planilhaOptimization = arquivo.name;
        if (!persistir()) {
          Object.keys(sessao).forEach(function (k) { delete sessao[k]; });
          Object.keys(snapshot).forEach(function (k) { sessao[k] = snapshot[k]; });
          return Promise.reject(new Error('Não foi possível salvar a importação. Nenhuma alteração foi mantida.'));
        }
        renderTudo();
        return { sucesso: true, rotas: resultado.rotas.length, sacas: resultado.totalSacas, pacotes: resultado.totalPacotes };
      });
    },
    removeRoute: function (nome) {
      var sessao = sessaoAtiva();
      if (!sessao || !Array.isArray(sessao.rotasHybrid)) return { sucesso: false, erro: 'Não há operação ativa.' };
      var indice = sessao.rotasHybrid.findIndex(function (r) { return r.rota === nome; });
      if (indice < 0) return { sucesso: false, erro: 'A rota não foi encontrada.' };
      var removida = sessao.rotasHybrid.splice(indice, 1)[0];
      if (!persistir()) { sessao.rotasHybrid.splice(indice, 0, removida); return { sucesso: false, erro: 'Não foi possível salvar a remoção da rota.' }; }
      renderTudo(); return { sucesso: true };
    },
    removeSaca: function (routeName, sacaId) {
      var sessao = sessaoAtiva();
      var rota = sessao && (sessao.rotasHybrid || []).find(function (r) { return r.rota === routeName; });
      if (!rota || !Array.isArray(rota.sacasIndividuais)) return { sucesso: false, erro: 'A rota ou a lista de sacas não foi encontrada.' };
      var indice = rota.sacasIndividuais.findIndex(function (sc) { return sc.id === sacaId; });
      if (indice < 0) return { sucesso: false, erro: 'A saca não foi encontrada.' };
      var removida = rota.sacasIndividuais.splice(indice, 1)[0];
      if (!persistir()) { rota.sacasIndividuais.splice(indice, 0, removida); return { sucesso: false, erro: 'Não foi possível salvar a remoção da saca.' }; }
      renderTudo(); return { sucesso: true };
    },
    addRoute: function (nome) {
      var sessao = sessaoAtiva();
      nome = String(nome || '').trim();
      if (!sessao) return { sucesso: false, erro: 'Não há operação ativa.' };
      if (!nome) return { sucesso: false, erro: 'Informe o nome da rota.' };
      if (!Array.isArray(sessao.rotasHybrid)) sessao.rotasHybrid = [];
      if (sessao.rotasHybrid.some(function (r) { return String(r.rota).toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'); })) return { sucesso: false, erro: 'Já existe uma rota com esse nome nesta operação.' };
      sessao.rotasHybrid.push({ rota: nome, idOtimizado: nome, servico: 'MANUAL', sacas: 0, pacotes: 0, sacasIndividuais: [], origem: 'manual' });
      if (!persistir()) { sessao.rotasHybrid.pop(); return { sucesso: false, erro: 'Não foi possível salvar a rota.' }; }
      renderTudo(); return { sucesso: true };
    },
    addSaca: function (routeName, numero) {
      var sessao = sessaoAtiva();
      var normalizado = String(numero == null ? '' : numero).trim();
      if (!sessao || !Array.isArray(sessao.rotasHybrid)) return { sucesso: false, erro: 'Não há rotas nesta operação.' };
      if (!/^\d+$/.test(normalizado)) return { sucesso: false, erro: 'A saca deve ter um número inteiro, sem letras.' };
      var chave = String(Number(normalizado));
      if (!Number.isSafeInteger(Number(normalizado))) return { sucesso: false, erro: 'Número de saca inválido.' };
      var sessoes = [sessao].concat(estado.dados.history || []);
      var duplicada = sessoes.some(function (s) { return (s.rotasHybrid || []).some(function (r) { return (r.sacasIndividuais || []).some(function (sc) { return String(Number(sc.numero)) === chave; }); }); });
      if (duplicada) return { sucesso: false, erro: 'Essa saca já está cadastrada. A numeração é única no NEX; por exemplo, 060 e 60 são o mesmo número.' };
      var rota = sessao.rotasHybrid.filter(function (r) { return r.rota === routeName; })[0];
      if (!rota) return { sucesso: false, erro: 'A rota não foi encontrada.' };
      if (!Array.isArray(rota.sacasIndividuais)) rota.sacasIndividuais = [];
      rota.sacasIndividuais.push({ id: 'saca-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), numero: normalizado, auditorias: [] });
      if (!persistir()) { rota.sacasIndividuais.pop(); return { sucesso: false, erro: 'Não foi possível salvar a saca.' }; }
      renderTudo(); return { sucesso: true };
    },
    auditSaca: function (routeName, sacaId, auditor, status, observacao) {
      var sessao = sessaoAtiva();
      var rota = sessao && (sessao.rotasHybrid || []).filter(function (r) { return r.rota === routeName; })[0];
      var saca = rota && (rota.sacasIndividuais || []).filter(function (sc) { return sc.id === sacaId; })[0];
      auditor = String(auditor || '').trim();
      if (!saca) return { sucesso: false, erro: 'A saca não foi encontrada.' };
      if (!auditor) return { sucesso: false, erro: 'Informe o nome do auditor.' };
      if (['concluida', 'divergencia'].indexOf(status) < 0) return { sucesso: false, erro: 'Selecione um resultado válido.' };
      if (!Array.isArray(saca.auditorias)) saca.auditorias = [];
      saca.auditorias.push({ id: 'aud-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), status: status, auditor: auditor, observacao: String(observacao || '').trim(), data: new Date().toISOString() });
      if (!persistir()) { saca.auditorias.pop(); return { sucesso: false, erro: 'Não foi possível salvar a auditoria.' }; }
      renderTudo(); return { sucesso: true };
    }
  };

  // -----------------------------------------------------------------------
  // Início
  // -----------------------------------------------------------------------

  function init() {
    mapearElementos();
    if (!$.inputDataOperacao.value) $.inputDataOperacao.value = valorDataHoraLocal(new Date());
    if (SaveStatus) { SaveStatus.modulo('NEX'); SaveStatus.aoTentarNovamente(function () { if (persistir()) { if (sessaoAtiva()) { $.formIniciarSessao.reset(); $.pacotesFormatado.textContent = ''; } renderTudo(); toast('Dados salvos com sucesso.', 'sucesso'); } }, 'NEX'); }
    carregarEstadoInicial();
    var selector = function () {
      var f = estado.filtroHistorico, hoje = U.dataHojeOperacional(new Date());
      if (f.periodo === 'data' && f.data) return { periodo: 'dia', inicio: f.data, tipo: 'resumido' };
      if (f.periodo === 'intervalo' && f.inicio && f.fim) return { periodo: 'intervalo', inicio: f.inicio, fim: f.fim, tipo: 'resumido' };
      if (f.periodo === 'hoje') return { periodo: 'dia', inicio: hoje, tipo: 'resumido' };
      if (f.periodo === 'ontem') return { periodo: 'dia', inicio: U.deslocarDataOperacional(hoje, -1), tipo: 'resumido' };
      return { periodo: 'todo', tipo: 'resumido' };
    };
    relatorioUiNex = Relatorios.iniciarInterface($.nexRelatorioHistorico, 'NEX', function () { return estado.dados.history; }, function (registros) {
      var f = estado.filtroHistorico;
      var busca = f.busca.trim().toLocaleLowerCase('pt-BR');
      if (!busca && !f.categoria && !f.status) return registros;
      return registros.filter(function (s) {
        return (s.occurrences || []).some(function (o) {
          if (f.categoria && o.category !== f.categoria) return false;
          if (f.status && o.status !== f.status) return false;
          var texto = [o.code || '', C.categoriaLabel(o.category), o.note || ''].join(' ').toLocaleLowerCase('pt-BR');
          return !busca || texto.indexOf(busca) !== -1;
        });
      });
    }, selector, function () {
      var f = estado.filtroHistorico, partes = [];
      if (f.busca.trim()) partes.push('Busca: “' + f.busca.trim() + '”');
      if (f.categoria) partes.push('Categoria: ' + C.categoriaLabel(f.categoria));
      if (f.status) partes.push('Status: ' + C.STATUS_LABEL[f.status]);
      return partes.join(' • ');
    });
    popularSelectCategorias($.selectCategoria, false);
    popularSelectCategorias($.filtroCategoria, true);
    popularSelectCategorias($.editCategoria, false);
    popularSelectCategorias($.historicoCategoria, true);
    atualizarAjudaCategoria();
    configurarImportacaoNex();
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
