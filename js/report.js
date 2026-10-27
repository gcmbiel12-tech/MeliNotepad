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
   * de escanear num grupo. Os relatórios PDF do histórico são montados pelo
   * módulo relatorios-historico.js e oferecem formatos resumido e detalhado.
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
    var dataOperacional = U.dataOperacional(sessao.startTime);
    var dataRef = dataOperacional.slice(8, 10) + '/' + dataOperacional.slice(5, 7);
    var horaFinal = U.formatarHoraOperacional(momentoReferencia);
    var porCategoria = contarPorCategoria(sessao.occurrences);
    var status = contarStatus(sessao.occurrences);

    var divisoria = '━━━━━━━━━━━━━━━━';
    var teveAlgumaOcorrencia = status.total > 0;

    var linhas = [];
    linhas.push('📦 *MeliNotepad* — Conferência NEX');
    linhas.push(divisoria);
    linhas.push('');
    linhas.push(emojiSaudacao + ' *' + saudacao + '*');
    linhas.push('');
    linhas.push('📋 *Rotas Nex finalizadas hoje ' + dataRef + ' às ' + horaFinal + '*');
    linhas.push('');
    linhas.push('🧺 Sacas: *' + U.formatarNumeroBR(sessao.sacas) + '*');
    linhas.push('📦 Pacotes: *' + U.formatarNumeroBR(sessao.pacotes) + '*');
    var rotasHybrid = Array.isArray(sessao.rotasHybrid) ? sessao.rotasHybrid : [];
    if (rotasHybrid.length) {
      var rotasConcluidas = rotasHybrid.filter(function (rota) { return rota.auditStatus === 'concluida'; }).length;
      linhas.push('');
      linhas.push('🛒 *Auditoria das rotas HYBRID* — ' + rotasConcluidas + '/' + rotasHybrid.length + ' concluída(s)');
      rotasHybrid.forEach(function (rota) {
        linhas.push('└ ' + rota.rota + ' — ' + (rota.auditStatus === 'concluida' ? 'Concluída · Auditor: ' + rota.auditor : 'Não auditada'));
      });
    }
    linhas.push(divisoria);

    C.CATEGORIES.forEach(function (cat) {
      var itens = porCategoria[cat.key];
      if (itens.length === 0) return;
      linhas.push('');
      var descricao = cat.key === 'bingo' ? ' (produto não encontrado na auditoria)' :
        (cat.key === 'faltando' ? ' (pacote a mais, que não deveria estar no local)' : '');
      linhas.push(cat.emoji + ' *' + cat.label + '*' + descricao + ' — ' + itens.length);
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
   * Mantém uma representação estruturada de uma sessão para consumidores que
   * precisam de seus campos operacionais e ocorrências completas.
   */
  function montarDadosCompletos(sessao) {
    var porCategoria = contarPorCategoria(sessao.occurrences);
    var status = contarStatus(sessao.occurrences);
    return {
      nomeApp: 'MeliNotepad',
      sessaoId: sessao.id,
      data: U.formatarDataOperacional(sessao.startTime),
      horaFim: sessao.endTime ? U.formatarHoraOperacional(sessao.endTime) : '—',
      estado: sessao.status === C.SESSION_STATUS.FINALIZADA ? 'Finalizada' : 'Em andamento',
      sacas: U.formatarNumeroBR(sessao.sacas),
      pacotes: U.formatarNumeroBR(sessao.pacotes),
      rotasHybrid: (Array.isArray(sessao.rotasHybrid) ? sessao.rotasHybrid : []).map(function (rota) {
        return { rota: rota.rota, sacas: rota.sacas, pacotes: rota.pacotes, auditStatus: rota.auditStatus === 'concluida' ? 'Concluída' : 'Não auditada', auditor: rota.auditor || null, auditedAt: rota.auditedAt || null };
      }),
      categorias: C.CATEGORIES.map(function (cat) {
        return {
          label: cat.label,
          descricao: cat.key === 'bingo' ? 'Produto não encontrado na auditoria' : (cat.key === 'faltando' ? 'Pacote a mais, que não deveria estar no local' : ''),
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
    var data = U.dataOperacional(sessao.startTime || new Date());
    var idCurto = (sessao.id || 'sessao').replace(/^sess_/, '').slice(0, 8);
    return 'MeliNotepad_' + data + '_' + idCurto;
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
