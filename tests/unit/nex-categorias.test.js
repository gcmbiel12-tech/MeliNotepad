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


test('relatório NEX inclui todos os campos da ocorrência e não exibe rodapé de finalização', () => {
  const sessao = { id: 'occ-detalhada', startTime: '2026-11-01T08:00:00.000Z', endTime: '2026-11-01T09:00:00.000Z', status: 'finalizada', sacas: 1, pacotes: 1, occurrences: [{ id: 'o1', code: 'PKG-123', category: 'avariados', status: 'pendente', createdAt: '2026-11-01T08:30:00.000Z', tipoProduto: 'Eletrônico', rota: 'M2', saca: '15', gaiolaEncontrada: 'G-10', gaiolaCorreta: 'G-12', encontradoPor: 'Carlos', descricaoOutra: 'Embalagem molhada', note: 'Produto úmido', fotoId: 'foto-occ-1' }] };
  const texto = Report.gerarTextoRelatorio(sessao);
  ['PKG-123', 'Eletrônico', 'Rota: M2', 'Saca: 15', 'Gaiola encontrada: G-10', 'Gaiola correta: G-12', 'Encontrado por: Carlos', 'Descrição: Embalagem molhada', 'Observações: Produto úmido', 'Foto da ocorrência anexada'].forEach(v => assert.ok(texto.includes(v), 'campo ausente: ' + v));
  assert.ok(!texto.includes('Nex Finalizado'));
  const estruturado = Report.montarDadosCompletos(sessao).categorias.find(c => c.label === 'Pacotes avariados e retirados').itens[0];
  assert.equal(estruturado.rota, 'M2'); assert.equal(estruturado.saca, '15'); assert.equal(estruturado.gaiolaCorreta, 'G-12'); assert.equal(estruturado.fotoId, 'foto-occ-1');
});

test('saudação do relatório considera madrugada como Bom dia', () => {
  assert.equal(NS.Utils.saudacaoPorHorario(new Date('2026-11-01T04:00:00-03:00')), 'Bom dia!!!');
  assert.equal(NS.Utils.saudacaoPorHorario(new Date('2026-11-01T03:59:00-03:00')), 'Boa noite!!!');
});
