const test = require('node:test');
const assert = require('node:assert');
const { carregar } = require('../lib/carregar');
const NS = carregar(['js/constants.js', 'js/utils.js', 'js/report.js', 'js/relatorios-historico.js']);
const Report = NS.Report;

test('NEX distingue Bingo e Faltando nos relatórios de texto e estruturados', () => {
  const sessao = {
    id: 'sessao-teste',
    startTime: '2026-10-26T12:00:00.000Z',
    endTime: '2026-10-26T13:00:00.000Z',
    status: 'finalizada',
    sacas: 10,
    pacotes: 20,
    rotasHybrid: [{
      rota: 'J1',
      sacas: 8,
      pacotes: 16,
      sacasIndividuais: [
        { id: 's1', numero: '060', auditorias: [
          { status: 'concluida', auditor: 'Ana', data: '2026-10-26T12:20:00.000Z', observacao: '' },
          { status: 'divergencia', auditor: 'Bruno', data: '2026-10-26T12:40:00.000Z', observacao: 'Conferir novamente' }
        ] },
        { id: 's2', numero: '061', auditorias: [] }
      ]
    }],
    occurrences: [
      { id: 'b1', code: 'PKG-BINGO', category: 'bingo', status: 'pendente' },
      { id: 'f1', code: 'PKG-EXTRA', category: 'faltando', status: 'resolvido' }
    ]
  };
  const texto = Report.gerarTextoRelatorio(sessao);
  assert.match(texto, /Bingo.*produto não encontrado na auditoria/i);
  assert.match(texto, /Faltando.*pacote a mais, que não deveria estar no local/i);
  const estruturado = Report.montarDadosCompletos(sessao);
  const bingo = estruturado.categorias.find(c => c.label === 'Bingo');
  const faltando = estruturado.categorias.find(c => c.label === 'Faltando');
  assert.strictEqual(bingo.quantidade, 1);
  assert.strictEqual(bingo.descricao, 'Produto não encontrado na auditoria');
  assert.strictEqual(faltando.quantidade, 1);
  assert.strictEqual(faltando.descricao, 'Pacote a mais, que não deveria estar no local');

  const relatorioHistorico = NS.RelatoriosHistorico.construirNex([sessao], { periodo: 'todo', tipo: 'detalhado' });
  assert.ok(Object.keys(relatorioHistorico.totais.categorias).some(k => /Bingo.*produto não encontrado/i.test(k)));
  assert.ok(Object.keys(relatorioHistorico.totais.categorias).some(k => /Faltando.*pacote a mais/i.test(k)));
  assert.match(relatorioHistorico.registros[0].occurrences[0].category, /produto não encontrado/i);
  assert.match(relatorioHistorico.registros[0].occurrences[1].category, /pacote a mais/i);
  assert.match(texto, /Rotas Nex finalizadas hoje/);
  assert.match(texto, /Rota J1.*Saca 060/);
  assert.match(texto, /Auditor: Bruno/);
  assert.match(texto, /Saca 061.*Não realizada/);
  assert.strictEqual(relatorioHistorico.registros[0].rotas[0].sacasIndividuais[0].auditorias.length, 2);
  assert.strictEqual(relatorioHistorico.totais.rotas, 1);
  assert.strictEqual(relatorioHistorico.totais.sacasIndividuais, 2);
  assert.strictEqual(relatorioHistorico.totais.auditadas, 1);
});
