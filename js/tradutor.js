
(function (window, document) {
  'use strict';

  var CHAVE_IDIOMA = 'melinotepad_idioma';
  var idioma = 'pt';
  var observador = null;
  var textosOriginais = new WeakMap();
  var atributosOriginais = new WeakMap();
  var reportInstalado = false;

  try {
    idioma = localStorage.getItem(CHAVE_IDIOMA) || 'pt';
  } catch (e) {}

  if (idioma !== 'es') idioma = 'pt';

  var DICIONARIO = {
    'Pular para o conteúdo': 'Saltar al contenido',
    'Idioma / Language:': 'Idioma / Language:',
    'Sem sessão ativa': 'Sin sesión activa',
    'Sessão atual': 'Sesión actual',
    'Sessões finalizadas': 'Sesiones finalizadas',
    'Sessão • Finalizada • Data:': 'Sesión • Finalizada • Fecha:',
    'Sessão': 'Sesión',
    'sessão': 'sesión',
    'sessões': 'sesiones',

    'Nova conferência': 'Nuevo control',
    'Iniciar conferência': 'Iniciar control',
    'Finalizar conferência': 'Finalizar control',
    'Finalizar control': 'Finalizar control',
    'Editar totais': 'Editar totales',
    'Pré-visualizar relatório': 'Vista previa del informe',
    'Pré-visualizar': 'Vista previa',
    'Relatório': 'Informe',
    'Relatórios': 'Informes',
    'Histórico': 'Historial',
    'Historial': 'Historial',

    'Informe os totais operacionais para começar uma nova conferência de rota NEX.':
      'Introduzca los totales operativos para iniciar un nuevo control de ruta NEX.',
    'Esses valores são digitados manualmente e nunca são recalculados a partir das ocorrências registradas.':
      'Estos valores se introducen manualmente y nunca se recalculan a partir de las incidencias registradas.',

    'Total de sacas': 'Total de sacas',
    'Total de pacotes': 'Total de paquetes',
    'Sacas:': 'Sacas:',
    'Pacotes:': 'Paquetes:',
    'Sacas': 'Sacas',
    'Pacotes': 'Paquetes',
    'Pacote': 'Paquete',
    'Data:': 'Fecha:',
    'Data': 'Fecha',
    'Hora': 'Hora',
    'Código': 'Código',
    'Código do pacote': 'Código del paquete',
    'Buscar código': 'Buscar código',
    'Buscar por código': 'Buscar por código',

    'Registrar ocorrência': 'Registrar incidencia',
    'Registrar nova ocorrência': 'Registrar nueva incidencia',
    'Nova ocorrência': 'Nueva incidencia',
    'Ocorrências': 'Incidencias',
    'Ocorrência': 'Incidencia',
    'Incidências': 'Incidencias',
    'Incidencias da sessão': 'Incidencias de la sesión',
    'Categoria da ocorrência': 'Categoría de la incidencia',
    'Categoria': 'Categoría',
    'Estado da ocorrência': 'Estado de la incidencia',
    'Status da ocorrência': 'Estado de la incidencia',
    'Estado': 'Estado',
    'Status': 'Estado',
    'Observação (opcional)': 'Observación (opcional)',
    'Observação': 'Observación',
    'Observações': 'Observaciones',
    'Ler pela câmera': 'Escanear con la cámara',
    'Selecione uma categoria': 'Seleccione una categoría',
    'Selecione': 'Seleccione',
    'Todas': 'Todas',
    'Todos': 'Todos',

    'Pendente': 'Pendiente',
    'Pendentes': 'Pendientes',
    'Resolvido': 'Resuelto',
    'Resolvida': 'Resuelta',
    'Resolvidos': 'Resueltos',
    'Resolvidas': 'Resueltas',
    'Em andamento': 'En curso',
    'Finalizada': 'Finalizada',
    'Finalizado': 'Finalizado',
    'Finalizadas': 'Finalizadas',
    'Finalizados': 'Finalizados',

    'Pacotes avariados e retirados':
      'Paquetes dañados y retirados',
    'Pacotes duplicados/sem produto encaminhados ao inventário':
      'Paquetes duplicados/sin producto enviados al inventario',
    'Possíveis duplicados': 'Posibles duplicados',
    'Pacotes não localizados em auditoria':
      'Paquetes no localizados en auditoría',
    'Pacotes com status "despachar" não agregados':
      'Paquetes con estado "despachar" no agregados',
    'Categoria desconhecida': 'Categoría desconocida',

    'Total de ocorrências:': 'Total de incidencias:',
    'Total de ocorrências': 'Total de incidencias',
    'ocorrência(s) ao todo': 'incidencia(s) en total',
    'resolvida(s)': 'resuelta(s)',
    'pendente(s)': 'pendiente(s)',
    'Zero': 'Cero',

    'Total': 'Total',
    'Quantidade': 'Cantidad',
    'Detalhes': 'Detalles',
    'Editar': 'Editar',
    'Salvar': 'Guardar',
    'Salvar alterações': 'Guardar cambios',
    'Excluir': 'Eliminar',
    'Cancelar': 'Cancelar',
    'Confirmar': 'Confirmar',
    'Fechar': 'Cerrar',
    'Voltar': 'Volver',
    'Adicionar': 'Añadir',
    'Atualizar': 'Actualizar',
    'Limpar': 'Limpiar',
    'Limpar filtros': 'Limpiar filtros',
    'Exportar': 'Exportar',
    'Importar': 'Importar',
    'Exportar relatório': 'Exportar informe',
    'Copiar relatório': 'Copiar informe',
    'Copiar': 'Copiar',
    'Baixar': 'Descargar',

    'Nenhuma ocorrência encontrada com os filtros atuais.':
      'No se encontraron incidencias con los filtros actuales.',
    'Nenhuma ocorrência encontrada':
      'No se encontraron incidencias',
    'Nenhuma ocorrência registrada':
      'No se registraron incidencias',
    'Nenhuma sessão encontrada':
      'No se encontraron sesiones',
    'Nenhum registro encontrado':
      'No se encontraron registros',
    'Nenhum resultado encontrado':
      'No se encontraron resultados',
    'Nenhuma sessão finalizada':
      'No hay sesiones finalizadas',
    'Nenhuma ocorrência registrada — tudo certo!':
      '¡No se registraron incidencias: todo correcto!',

    'Copia de seguridad dos dados':
      'Copia de seguridad de los datos',
    'Cópia de segurança dos dados':
      'Copia de seguridad de los datos',
    'Backup': 'Copia de seguridad',
    'Restaurar backup': 'Restaurar copia de seguridad',
    'Exportar backup': 'Exportar copia de seguridad',
    'Importar backup': 'Importar copia de seguridad',
    'Exportar cópia de segurança (JSON)':
      'Exportar copia de seguridad (JSON)',
    'Exportar copia de segurança (JSON)':
      'Exportar copia de seguridad (JSON)',
    'Importar backup (JSON)':
      'Importar copia de seguridad (JSON)',
    'Importar copia de seguridad (JSON)':
      'Importar copia de seguridad (JSON)',
    'O MeliNotepad guarda tudo apenas neste navegador (LocalStorage).':
      'MeliNotepad guarda todos los datos únicamente en este navegador (LocalStorage).',
    'Limpar os dados do navegador apaga os registros, e os dados não sincronizam sozinhos entre dispositivos. Exporte um backup regularmente.':
      'Borrar los datos del navegador elimina los registros y los datos no se sincronizan automáticamente entre dispositivos. Exporte una copia de seguridad periódicamente.',

    'Erro': 'Error',
    'Sucesso': 'Éxito',
    'Atenção': 'Atención',
    'Aviso': 'Aviso',
    'Carregando...': 'Cargando...',
    'Campo obrigatório': 'Campo obligatorio',
    'Código obrigatório': 'El código es obligatorio',
    'Tem certeza?': '¿Está seguro?',
    'Deseja realmente excluir?': '¿Realmente desea eliminar?',
    'Sessão finalizada': 'Sesión finalizada',
    'Conferência finalizada': 'Control finalizado',
    'Finalização:': 'Finalización:',
    'Conferência NEX': 'Control NEX',
    'Rotas Nex finalizadas hoje': 'Rutas NEX finalizadas hoy',
    'Rotas Nex finalizadas hoje ': 'Rutas NEX finalizadas hoy ',
    'Nex Finalizado': 'NEX finalizado',
    'Sim': 'Sí',
    'Não': 'No',
    'Manhã': 'Mañana',
    'Bom dia': 'Buenos días',
    'Boa tarde': 'Buenas tardes',
    'Boa noite': 'Buenas noches'
  };

  var CHAVES = Object.keys(DICIONARIO).sort(function (a, b) {
    return b.length - a.length;
  });

  function traduzirTexto(texto) {
    if (idioma !== 'es' || typeof texto !== 'string' || !texto) {
      return texto;
    }

    var resultado = texto;

    CHAVES.forEach(function (original) {
      resultado = resultado.split(original).join(DICIONARIO[original]);
    });

    return resultado;
  }

  function traduzirNo(no) {
    if (!no || no.nodeType !== Node.TEXT_NODE) return;

    var pai = no.parentElement;
    if (!pai || pai.closest('#meli-idioma')) return;

    if (pai.closest('script, style, textarea, [data-sem-traducao]')) {
      return;
    }

    var atual = no.nodeValue;
    var registro = textosOriginais.get(no);
    var original = atual;

    if (registro && atual === registro.traduzido) {
      original = registro.original;
    }

    var novoTexto = traduzirTexto(original);

    textosOriginais.set(no, {
      original: original,
      traduzido: novoTexto
    });

    if (atual !== novoTexto) {
      no.nodeValue = novoTexto;
    }
  }

  function traduzirAtributos(raiz) {
    if (!raiz || raiz.nodeType !== Node.ELEMENT_NODE) return;

    var elementos = [raiz];

    if (raiz.querySelectorAll) {
      elementos = elementos.concat(
        Array.prototype.slice.call(
          raiz.querySelectorAll('[placeholder], [title], [aria-label]')
        )
      );
    }

    elementos.forEach(function (el) {
      if (el.closest && el.closest('#meli-idioma')) return;

      var originais = atributosOriginais.get(el);

      if (!originais) {
        originais = {};
        atributosOriginais.set(el, originais);
      }

      ['placeholder', 'title', 'aria-label'].forEach(function (atributo) {
        if (!el.hasAttribute(atributo)) return;

        if (!Object.prototype.hasOwnProperty.call(originais, atributo)) {
          originais[atributo] = el.getAttribute(atributo);
        }

        var traduzido = traduzirTexto(originais[atributo]);

        if (el.getAttribute(atributo) !== traduzido) {
          el.setAttribute(atributo, traduzido);
        }
      });
    });
  }

  function traduzirArvore(raiz) {
    if (!raiz) return;

    if (raiz.nodeType === Node.TEXT_NODE) {
      traduzirNo(raiz);
      return;
    }

    if (raiz.nodeType !== Node.ELEMENT_NODE &&
        raiz.nodeType !== Node.DOCUMENT_NODE) {
      return;
    }

    var walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    var nos = [];

    while (walker.nextNode()) {
      nos.push(walker.currentNode);
    }

    nos.forEach(traduzirNo);

    if (raiz.nodeType === Node.ELEMENT_NODE) {
      traduzirAtributos(raiz);
    }
  }

  function criarSeletor() {
    if (document.getElementById('meli-idioma')) return;

    var caixa = document.createElement('div');
    caixa.id = 'meli-idioma';
    caixa.setAttribute('data-sem-traducao', 'true');

    caixa.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:6px',
      'box-sizing:border-box',
      'width:auto',
      'max-width:100%',
      'margin:0 0 0 auto',
      'padding:4px 0',
      'font:13px sans-serif',
      'flex:0 0 auto'
    ].join(';');

    var rotulo = document.createElement('label');
    rotulo.htmlFor = 'meli-idioma-select';
    rotulo.textContent = 'Idioma / Language:';
    rotulo.style.cssText = 'white-space:nowrap';

    var seletor = document.createElement('select');
    seletor.id = 'meli-idioma-select';
    seletor.setAttribute('data-sem-traducao', 'true');

    seletor.style.cssText = [
      'width:auto',
      'max-width:130px',
      'padding:5px 7px',
      'border:1px solid #ccc',
      'border-radius:6px',
      'background:#fff',
      'color:#222',
      'font:inherit',
      'flex:0 0 auto'
    ].join(';');

    [
      { value: 'pt', label: 'Português' },
      { value: 'es', label: 'Español' }
    ].forEach(function (item) {
      var opcao = document.createElement('option');
      opcao.value = item.value;
      opcao.textContent = item.label;
      seletor.appendChild(opcao);
    });

    seletor.value = idioma;

    seletor.addEventListener('change', function () {
      idioma = seletor.value === 'es' ? 'es' : 'pt';

      try {
        localStorage.setItem(CHAVE_IDIOMA, idioma);
      } catch (e) {}

      aplicarIdioma();
    });

    caixa.appendChild(rotulo);
    caixa.appendChild(seletor);

    var navegacao = Array.from(
      document.querySelectorAll('a, button')
    ).filter(function (el) {
      var texto = el.textContent.trim();

      return texto === 'Sessão atual' ||
             texto === 'Histórico' ||
             texto === 'Sesión actual' ||
             texto === 'Historial';
    });

    var destino;

    if (navegacao.length) {
      destino = navegacao[0].parentElement;
    } else {
      destino =
        document.querySelector('header nav') ||
        document.querySelector('header') ||
        document.querySelector('.header') ||
        document.querySelector('main') ||
        document.body;
    }

    destino.appendChild(caixa);

    var estiloDestino = window.getComputedStyle(destino);

    if (estiloDestino.display !== 'flex' &&
        estiloDestino.display !== 'inline-flex') {
      destino.style.display = 'flex';
    }

    destino.style.alignItems = 'center';
    destino.style.flexWrap = 'wrap';
    destino.style.gap = '10px';
    caixa.style.marginLeft = 'auto';
  }

  function instalarTraducaoRelatorios() {
    var app = window.MeliNotepad;
    var report = app && app.Report;

    if (!report || reportInstalado) return;

    reportInstalado = true;

    if (typeof report.gerarTextoRelatorio === 'function') {
      var gerarOriginal = report.gerarTextoRelatorio;

      report.gerarTextoRelatorio = function () {
        return traduzirTexto(
          gerarOriginal.apply(this, arguments)
        );
      };
    }

    if (typeof report.montarDadosCompletos === 'function') {
      var montarOriginal = report.montarDadosCompletos;

      report.montarDadosCompletos = function () {
        var dados = montarOriginal.apply(this, arguments);

        if (idioma !== 'es' || !dados) return dados;

        // Traduz uma cópia para não modificar os dados originais.
        var copia = JSON.parse(JSON.stringify(dados));

        function traduzirObjeto(obj) {
          if (!obj || typeof obj !== 'object') return;

          Object.keys(obj).forEach(function (chave) {
            if (typeof obj[chave] === 'string') {
              obj[chave] = traduzirTexto(obj[chave]);
            } else if (obj[chave] && typeof obj[chave] === 'object') {
              traduzirObjeto(obj[chave]);
            }
          });
        }

        traduzirObjeto(copia);
        return copia;
      };
    }
  }

  function aplicarIdioma() {
    document.documentElement.lang = idioma === 'es' ? 'es' : 'pt-BR';

    traduzirArvore(document.body);

    var seletor = document.getElementById('meli-idioma-select');
    if (seletor) seletor.value = idioma;

    instalarTraducaoRelatorios();

    if (window.MeliNotepad) {
      window.MeliNotepad.idioma = idioma;
    }
  }

  function iniciar() {
    criarSeletor();
    aplicarIdioma();

    if (observador) observador.disconnect();

    observador = new MutationObserver(function (mutacoes) {
      mutacoes.forEach(function (mutacao) {
        if (mutacao.type === 'characterData') {
          traduzirNo(mutacao.target);
          return;
        }

        Array.prototype.forEach.call(mutacao.addedNodes, function (no) {
          if (no.nodeType === Node.TEXT_NODE) {
            traduzirNo(no);
          } else if (no.nodeType === Node.ELEMENT_NODE) {
            traduzirArvore(no);
          }
        });
      });
    });

    observador.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  window.MeliNotepadTradutor = {
    idioma: function () {
      return idioma;
    },
    traduzir: traduzirTexto,
    aplicar: aplicarIdioma
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

})(window, document);
