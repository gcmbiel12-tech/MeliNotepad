(function (global, document) {
  'use strict';
  var NS = global.MeliNotepad = global.MeliNotepad || {};
  var Regras = NS.QRSacasRegras;
  var UI = NS.UI;
  var CHAVE = 'melinotepad_qr_sacas_v1';
  var store = NS.ModStore.criar({
    chave: CHAVE,
    rotulo: 'QR Sacas',
    padrao: function () { return { versao: 1, rotas: [] }; },
    validar: function (dados) {
      var erros = [];
      if (!dados || dados.versao !== 1 || !Array.isArray(dados.rotas)) return ['estrutura principal inválida'];
      var ids = Object.create(null);
      dados.rotas.forEach(function (rota) {
        if (!rota || typeof rota.id !== 'string' || !rota.id || typeof rota.nome !== 'string' || !rota.nome.trim() || !Array.isArray(rota.sacas)) {
          erros.push('rota inválida'); return;
        }
        if (ids[rota.id]) erros.push('rota duplicada');
        ids[rota.id] = true;
        var nums = Object.create(null);
        rota.sacas.forEach(function (saca) {
          if (!saca || typeof saca.id !== 'string' || !saca.id || !Regras.numeroInteiro(saca.numero) ||
              (saca.payload && (saca.payload.container_id === undefined || typeof saca.payload.facility_id !== 'string' ||
              !Regras.numeroInteiro(saca.payload.assignment)))) erros.push('saca inválida na rota ' + rota.nome);
          else if (nums[saca.numero]) erros.push('numeração duplicada na rota ' + rota.nome);
          else nums[saca.numero] = true;
        });
      });
      return erros;
    }
  });

  var dados = store.carregar().dados;
  var precisaLimparDadosLegados = dados.rotas.some(function (rota) {
    return Object.prototype.hasOwnProperty.call(rota, 'pacotesEstimados') || rota.sacas.some(function (saca) {
      return Object.prototype.hasOwnProperty.call(saca, 'auditorias');
    });
  });
  if (precisaLimparDadosLegados) {
    var limpezaLegada = store.mutar(function (estado) {
      estado.rotas.forEach(function (rota) {
        delete rota.pacotesEstimados;
        rota.sacas.forEach(function (saca) { delete saca.auditorias; });
      });
      return true;
    });
    if (limpezaLegada.sucesso) dados = limpezaLegada.dados;
  }
  var selecionadas = Object.create(null);
  var expandidas = Object.create(null);
  var quantidadeCopias = 6;
  var copiasPorRota = Object.create(null);
  var ultimaSolicitacaoImpressao = 0;
  var statusImportacao = '';
  var ultimaRolagemInteracao = null;
  var app = null;

  function id(prefixo) {
    return prefixo + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }
  function criar(tag, classe, texto) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined && texto !== null) el.textContent = String(texto);
    return el;
  }
  function botao(texto, classe, acao) {
    var b = criar('button', 'botao ' + (classe || 'botao--secundario'), texto);
    b.type = 'button';
    b.addEventListener('click', acao);
    return b;
  }
  function campo(rotulo, controle) {
    var wrap = criar('label', 'qr-sacas__campo');
    wrap.appendChild(criar('span', '', rotulo));
    wrap.appendChild(controle);
    return wrap;
  }
  function escapar(valor) {
    return String(valor == null ? '' : valor).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var catalogoPayloads = null;
  var promessaCatalogoPayloads = null;

  function carregarCatalogoPayloads() {
    if (catalogoPayloads) return Promise.resolve(catalogoPayloads);
    if (promessaCatalogoPayloads) return promessaCatalogoPayloads;
    if (typeof global.fetch !== 'function') return Promise.reject(new Error('O navegador não permite carregar o catálogo de QR Codes.'));
    promessaCatalogoPayloads = global.fetch('dados/qr-sacas/Sacas-1-200.txt', { cache: 'no-store' }).then(function (resposta) {
      if (!resposta.ok) throw new Error('Catálogo de QR Codes indisponível (' + resposta.status + ').');
      return resposta.text();
    }).then(function (texto) {
      var catalogo = Object.create(null);
      var expressao = /^Saca\s+(\d+)\s*\r?\n(\{[^\r\n]+\})/gm;
      var correspondencia;
      while ((correspondencia = expressao.exec(texto))) {
        var numeroBruto = correspondencia[1];
        var numero = String(Number(numeroBruto));
        var leitura = Regras.interpretarPayload(correspondencia[2]);
        if (!Regras.numeroInteiro(numeroBruto) || numeroBruto !== numero ||
            !leitura.valido || leitura.payload.assignment !== numero ||
            !Number.isSafeInteger(Number(leitura.payload.container_id)) || Number(leitura.payload.container_id) <= 0 ||
            catalogo[numero]) {
          throw new Error('O catalogo de QR Codes contem registro invalido ou duplicado na saca ' + numero + '.');
        }
        catalogo[numero] = leitura.payload;
      }
      var numerosCatalogo = Object.keys(catalogo);
      if (numerosCatalogo.length !== 200 ||
          numerosCatalogo.some(function (numero, indice) { return Number(numero) !== indice + 1; })) {
        throw new Error('O catalogo de QR Codes deve conter exatamente as sacas de 1 a 200. Registros encontrados: ' + numerosCatalogo.length + '.');
      }
      catalogoPayloads = catalogo;
      return catalogoPayloads;
    }).catch(function (erro) {
      promessaCatalogoPayloads = null;
      throw erro;
    });
    return promessaCatalogoPayloads;
  }

  function aplicarCatalogoPayloads(estado) {
    var associados = 0;
    var conflitos = [];
    if (!catalogoPayloads) return { associados: associados, conflitos: conflitos };
    estado.rotas.forEach(function (rota) {
      rota.sacas.forEach(function (saca) {
        var payload = catalogoPayloads[String(Number(saca.numero))];
        if (!payload) return;
        if (!saca.payload) {
          saca.payload = {
            container_id: payload.container_id,
            facility_id: payload.facility_id,
            assignment: payload.assignment
          };
          associados++;
        } else if (String(saca.payload.assignment) !== String(saca.numero)) {
          conflitos.push(String(saca.numero));
        }
      });
    });
    return { associados: associados, conflitos: conflitos };
  }

  function temPayloadCatalogoPendente(estado) {
    if (!catalogoPayloads) return false;
    return estado.rotas.some(function (rota) {
      return rota.sacas.some(function (saca) {
        return !saca.payload && !!catalogoPayloads[String(Number(saca.numero))];
      });
    });
  }
  function salvar(mutacao) {
    var resultado = store.mutar(function (estado) {
      mutacao(estado);
      return true;
    });
    if (!resultado.sucesso) {
      UI.avisar(resultado.erro || 'Não foi possível salvar os QR Codes.', 'erro');
      return false;
    }
    dados = resultado.dados;
    return true;
  }
  function manterRolagem(fn) {
    var recente = ultimaRolagemInteracao && Date.now() - ultimaRolagemInteracao.quando < 300;
    var x = recente ? ultimaRolagemInteracao.x : (global.scrollX || 0);
    var y = recente ? ultimaRolagemInteracao.y : (global.scrollY || 0);
    ultimaRolagemInteracao = null;
    fn();
    global.requestAnimationFrame(function () {
      global.scrollTo(x, y);
      global.requestAnimationFrame(function () {
        if (Math.abs((global.scrollY || 0) - y) > 1) global.scrollTo(x, y);
      });
    });
  }
  function rotaPorId(rotaId) {
    return dados.rotas.find(function (r) { return r.id === rotaId; }) || null;
  }
  function chaveSaca(rotaId, sacaId) { return rotaId + ':' + sacaId; }
  function totalSelecionadas() {
    var total = 0;
    dados.rotas.forEach(function (rota) {
      rota.sacas.forEach(function (saca) {
        if (selecionadas[chaveSaca(rota.id, saca.id)]) total++;
      });
    });
    return total;
  }
  function atualizarResumoSelecao() {
    var total = totalSelecionadas();
    var resumo = document.getElementById('qr-sacas-selecao-resumo');
    var botaoImprimir = document.getElementById('qr-sacas-imprimir');
    var botaoImprimirZebra = document.getElementById('qr-sacas-imprimir-zebra');
    var botaoLimpar = document.getElementById('qr-sacas-deselecionar-tudo');
    if (resumo) resumo.textContent = total + (total === 1 ? ' saca selecionada' : ' sacas selecionadas');
    if (botaoImprimir) botaoImprimir.disabled = total === 0;
    if (botaoImprimirZebra) botaoImprimirZebra.disabled = total === 0;
    if (botaoLimpar) botaoLimpar.disabled = total === 0;
  }
  function selecionarTodasSacas() {
    selecionadas = Object.create(null);
    dados.rotas.forEach(function (rota) {
      rota.sacas.forEach(function (saca) { selecionadas[chaveSaca(rota.id, saca.id)] = true; });
    });
    renderizar();
  }
  function deselecionarTodasSacas() {
    selecionadas = Object.create(null);
    renderizar();
  }
  function selecionarSacasRota(rotaId) {
    var rota = rotaPorId(rotaId);
    if (!rota) return;
    var todasSelecionadas = rota.sacas.length > 0 && rota.sacas.every(function (saca) {
      return !!selecionadas[chaveSaca(rota.id, saca.id)];
    });
    rota.sacas.forEach(function (saca) {
      var chave = chaveSaca(rota.id, saca.id);
      if (todasSelecionadas) delete selecionadas[chave];
      else selecionadas[chave] = true;
    });
    manterRolagem(renderizar);
  }
  function atualizarSelectRota(select, selecionada) {
    var vazio = criar('option', '', 'Selecione a rota');
    vazio.value = '';
    select.appendChild(vazio);
    dados.rotas.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' }); }).forEach(function (rota) {
      var op = criar('option', '', rota.nome);
      op.value = rota.id;
      select.appendChild(op);
    });
    if (selecionada) select.value = selecionada;
  }
  function mensagemStatus(texto, tipo) {
    statusImportacao = texto || '';
    var el = document.getElementById('qr-sacas-status');
    if (el) {
      el.textContent = statusImportacao;
      el.className = 'qr-sacas__status' + (tipo ? ' is-' + tipo : '');
      el.hidden = !statusImportacao;
    }
  }

  function renderizarLayoutNex() {
    app.innerHTML = '';
    var topo = criar('header', 'qr-sacas__topo');
    topo.appendChild(criar('p', 'tela-inicial-modulo__eyebrow', 'MELINOTEPAD / QR SACAS'));
    topo.appendChild(criar('h1', '', 'QR Sacas'));
    app.appendChild(topo);

    var importacao = criar('section', 'cartao nex-importacao qr-sacas__importacao');
    importacao.appendChild(criar('h2', 'nex-importacao__titulo', 'Importar planilha'));
    var arquivo = criar('input', '');
    arquivo.type = 'file'; arquivo.id = 'qr-sacas-arquivo'; arquivo.accept = '.xlsx,.csv'; arquivo.hidden = true;
    var areaImportacao = criar('div', 'nex-importacao__area');
    areaImportacao.tabIndex = 0; areaImportacao.setAttribute('role', 'region');
    areaImportacao.setAttribute('aria-label', 'Selecionar ou arrastar uma planilha para importar rotas');
    areaImportacao.appendChild(criar('span', 'nex-importacao__icone', '⇧'));
    var botaoArquivo = botao('Selecionar planilha', 'botao--primario', function () { arquivo.click(); });
    areaImportacao.appendChild(botaoArquivo);
    areaImportacao.appendChild(criar('p', 'texto-apoio', 'Formatos aceitos: Excel (.xlsx) ou CSV (.csv). Também é possível arrastar o arquivo para esta área.'));
    var status = criar('div', 'nex-importacao__estado');
    status.id = 'qr-sacas-status'; status.setAttribute('aria-live', 'polite');
    status.textContent = statusImportacao; status.hidden = !statusImportacao;
    importacao.appendChild(arquivo); importacao.appendChild(areaImportacao); importacao.appendChild(status);
    areaImportacao.addEventListener('click', function (e) { if (e.target === areaImportacao || e.target.tagName === 'P' || e.target.tagName === 'SPAN') arquivo.click(); });
    areaImportacao.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); arquivo.click(); } });
    areaImportacao.addEventListener('dragover', function (e) { e.preventDefault(); areaImportacao.classList.add('is-arrastando'); });
    areaImportacao.addEventListener('dragleave', function () { areaImportacao.classList.remove('is-arrastando'); });
    areaImportacao.addEventListener('drop', function (e) { e.preventDefault(); areaImportacao.classList.remove('is-arrastando'); importarPlanilhaQR(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0], botaoArquivo); });
    arquivo.addEventListener('change', function () { importarPlanilhaQR(arquivo.files && arquivo.files[0], botaoArquivo); });
    var acoesImportacao = criar('div', 'qr-sacas__acoes');
    acoesImportacao.appendChild(botao('Exportar backup JSON', 'botao--secundario', exportarBackup));
    importacao.appendChild(acoesImportacao);
    app.appendChild(importacao);

    var painel = criar('section', 'cartao qr-sacas__painel-rotas');
    var filtros = criar('div', 'qr-sacas__filtros');
    var busca = criar('input', 'qr-sacas__busca');
    busca.type = 'search'; busca.placeholder = 'Buscar rota ou número da saca...';
    busca.setAttribute('aria-label', 'Buscar rota ou número da saca');
    busca.value = filtroBuscaQR;
    filtros.appendChild(busca);
    painel.appendChild(filtros);
    busca.addEventListener('input', function () { filtroBuscaQR = busca.value; atualizarListaRotasQR(listaRotas); });
    var acoesRotas = criar('div', 'nex-rota-acoes qr-sacas__acoes-rotas');
    var controleCopiasGlobal = criar('label', 'qr-sacas__controle-copias-global');
    var valorCopiasGlobal = criar('input', 'qr-sacas__controle-copias-global-valor');
    valorCopiasGlobal.type = 'number';
    valorCopiasGlobal.min = '1';
    valorCopiasGlobal.step = '1';
    valorCopiasGlobal.inputMode = 'numeric';
    valorCopiasGlobal.value = String(quantidadeCopias);
    valorCopiasGlobal.setAttribute('aria-label', 'Quantidade de c\u00f3pias por saca para todas as rotas');
    valorCopiasGlobal.title = 'Quantidade de c\u00f3pias aplicada a todas as rotas. Padr\u00e3o: 6.';
    valorCopiasGlobal.addEventListener('input', function () {
      var digitado = valorCopiasGlobal.value.trim();
      var quantidade = Number(digitado);
      if (digitado && Number.isSafeInteger(quantidade) && quantidade >= 1) quantidadeCopias = quantidade;
    });
    valorCopiasGlobal.addEventListener('change', function () {
      var quantidade = Number(valorCopiasGlobal.value);
      quantidadeCopias = valorCopiasGlobal.value && Number.isSafeInteger(quantidade) && quantidade >= 1 ? quantidade : 6;
      valorCopiasGlobal.value = String(quantidadeCopias);
      atualizarControlesCopiasRotas();
    });
    controleCopiasGlobal.appendChild(valorCopiasGlobal);
    acoesRotas.appendChild(controleCopiasGlobal);
    acoesRotas.appendChild(botao('+ Rota', 'botao--primario', function () {
      var nome = global.prompt('Nome da nova rota:');
      if (nome === null) return;
      nome = nome.trim();
      if (!nome) { UI.avisar('Informe o nome da rota.', 'erro'); return; }
      if (dados.rotas.some(function (r) { return r.nome.toLocaleLowerCase() === nome.toLocaleLowerCase(); })) { UI.avisar('Já existe uma rota com esse nome.', 'erro'); return; }
      if (salvar(function (estado) { estado.rotas.push({ id: id('rota'), nome: nome, sacas: [] }); })) manterRolagem(renderizar);
    }));
    acoesRotas.appendChild(botao('+ Sacas', 'botao--secundario', function () {
      var rotaNome = global.prompt('Informe o nome exato da rota: ' + dados.rotas.map(function (r) { return r.nome; }).join(', '));
      if (rotaNome === null) return;
      var rota = dados.rotas.find(function (r) { return r.nome.toLocaleLowerCase() === rotaNome.trim().toLocaleLowerCase(); });
      if (!rota) { UI.avisar('Rota não encontrada.', 'erro'); return; }
      var texto = global.prompt('Informe os números ou intervalos. Ex.: 10-15, 20, 25');
      if (texto === null) return;
      var parsed = Regras.parsearSelecao(texto);
      if (!parsed.valido) { UI.avisar(parsed.erro, 'erro'); return; }
      var existentes = dados.rotas.reduce(function (acc, r) { return acc.concat(r.sacas.map(function (s) { return String(Number(s.numero)); })); }, []);
      var repetidos = parsed.numeros.filter(function (n) { return existentes.indexOf(String(n)) >= 0; });
      if (repetidos.length) { UI.avisar('Sacas já cadastradas: ' + repetidos.join(', '), 'erro'); return; }
      if (salvar(function (estado) {
        var destino = estado.rotas.find(function (r) { return r.id === rota.id; });
        parsed.numeros.forEach(function (n) { destino.sacas.push({ id: id('saca'), numero: String(n), payload: null }); });
        destino.sacas.sort(function (a, b) { return Number(a.numero) - Number(b.numero); });
      })) { expandidas[rota.id] = true; manterRolagem(renderizar); }
    }));
    acoesRotas.appendChild(botao('Selecionar Tudo', 'botao--secundario', selecionarTodasSacas));
    var deselecionar = botao('Deselecionar Tudo', 'botao--secundario', deselecionarTodasSacas);
    deselecionar.id = 'qr-sacas-deselecionar-tudo';
    deselecionar.disabled = totalSelecionadas() === 0;
    acoesRotas.appendChild(deselecionar);
    var imprimir = botao('Imprimir', 'botao--primario', imprimirSelecionadas);
    imprimir.id = 'qr-sacas-imprimir';
    imprimir.disabled = totalSelecionadas() === 0;
    acoesRotas.appendChild(imprimir);
    var imprimirZebra = botao('Imprimir Zebra', 'botao--secundario', function () { imprimirSelecionadas('zebra'); });
    imprimirZebra.id = 'qr-sacas-imprimir-zebra';
    imprimirZebra.disabled = totalSelecionadas() === 0;
    acoesRotas.appendChild(imprimirZebra);
    painel.appendChild(acoesRotas);
    var resumoSelecao = criar('p', 'qr-sacas__selecao-resumo', totalSelecionadas() + (totalSelecionadas() === 1 ? ' saca selecionada' : ' sacas selecionadas'));
    resumoSelecao.id = 'qr-sacas-selecao-resumo';
    resumoSelecao.setAttribute('aria-live', 'polite');
    painel.appendChild(resumoSelecao);
    var listaRotas = criar('div', 'nex-lista-rotas qr-sacas__lista-rotas');
    painel.appendChild(listaRotas);
    app.appendChild(painel);
    atualizarListaRotasQR(listaRotas);
  }

  var filtroBuscaQR = '';

  function atualizarControlesCopiasRotas() {
    if (!app) return;
    app.querySelectorAll('.qr-sacas__controle-copias-rota-valor').forEach(function (entrada) {
      var rotaId = entrada.getAttribute('data-rota-id');
      if (!Object.prototype.hasOwnProperty.call(copiasPorRota, rotaId)) entrada.value = String(quantidadeCopias);
    });
  }

  function criarControleCopiasRota(rota) {
    var controle = criar('label', 'qr-sacas__controle-copias-rota');
    var entrada = criar('input', 'qr-sacas__controle-copias-rota-valor');
    entrada.type = 'number';
    entrada.min = '1';
    entrada.step = '1';
    entrada.inputMode = 'numeric';
    entrada.value = String(Object.prototype.hasOwnProperty.call(copiasPorRota, rota.id) ? copiasPorRota[rota.id] : quantidadeCopias);
    entrada.setAttribute('data-rota-id', rota.id);
    entrada.setAttribute('aria-label', 'Quantidade de c?pias por saca da rota ' + rota.nome);
    entrada.title = 'Quantidade individual desta rota. O valor universal atual ? ' + quantidadeCopias + '.';
    entrada.addEventListener('change', function () {
      var digitado = entrada.value.trim();
      var quantidade = Number(digitado);
      if (!digitado) delete copiasPorRota[rota.id];
      else if (Number.isSafeInteger(quantidade) && quantidade >= 1) copiasPorRota[rota.id] = quantidade;
      else delete copiasPorRota[rota.id];
      entrada.value = String(Object.prototype.hasOwnProperty.call(copiasPorRota, rota.id) ? copiasPorRota[rota.id] : quantidadeCopias);
    });
    controle.appendChild(entrada);
    return controle;
  }

  function atualizarListaRotasQR(lista) {
    while (lista.firstChild) lista.removeChild(lista.firstChild);
    var termo = filtroBuscaQR.trim().toLocaleLowerCase('pt-BR');
    var rotas = dados.rotas.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' }); });
    if (!rotas.length) { lista.appendChild(criar('p', 'texto-apoio', 'As rotas importadas ou cadastradas manualmente aparecerão aqui.')); return; }
    rotas.forEach(function (rota) {
      var todas = rota.sacas.slice().sort(function (a, b) { return Number(a.numero) - Number(b.numero); });
      var rotaCombina = !!termo && rota.nome.toLocaleLowerCase('pt-BR').includes(termo);
      var sacas = todas.filter(function (s) {
        return !termo || rotaCombina || String(s.numero).includes(termo);
      });
      if (termo && !rotaCombina && !sacas.length) return;
      if (termo && rotaCombina) sacas = todas;
      if (termo && !sacas.length) return;
      var abertas = !!expandidas[rota.id] || !!termo;
      var card = criar('article', 'cartao nex-rota-card nex-rota-card--qr qr-sacas__rota-card' + (abertas ? ' is-aberta' : ''));
      var toggle = botao('', 'nex-rota-toggle qr-sacas__rota-toggle', function () {
        manterRolagem(function () { expandidas[rota.id] = !expandidas[rota.id]; renderizar(); });
      });
      toggle.setAttribute('aria-expanded', String(abertas));
      var info = criar('span', 'nex-rota-toggle__info');
      info.appendChild(criar('strong', 'nex-rota-nome', rota.nome));
      info.appendChild(criar('span', 'nex-rota-resumo', todas.length + (todas.length === 1 ? ' saca' : ' sacas')));
      toggle.appendChild(info);
      toggle.appendChild(criar('span', 'nex-rota-chevron', abertas ? '−' : '+'));
      var barra = criar('div', 'nex-rota-barra');
      var selecionadasNaRota = todas.filter(function (saca) {
        return !!selecionadas[chaveSaca(rota.id, saca.id)];
      }).length;
      var selecionarRota = criar('input', 'qr-sacas__selecao-rota');
      selecionarRota.type = 'checkbox';
      selecionarRota.checked = todas.length > 0 && selecionadasNaRota === todas.length;
      selecionarRota.indeterminate = selecionadasNaRota > 0 && selecionadasNaRota < todas.length;
      selecionarRota.disabled = todas.length === 0;
      selecionarRota.setAttribute('aria-label', 'Selecionar todas as ' + todas.length + ' sacas da rota ' + rota.nome);
      selecionarRota.title = 'Selecionar ou desmarcar todas as sacas desta rota';
      selecionarRota.addEventListener('change', function () { selecionarSacasRota(rota.id); });
      barra.appendChild(selecionarRota);
      barra.appendChild(toggle);
      var removerRota = botao('Retirar rota', 'botao--secundario nex-remover-rota', function () { retirarRota(rota.id); });
      removerRota.setAttribute('aria-label', 'Retirar rota ' + rota.nome);
      barra.appendChild(removerRota);
      barra.appendChild(criarControleCopiasRota(rota));
      card.appendChild(barra);

      var conteudo = criar('div', 'nex-rota-conteudo qr-sacas__rota-conteudo');
      conteudo.hidden = !abertas;
      var acoes = criar('div', 'nex-acoes-sacas');
      acoes.appendChild(botao('+ Adicionar saca', 'botao--secundario nex-adicionar-saca', function () { adicionarSacaManual(rota.id); }));
      conteudo.appendChild(acoes);
      if (!sacas.length) conteudo.appendChild(criar('p', 'texto-apoio', 'Ainda não há sacas individuais vinculadas a esta rota.'));
      var listaSacas = criar('div', 'nex-lista-sacas');
      sacas.forEach(function (saca) {
        var cartaoSaca = criar('div', 'qr-sacas__saca-card');
        var chave = chaveSaca(rota.id, saca.id);
        if (selecionadas[chave]) cartaoSaca.classList.add('is-selecionada');
        var caixaSelecao = criar('input', 'qr-sacas__selecao');
        caixaSelecao.type = 'checkbox';
        caixaSelecao.checked = !!selecionadas[chave];
        caixaSelecao.setAttribute('aria-label', 'Selecionar saca ' + saca.numero + ' da rota ' + rota.nome);
        caixaSelecao.addEventListener('change', function () {
          if (caixaSelecao.checked) selecionadas[chave] = true;
          else delete selecionadas[chave];
          cartaoSaca.classList.toggle('is-selecionada', caixaSelecao.checked);
          var totalSelecionadasRota = todas.filter(function (item) {
            return !!selecionadas[chaveSaca(rota.id, item.id)];
          }).length;
          selecionarRota.checked = todas.length > 0 && totalSelecionadasRota === todas.length;
          selecionarRota.indeterminate = totalSelecionadasRota > 0 && totalSelecionadasRota < todas.length;
          atualizarResumoSelecao();
        });
        cartaoSaca.appendChild(caixaSelecao);
        var numero = criar('span', 'nex-saca-numero qr-sacas__numero', String(saca.numero));
        numero.setAttribute('aria-label', 'Saca ' + saca.numero);
        var trocarNumero = botao('\u270e', 'qr-sacas__trocar-numero', function () {
          abrirEdicaoInline(rota.id, saca.id, cartaoSaca);
        });
        trocarNumero.setAttribute('aria-label', 'Alterar numera\u00e7\u00e3o da saca ' + saca.numero);
        trocarNumero.title = 'Alterar numera\u00e7\u00e3o';
        cartaoSaca.appendChild(numero);
        cartaoSaca.appendChild(trocarNumero);
        listaSacas.appendChild(cartaoSaca);
      });
      conteudo.appendChild(listaSacas);
      card.appendChild(conteudo);
      lista.appendChild(card);
    });
    atualizarResumoSelecao();
  }

  function renderizar() {
    if (!app) return;
    renderizarLayoutNex();
  }

  function abrirEdicaoInline(rotaId, sacaId, cartao) {
    var editor = cartao.querySelector('.qr-sacas__edicao-inline');
    if (editor) {
      editor.hidden = !editor.hidden;
      if (!editor.hidden) {
        var campoExistente = editor.querySelector('input');
        if (campoExistente) { campoExistente.focus(); campoExistente.select(); }
      }
      return;
    }

    var rota = rotaPorId(rotaId);
    var saca = rota && rota.sacas.find(function (item) { return item.id === sacaId; });
    if (!saca) return;

    editor = criar('form', 'qr-sacas__edicao-inline');
    var entrada = criar('input', 'qr-sacas__edicao-inline-input');
    entrada.type = 'number';
    entrada.min = '1';
    entrada.step = '1';
    entrada.required = true;
    entrada.value = saca.numero;
    entrada.setAttribute('aria-label', 'Nova numeração da saca ' + saca.numero);

    var confirmar = criar('button', 'qr-sacas__edicao-inline-confirmar', '✓');
    confirmar.type = 'submit';
    confirmar.setAttribute('aria-label', 'Confirmar nova numeração');
    var cancelar = criar('button', 'qr-sacas__edicao-inline-cancelar', '×');
    cancelar.type = 'button';
    cancelar.setAttribute('aria-label', 'Cancelar alteração');
    cancelar.addEventListener('click', function () { editor.hidden = true; });

    editor.appendChild(entrada);
    editor.appendChild(confirmar);
    editor.appendChild(cancelar);
    editor.addEventListener('submit', function (e) {
      e.preventDefault();
      salvarEdicaoInline(rotaId, sacaId, entrada.value);
    });
    cartao.appendChild(editor);
    entrada.focus();
    entrada.select();
  }

  function salvarEdicaoInline(rotaId, sacaId, novoNumero) {
    var rota = rotaPorId(rotaId);
    if (!rota) return;
    var indice = rota.sacas.findIndex(function (s) { return s.id === sacaId; });
    if (indice < 0) return;

    var ajuste = Regras.ajustarSequencia(rota.sacas, indice, novoNumero);
    if (!ajuste.valido) {
      UI.avisar(ajuste.erro, 'erro');
      return;
    }
    if (!salvar(function (estado) {
      var destino = estado.rotas.find(function (r) { return r.id === rotaId; });
      if (!destino) throw new Error('A rota não foi encontrada.');
      destino.sacas = ajuste.sacas;
    })) return;

    expandidas[rotaId] = true;
    manterRolagem(renderizar);
    UI.avisar('Numeração atualizada. As sacas seguintes e os assignments já associados foram ajustados.', 'sucesso');
  }

  function adicionarSacaManual(rotaId) {
    var numero = global.prompt('Número da nova saca:');
    if (numero === null) return;
    numero = String(numero).trim();
    if (!Regras.numeroInteiro(numero)) { UI.avisar('Informe um número inteiro positivo.', 'erro'); return; }
    if (dados.rotas.some(function (r) { return r.sacas.some(function (s) { return String(Number(s.numero)) === String(Number(numero)); }); })) {
      UI.avisar('Essa saca já está cadastrada em outra rota.', 'erro'); return;
    }
    if (salvar(function (estado) {
      var destino = estado.rotas.find(function (r) { return r.id === rotaId; });
      destino.sacas.push({ id: id('saca'), numero: String(Number(numero)), payload: null,  });
      destino.sacas.sort(function (a, b) { return Number(a.numero) - Number(b.numero); });
    })) {
      expandidas[rotaId] = true; manterRolagem(renderizar); UI.avisar('Saca adicionada à rota.', 'sucesso');
    }
  }

  function retirarRota(rotaId) {
    var rota = rotaPorId(rotaId);
    if (!rota || !global.confirm('Retirar a rota ' + rota.nome + '? Todas as sacas vinculadas tambem serao removidas deste aparelho.')) return;
    if (salvar(function (estado) { estado.rotas = estado.rotas.filter(function (r) { return r.id !== rotaId; }); })) {
      Object.keys(selecionadas).forEach(function (k) { if (k.indexOf(rotaId + ':') === 0) delete selecionadas[k]; });
      delete expandidas[rotaId];
      manterRolagem(renderizar); UI.avisar('Rota retirada.', 'sucesso');
    }
  }

  function extrairCSV(texto) {
    var linhas = [], linha = [], valor = '', aspas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (c === '"' && aspas && texto[i + 1] === '"') { valor += '"'; i++; }
      else if (c === '"') aspas = !aspas;
      else if (c === ',' && !aspas) { linha.push(valor); valor = ''; }
      else if ((c === '\n' || c === '\r') && !aspas) {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        linha.push(valor); if (linha.some(function (x) { return x.trim(); })) linhas.push(linha);
        linha = []; valor = '';
      } else valor += c;
    }
    linha.push(valor); if (linha.some(function (x) { return x.trim(); })) linhas.push(linha);
    if (linhas.length < 2) return [];
    var cabecalhos = linhas.shift().map(function (x) { return x.trim().toLowerCase().replace(/^\ufeff/, ''); });
    var idx = { container_id: cabecalhos.indexOf('container_id'), facility_id: cabecalhos.indexOf('facility_id'), assignment: cabecalhos.indexOf('assignment') };
    if (idx.container_id < 0 || idx.facility_id < 0 || idx.assignment < 0) throw new Error('CSV precisa conter as colunas container_id, facility_id e assignment.');
    return linhas.map(function (l) {
      var o = {}; Object.keys(idx).forEach(function (k) { o[k] = l[idx[k]]; }); return o;
    });
  }

  function registrosDeTexto(texto, extensao) {
    if (extensao === 'csv') return extrairCSV(texto);
    var p;
    try { p = JSON.parse(texto); } catch (e) { throw new Error('O JSON selecionado não é válido.'); }
    if (p && p.melinotepadQRBackup === true && p.dados) {
      if (!global.confirm('Este arquivo é um backup completo do QR Sacas. Deseja substituir os dados locais atuais?')) return null;
      var validacao = store.carregar();
      return { backup: p.dados };
    }
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.codes)) return p.codes;
    if (p && Array.isArray(p.qrCodes)) return p.qrCodes;
    return [p];
  }

  async function lerPDF(arquivo) {
    if (!global.pdfjsLib || !global.jsQR) throw new Error('Os componentes locais de leitura de PDF/QR não foram carregados.');
    global.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
    var documento = await global.pdfjsLib.getDocument({ data: await arquivo.arrayBuffer() }).promise;
    if (documento.numPages > 500) throw new Error('O PDF excede o limite de 500 páginas por importação.');
    var encontrados = [];
    for (var paginaNumero = 1; paginaNumero <= documento.numPages; paginaNumero++) {
      mensagemStatus('Lendo página ' + paginaNumero + ' de ' + documento.numPages + '…', 'info');
      var pagina = await documento.getPage(paginaNumero);
      var viewport = pagina.getViewport({ scale: 2.4 });
      var canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      var contexto = canvas.getContext('2d', { willReadFrequently: true });
      await pagina.render({ canvasContext: contexto, viewport: viewport }).promise;
      var larguraTile = Math.min(canvas.width, Math.max(900, Math.floor(canvas.width * 0.63)));
      var alturaTile = Math.min(canvas.height, Math.max(900, Math.floor(canvas.height * 0.45)));
      var posicoesX = [0, canvas.width - larguraTile];
      var posicoesY = [0, Math.min(canvas.height - alturaTile, Math.floor(canvas.height * 0.385)), canvas.height - alturaTile];
      var regioes = [];
      posicoesY.forEach(function (py) {
        posicoesX.forEach(function (px) {
          if (!regioes.some(function (r) { return r.x === px && r.y === py; })) {
            regioes.push({ x: px, y: py, w: larguraTile, h: alturaTile });
          }
        });
      });
      var vistosNaPagina = Object.create(null);
      regioes.forEach(function (regiao) {
        var scanCanvas = document.createElement('canvas');
        scanCanvas.width = regiao.w; scanCanvas.height = regiao.h;
        var scanContexto = scanCanvas.getContext('2d', { willReadFrequently: true });
        scanContexto.drawImage(canvas, regiao.x, regiao.y, regiao.w, regiao.h, 0, 0, regiao.w, regiao.h);
        for (var tentativa = 0; tentativa < 40; tentativa++) {
          var imagem = scanContexto.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
          for (var pixel = 0; pixel < imagem.data.length; pixel += 4) {
            var luminancia = imagem.data[pixel] * 0.299 + imagem.data[pixel + 1] * 0.587 + imagem.data[pixel + 2] * 0.114;
            var tom = luminancia < 150 ? 0 : 255;
            imagem.data[pixel] = imagem.data[pixel + 1] = imagem.data[pixel + 2] = tom;
            imagem.data[pixel + 3] = 255;
          }
          var codigo = global.jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: 'attemptBoth' });
          if (!codigo) break;
          if (!vistosNaPagina[codigo.data]) {
            vistosNaPagina[codigo.data] = true;
            encontrados.push(codigo.data);
          }
          var pontos = [codigo.location.topLeftCorner, codigo.location.topRightCorner, codigo.location.bottomLeftCorner, codigo.location.bottomRightCorner];
          var xs = pontos.map(function (p) { return p.x; });
          var ys = pontos.map(function (p) { return p.y; });
          var x = Math.max(0, Math.min.apply(Math, xs) - 28);
          var y = Math.max(0, Math.min.apply(Math, ys) - 28);
          var w = Math.min(scanCanvas.width - x, Math.max.apply(Math, xs) - Math.min.apply(Math, xs) + 56);
          var h = Math.min(scanCanvas.height - y, Math.max.apply(Math, ys) - Math.min.apply(Math, ys) + 56);
          scanContexto.fillStyle = '#fff'; scanContexto.fillRect(x, y, w, h);
        }
      });
      pagina.cleanup();
    }
    await documento.destroy();
    return encontrados;
  }

  async function importarArquivo(arquivo, rotaId) {
    if (arquivo.size > 25 * 1024 * 1024) { UI.avisar('O arquivo excede o limite de 25 MB.', 'erro'); return; }
    var extensao = String(arquivo.name || '').split('.').pop().toLowerCase();
    if (['pdf', 'json', 'csv'].indexOf(extensao) < 0) { UI.avisar('Formato não suportado. Use PDF, JSON ou CSV.', 'erro'); return; }
    var botaoImportar = document.querySelector('#qr-sacas-app .qr-sacas__importacao button');
    if (botaoImportar) botaoImportar.disabled = true;
    try {
      mensagemStatus('Preparando importação…', 'info');
      var registros;
      if (extensao === 'pdf') registros = await lerPDF(arquivo);
      else registros = registrosDeTexto(await arquivo.text(), extensao);
      if (registros === null) { mensagemStatus('Importação cancelada.', 'info'); return; }
      if (registros && registros.backup) {
        var backup = registros.backup;
        if (!backup || backup.versao !== 1 || !Array.isArray(backup.rotas)) throw new Error('Backup QR Sacas inválido.');
        var substituicao = store.gravar(backup);
        if (!substituicao.sucesso) throw new Error(substituicao.erro);
        dados = backup; selecionadas = Object.create(null); expandidas = Object.create(null);
        mensagemStatus('Backup restaurado: ' + dados.rotas.length + ' rotas.', 'sucesso');
        manterRolagem(renderizar); return;
      }
      if (!Array.isArray(registros) || !registros.length) throw new Error('Nenhum QR Code foi encontrado no arquivo.');
      var rota = rotaPorId(rotaId);
      if (!rota) throw new Error('A rota selecionada não existe mais.');
      var validos = [], invalidos = 0, duplicados = 0;
      registros.forEach(function (bruto) {
        var leitura = Regras.interpretarPayload(bruto);
        if (!leitura.valido) { invalidos++; return; }
        var payload = leitura.payload;
        if (rota.sacas.some(function (s) { return s.numero === payload.assignment; }) ||
            validos.some(function (s) { return s.numero === payload.assignment; })) { duplicados++; return; }
        validos.push({ id: id('saca'), numero: payload.assignment, payload: payload });
      });
      if (!validos.length) throw new Error('Nenhum código válido e novo foi encontrado. Inválidos: ' + invalidos + '; duplicados: ' + duplicados + '.');
      if (!salvar(function (estado) {
        var destino = estado.rotas.find(function (r) { return r.id === rotaId; });
        Array.prototype.push.apply(destino.sacas, validos);
      })) return;
      expandidas[rotaId] = true;
      mensagemStatus('Importa\u00e7\u00e3o conclu\u00edda: ' + validos.length + ' c\u00f3digos adicionados; ' + invalidos + ' inv\u00e1lidos e ' + duplicados + ' duplicados ignorados.', 'sucesso');
      manterRolagem(renderizar);
    } catch (erro) {
      mensagemStatus(erro && erro.message ? erro.message : 'Falha ao importar o arquivo.', 'erro');
      UI.avisar(erro && erro.message ? erro.message : 'Falha ao importar o arquivo.', 'erro');
    } finally {
      var atual = document.querySelector('#qr-sacas-app .qr-sacas__importacao button');
      if (atual) atual.disabled = false;
    }
  }

  function importarPlanilhaQR(arquivo, botaoImportar) {
    if (!arquivo) return;
    var extensao = String(arquivo.name || '').split('.').pop().toLowerCase();
    if (['xlsx', 'csv'].indexOf(extensao) < 0) {
      mensagemStatus('Formato n\u00e3o suportado. Selecione um arquivo .xlsx ou .csv.', 'erro');
      return;
    }
    if (!arquivo.size || arquivo.size > 20 * 1024 * 1024) {
      mensagemStatus('O arquivo est\u00e1 vazio ou excede o limite de 20 MB.', 'erro');
      return;
    }
    if (!NS.NexPlanilha || typeof NS.NexPlanilha.analisarArquivo !== 'function') {
      mensagemStatus('O leitor de planilhas do NEX n\u00e3o foi carregado. Atualize a p\u00e1gina.', 'erro');
      return;
    }
    if (!global.confirm('Importar "' + arquivo.name + '"? As sacas atualmente cadastradas ser\u00e3o substitu\u00eddas pelas sacas recriadas a partir da planilha, seguindo a mesma sequ\u00eancia global do NEX. Deseja continuar?')) return;
    if (botaoImportar) botaoImportar.disabled = true;
    mensagemStatus('Lendo e validando a planilha...', 'info');
    NS.NexPlanilha.analisarArquivo(arquivo).then(function (resultado) {
      return carregarCatalogoPayloads().catch(function () { return null; }).then(function () {
      if (!resultado || !Array.isArray(resultado.rotas) || !resultado.rotas.length) {
        throw new Error('A planilha n\u00e3o cont\u00e9m rotas HYBRID para importar.');
      }
      var importadas = 0;
      var atualizadas = 0;
      var associacaoCatalogo = { associados: 0, conflitos: [] };
      var gravacao = store.mutar(function (estado) {
        estado.rotas.forEach(function (rota) { rota.sacas = []; delete rota.pacotesEstimados; });
        var rotasOrdenadas = resultado.rotas.slice().sort(function (a, b) {
          return String(a.rota).localeCompare(String(b.rota), 'pt-BR', { numeric: true, sensitivity: 'base' });
        });
        var proximoNumero = 1;
        rotasOrdenadas.forEach(function (item) {
          var existente = estado.rotas.find(function (r) {
            return String(r.nome).trim().toLocaleLowerCase('pt-BR') === String(item.rota).trim().toLocaleLowerCase('pt-BR');
          });
          var destino = existente;
          if (existente) {
            existente.idOtimizado = item.idOtimizado;
            existente.servico = item.servico;
            existente.quantidadeSacas = item.sacas;
            atualizadas++;
          } else {
            destino = {
              id: id('rota'), nome: item.rota, idOtimizado: item.idOtimizado,
              servico: item.servico, quantidadeSacas: item.sacas, sacas: []
            };
            estado.rotas.push(destino);
            importadas++;
          }
          destino.sacas = [];
          for (var i = 0; i < item.sacas; i++) {
            destino.sacas.push({ id: id('saca'), numero: String(proximoNumero++), payload: null });
          }
        });
        associacaoCatalogo = aplicarCatalogoPayloads(estado);
        return true;
      });
      if (!gravacao.sucesso) throw new Error(gravacao.erro || 'N\u00e3o foi poss\u00edvel salvar as rotas importadas.');
      dados = gravacao.dados;
      selecionadas = Object.create(null);
      mensagemStatus('Importa\u00e7\u00e3o conclu\u00edda: ' + resultado.rotas.length + ' rota(s) e ' +
        resultado.totalSacas + ' sacas. ' + importadas + ' rota(s) adicionada(s) e ' + atualizadas +
        ' atualizada(s). ' + associacaoCatalogo.associados + ' QR Codes associados.', 'sucesso');
      manterRolagem(renderizar);
      });
    }).catch(function (erro) {
      mensagemStatus(erro && erro.message ? erro.message : 'N\u00e3o foi poss\u00edvel importar a planilha.', 'erro');
    }).then(function () {
      if (botaoImportar) botaoImportar.disabled = false;
      var campoArquivo = document.getElementById('qr-sacas-arquivo');
      if (campoArquivo) campoArquivo.value = '';
    });
  }

  function exportarBackup() {
    var backupExportado = { melinotepadQRBackup: true, exportadoEm: new Date().toISOString(), dados: dados };
    UI.baixarArquivo('qr-sacas-backup.json', JSON.stringify(backupExportado, null, 2), 'application/json');
    UI.avisar('Backup QR Sacas preparado. Salve o arquivo em dados/qr-sacas/ para manter uma cópia no projeto.', 'sucesso');
  }

  function imprimirItens(itens, formato) {
    formato = formato === 'zebra' ? 'zebra' : 'a4';
    if (Date.now() - ultimaSolicitacaoImpressao < 1500) {
      UI.avisar('Wait briefly before starting another print.', 'erro');
      return;
    }
    if (!itens || !itens.length) { UI.avisar('Nenhuma saca selecionada para impressǜo.', 'erro'); return; }
    var semPayload = [];
    var assignments = Object.create(null);
    var totalEtiquetas = 0;
    itens.forEach(function (item) {
      var leitura = Regras.interpretarPayload(item.saca && item.saca.payload);
      var numero = String(item.saca && item.saca.numero);
      var copias = item.copias === undefined || item.copias === null ? 6 : Number(item.copias);
      if (!leitura.valido || leitura.payload.assignment !== numero ||
          !Number.isSafeInteger(Number(leitura.payload.container_id)) || Number(leitura.payload.container_id) <= 0) {
        semPayload.push(numero);
        return;
      }
      if (assignments[leitura.payload.assignment]) {
        semPayload.push(numero + ' (assignment duplicado ' + leitura.payload.assignment + ')');
        return;
      }
      assignments[leitura.payload.assignment] = true;
      if (!Number.isSafeInteger(copias) || copias < 1) {
        semPayload.push(numero + ' (quantidade invǭlida)');
        return;
      }
      totalEtiquetas += copias;
    });
    if (semPayload.length) {
      UI.avisar('Impressǜo bloqueada. Corrija os QR Codes ou assignments destas sacas: ' + semPayload.join(', ') + '.', 'erro');
      return;
    }
    if (totalEtiquetas > 2000) {
      UI.avisar('Impressǜo bloqueada: o trabalho teria ' + totalEtiquetas +
        ' etiquetas. Divida em trabalhos menores (limite de seguranǟa: 2.000).', 'erro');
      return;
    }
    if (totalEtiquetas > 300 && !global.confirm('Este trabalho gerarǭ ' + totalEtiquetas +
        ' etiquetas. A preparaǟǜo pode levar algum tempo. Deseja continuar?')) return;
    if (typeof global.qrcode !== 'function') { UI.avisar('O gerador de QR Code nǜo foi carregado.', 'erro'); return; }
    var janela = global.open('', '_blank');
    if (!janela) {
      UI.avisar('O navegador bloqueou a janela de impressǜo. Permita pop-ups para este site.', 'erro');
      return;
    }
    var conteudo = '';
    try {
      itens.forEach(function (item) {
        var copiasItem = item.copias === undefined || item.copias === null ? 6 : Number(item.copias);
        for (var copia = 0; copia < copiasItem; copia++) {
          var qr = global.qrcode(0, 'M');
          qr.addData(JSON.stringify(item.saca.payload), 'Byte');
          qr.make();
          if (formato === 'zebra') {
            conteudo += '<article class="etiqueta"><section class="face face-info"><strong class="rota">' + escapar(item.rota) + '</strong>' +
              '<strong class="numero">SACA ' + escapar(item.saca.numero) + '</strong></section>' +
              '<section class="face face-qr"><span class="marcador-dobra">DOBRA</span>' + qr.createSvgTag(5, 2) + '</section></article>';
          } else {
            conteudo += '<article class="etiqueta"><strong class="rota">' + escapar(item.rota) + '</strong>' +
              qr.createSvgTag(5, 2) +
              '<strong class="numero">SACA ' + escapar(item.saca.numero) + '</strong></article>';
          }
        }
      });
    } catch (erroGeracao) {
      try { janela.close(); } catch (erroFechar) {}
      UI.avisar('Nǜo foi possǧvel gerar as etiquetas. Nenhum trabalho foi enviado ǭ impressora. ' +
        (erroGeracao && erroGeracao.message ? erroGeracao.message : ''), 'erro');
      return;
    }
    var estilo = formato === 'zebra' ?
      '@page{size:100mm 150mm;margin:0}*{box-sizing:border-box}html,body{width:100mm;margin:0;padding:0;font:14px Arial,sans-serif;color:#172033;background:#fff}.folha{width:100mm;margin:0;padding:0}.etiqueta{display:grid;grid-template-rows:75mm 75mm;width:100mm;height:150mm;margin:0;padding:0;overflow:hidden;break-after:page;break-inside:avoid;background:#fff}.etiqueta:last-child{break-after:auto}.face{width:100mm;height:75mm;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}.face-info{flex-direction:column;gap:13mm;padding:7mm}.rota{display:flex;align-items:center;justify-content:center;min-width:28mm;min-height:14mm;padding:2mm 6mm;border:0.6mm solid #172033;border-radius:2mm;color:#172033;font-size:22pt;font-weight:800;line-height:1;letter-spacing:.08em}.numero{display:block;margin:0;color:#172033;font-size:27pt;font-weight:800;line-height:1;letter-spacing:.035em}.face-qr{border-top:0.6mm dotted #303846;padding:0}.face-qr svg{display:block;width:64mm;height:64mm;max-width:64mm;max-height:64mm;flex:0 0 auto}.marcador-dobra{position:absolute;top:0;left:50%;transform:translate(-50%,-50%);padding:0 2.5mm;background:#fff;color:#172033;font-size:7pt;font-weight:800;letter-spacing:.1em;line-height:1.2}@media screen{body{padding:8mm;background:#e9edf2}.etiqueta{margin:0 auto 8mm;box-shadow:0 2px 10px rgba(20,32,50,.12)}}' :
      '@page{size:A4;margin:2mm}*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#172033;margin:0;background:#fff}.folha{display:grid;grid-template-columns:repeat(2,100mm);grid-auto-rows:144mm;gap:4mm;align-content:start;justify-content:center}.etiqueta{display:flex;width:100mm;height:144mm;max-width:100mm;max-height:144mm;padding:5mm 4mm;border:1px solid #d7dce5;border-radius:3mm;flex-direction:column;align-items:center;justify-content:space-between;break-inside:avoid;background:#fff;overflow:hidden}.rota{display:block;margin:0;color:#172033;font-size:24pt;font-weight:800;line-height:1;letter-spacing:.06em}.etiqueta svg{display:block;width:88mm;height:88mm;max-width:100%;flex:0 0 auto}.numero{display:block;margin:0;color:#172033;font-size:20pt;font-weight:800;line-height:1;letter-spacing:.04em}@media screen{body{padding:8mm;background:#f3f5f8}.folha{width:max-content;margin:0 auto}.etiqueta{box-shadow:0 2px 8px rgba(20,32,50,.08)}}@media print{.folha{gap:4mm}.etiqueta{border:1px solid #cfd5df;border-radius:2mm;break-inside:avoid}}';
    janela.document.open();
    janela.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QR Sacas - Impressǜo ' + (formato === 'zebra' ? 'Zebra' : 'A4') + '</title><style>' + estilo + '</style></head><body><main class="folha">' + conteudo + '</main><script>window.addEventListener("load",function(){setTimeout(function(){window.print()},350)});</script></body></html>');
    janela.document.close();
    ultimaSolicitacaoImpressao = Date.now();
  }

  function imprimirSelecionadas(formato) {
    var itens = [];
    dados.rotas.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' }); }).forEach(function (rota) {
      rota.sacas.forEach(function (saca) {
        if (selecionadas[chaveSaca(rota.id, saca.id)]) {
          itens.push({ rota: rota.nome, saca: saca, copias: Object.prototype.hasOwnProperty.call(copiasPorRota, rota.id) ? copiasPorRota[rota.id] : quantidadeCopias });
        }
      });
    });
    imprimirItens(itens, formato);
  }
  function imprimirFaixa(rota, texto) {
    var resultado = Regras.parsearSelecao(texto);
    if (!resultado.valido) { UI.avisar(resultado.erro, 'erro'); return; }
    var porNumero = Object.create(null);
    rota.sacas.forEach(function (s) { porNumero[s.numero] = s; });
    var ausentes = resultado.numeros.filter(function (n) { return !porNumero[String(n)]; });
    if (ausentes.length) { UI.avisar('Não existem estas sacas na rota ' + rota.nome + ': ' + ausentes.join(', '), 'erro'); return; }
    imprimirItens(resultado.numeros.map(function (n) { return { rota: rota.nome, saca: porNumero[String(n)] }; }));
  }

  function iniciar() {
    app = document.getElementById('qr-sacas-app');
    if (!app) return;
    app.addEventListener('pointerdown', function () {
      ultimaRolagemInteracao = { x: global.scrollX || 0, y: global.scrollY || 0, quando: Date.now() };
    }, true);
    renderizar();
    carregarCatalogoPayloads().then(function () {
      if (!temPayloadCatalogoPendente(store.carregar().dados)) return;
      var gravacaoCatalogo = store.mutar(function (estado) {
        aplicarCatalogoPayloads(estado);
        return true;
      });
      if (gravacaoCatalogo.sucesso) dados = gravacaoCatalogo.dados;
      renderizar();
    }).catch(function (erro) {
      if (global.console && typeof global.console.warn === 'function') global.console.warn(erro);
    });
  }

  document.addEventListener('melios:modulo', function (e) {
    if (e.detail && e.detail.modulo === 'qr-sacas') {
      if (!app) iniciar();
      else renderizar();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  NS.QRSacas = { recarregar: function () { dados = store.carregar().dados; renderizar(); }, exportarBackup: exportarBackup };
})(window, document);
