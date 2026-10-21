/**
 * report.js
 * Geração do relatório (texto para copiar/colar) e do conteúdo impresso em PDF.
 *
 * Sobre o PDF: este projeto não empacota nenhuma biblioteca de PDF de terceiros.
 * A geração usa a função nativa window.print() do navegador sobre uma folha de
 * impressão dedicada (ver #print-area no index.html e @media print no styles.css),
 * e o usuário escolhe "Salvar como PDF" no diálogo de impressão do próprio
 * navegador. Essa escolha evita depender de rede para baixar uma biblioteca e
 * evita travar o funcionamento offline da PWA. A limitação dessa abordagem está
 * documentada no README.
 */
(function (global) {
  'use strict';

  var C = global.MeliNotepad.Constants;
  var U = global.MeliNotepad.Utils;

  function contarPorCategoria(occurrences) {
    var contagem = {};
    C.CATEGORIES.forEach(function (cat) { contagem[cat.key] = []; });
    occurrences.forEach(function (o) {
      if (contagem[o.category]) contagem[o.category].push(o);
    });
    return contagem;
  }

  function contarStatus(occurrences) {
    var pendentes = 0, resolvidas = 0;
    occurrences.forEach(function (o) {
      if (o.status === C.STATUS.RESOLVIDO) resolvidas++; else pendentes++;
    });
    return { pendentes: pendentes, resolvidas: resolvidas, total: occurrences.length };
  }

  /**
   * Gera o resumo pronto para colar no WhatsApp: saudação, data/hora de
   * finalização, totais manuais e só as categorias que têm pelo menos uma
   * ocorrência (categorias zeradas ficam de fora — nada de "Zero" aqui).
   * Usa *negrito* e emoji (sintaxe nativa do WhatsApp) para ficar mais fácil
   * de escanear num grupo. O PDF (ver montarDadosCompletos) continua mostrando
   * as cinco categorias sempre, com "Zero" quando vazias — ele é o registro
   * formal/completo da conferência, enquanto este texto é o aviso rápido.
   */
  function gerarTextoRelatorio(sessao) {
    // Quando a sessão ainda não foi finalizada (prévia), usa o horário atual como
    // referência em vez do horário de início — evita um rodapé "Nex Finalizado"
    // com um horário de horas atrás, já parecendo um relatório desatualizado.
    var momentoReferencia = sessao.endTime || U.agora().toISOString();
    var saudacao = U.saudacaoPorHorario(momentoReferencia);
    var emojiSaudacao = U.emojiPorHorario(momentoReferencia);
    // Formato DD/MM (sem ano) nesta linha, seguindo o modelo original pedido
    // ("Rotas Nex finalizadas hoje DD/MM às HH:MM"). A data completa com ano
    // continua disponível na identificação da sessão (tela) e no PDF.
    var dataRef = U.formatarDataCurta(sessao.startTime);
    var horaFinal = U.formatarHora(momentoReferencia);
    var porCategoria = contarPorCategoria(sessao.occurrences);
    var status = contarStatus(sessao.occurrences);

    var divisoria = '━━━━━━━━━━━━━━━━';
    var teveAlgumaOcorrencia = status.total > 0;

    var linhas = [];
    linhas.push('📦 *MeliOps* — Conferência NEX');
    linhas.push(divisoria);
    linhas.push('');
    linhas.push(emojiSaudacao + ' *' + saudacao + '*');
    linhas.push('');
    linhas.push('📋 *Rotas Nex finalizadas hoje ' + dataRef + ' às ' + horaFinal + '*');
    linhas.push('');
    linhas.push('🧺 Sacas: *' + U.formatarNumeroBR(sessao.sacas) + '*');
    linhas.push('📦 Pacotes: *' + U.formatarNumeroBR(sessao.pacotes) + '*');
    linhas.push(divisoria);

    C.CATEGORIES.forEach(function (cat) {
      var itens = porCategoria[cat.key];
      if (itens.length === 0) return;
      linhas.push('');
      linhas.push(cat.emoji + ' *' + cat.label + '* — ' + itens.length);
      itens.forEach(function (o) {
        linhas.push('└ ' + C.STATUS_EMOJI[o.status] + ' ' + o.code + ' — ' + C.STATUS_LABEL[o.status]);
      });
    });

    linhas.push('');
    if (teveAlgumaOcorrencia) {
      linhas.push(divisoria);
      linhas.push('📊 *' + status.total + '* ocorrência(s) ao todo — ✅ *' + status.resolvidas + '* resolvida(s) · 🔴 *' + status.pendentes + '* pendente(s)');
    } else {
      linhas.push('✅ Nenhuma ocorrência registrada — tudo certo!');
    }

    linhas.push('');
    linhas.push('🏁 *Nex Finalizado (' + horaFinal + ')*');

    return linhas.join('\n');
  }

  /**
   * Monta os dados estruturados usados tanto na pré-visualização em tela
   * quanto na folha impressa (PDF), incluindo observações e contagens —
   * informações que o resumo de texto simples (acima) mantém de fora de
   * propósito para continuar curto e fácil de colar em uma mensagem.
   */
  function montarDadosCompletos(sessao) {
    var porCategoria = contarPorCategoria(sessao.occurrences);
    var status = contarStatus(sessao.occurrences);
    return {
      nomeApp: 'MeliOps',
      sessaoId: sessao.id,
      data: U.formatarData(sessao.startTime),
      horaFim: sessao.endTime ? U.formatarHora(sessao.endTime) : '—',
      estado: sessao.status === C.SESSION_STATUS.FINALIZADA ? 'Finalizada' : 'Em andamento',
      sacas: U.formatarNumeroBR(sessao.sacas),
      pacotes: U.formatarNumeroBR(sessao.pacotes),
      categorias: C.CATEGORIES.map(function (cat) {
        return {
          label: cat.label,
          quantidade: porCategoria[cat.key].length,
          itens: porCategoria[cat.key].map(function (o) {
            return {
              code: o.code,
              status: C.STATUS_LABEL[o.status],
              nota: o.note || ''
            };
          })
        };
      }),
      totalOcorrencias: status.total,
      pendentes: status.pendentes,
      resolvidas: status.resolvidas
    };
  }

  /** Nome de arquivo sugerido (sem extensão), usado tanto no backup quanto no título da página antes de imprimir. */
  function nomeArquivoSugerido(sessao) {
    var data = (sessao.startTime || new Date().toISOString()).slice(0, 10);
    var idCurto = (sessao.id || 'sessao').replace(/^sess_/, '').slice(0, 8);
    return 'MeliOps_' + data + '_' + idCurto;
  }

  global.MeliNotepad = global.MeliNotepad || {};
  global.MeliNotepad.Report = {
    contarPorCategoria: contarPorCategoria,
    contarStatus: contarStatus,
    gerarTextoRelatorio: gerarTextoRelatorio,
    montarDadosCompletos: montarDadosCompletos,
    nomeArquivoSugerido: nomeArquivoSugerido
  };
})(window);
