const test = require('node:test');
const assert = require('node:assert');
const { carregar } = require('../lib/carregar');
const U = carregar(['js/utils.js']).Utils;

test('data operacional e horário usam America/Sao_Paulo perto da meia-noite', () => {
  assert.strictEqual(U.dataOperacional('2026-01-01T02:59:59.000Z'), '2025-12-31');
  assert.strictEqual(U.dataOperacional('2026-01-01T03:00:00.000Z'), '2026-01-01');
  assert.strictEqual(U.formatarDataOperacional('2026-01-01T02:59:59.000Z'), '31/12/2025');
  assert.strictEqual(U.formatarHoraOperacional('2026-01-01T02:59:59.000Z'), '23:59');
});

test('Hoje e ontem consideram o dia do fuso operacional, inclusive na virada local', () => {
  const agora = '2026-01-01T02:30:00.000Z'; // 31/12, 23:30 em São Paulo
  assert.strictEqual(U.dataHojeOperacional(agora), '2025-12-31');
  assert.strictEqual(U.deslocarDataOperacional(U.dataHojeOperacional(agora), -1), '2025-12-30');
  assert.ok(U.dentroDoPeriodoOperacional('2026-01-01T02:00:00.000Z', 'hoje', '', agora));
  assert.ok(U.dentroDoPeriodoOperacional('2025-12-31T02:59:59.000Z', 'ontem', '', agora));
});

test('consulta filtra data e intervalo com início e fim inclusivos, e ordena por startTime sem mutar', () => {
  const registros = [
    { id: 'fim', startTime: '2026-01-02T02:59:59.000Z', endTime: '2026-01-03T00:00:00Z' },
    { id: 'inicio', startTime: '2025-12-31T03:00:00.000Z', endTime: '2026-01-02T00:00:00Z' },
    { id: 'meio', startTime: '2026-01-01T15:00:00.000Z' }
  ];
  const antes = registros.map(r => r.id);
  const opts = { periodo: 'intervalo', inicio: '2025-12-31', fim: '2026-01-01' };
  assert.deepStrictEqual(Array.from(U.consultarHistorico(registros, opts), r => r.id), ['fim', 'meio', 'inicio']);
  assert.deepStrictEqual(Array.from(U.consultarHistorico(registros, { periodo: 'data', data: '2025-12-31' }), r => r.id), ['inicio']);
  assert.deepStrictEqual(registros.map(r => r.id), antes);
});

test('consulta combina busca com período, trata filtros incompletos e usa campo temporal escolhido', () => {
  const registros = [
    { id: 'a', saidaAt: '2026-05-10T15:00:00Z', funcionarioNome: 'Ana Souza' },
    { id: 'b', saidaAt: '2026-05-10T16:00:00Z', funcionarioNome: 'Bia Lima' },
    { id: 'c', saidaAt: '2026-05-11T16:00:00Z', funcionarioNome: 'Ana Souza' }
  ];
  const opts = { campoData: 'saidaAt', periodo: 'data', data: '2026-05-10', busca: 'ANA', buscar: r => r.funcionarioNome };
  assert.deepStrictEqual(Array.from(U.consultarHistorico(registros, opts), r => r.id), ['a']);
  assert.deepStrictEqual(Array.from(U.consultarHistorico(registros, { periodo: 'intervalo', inicio: '2026-05-11' })), []);
  assert.deepStrictEqual(Array.from(U.consultarHistorico(registros, { periodo: 'data' })), []);
  assert.deepStrictEqual(Array.from(U.consultarHistorico(registros, { periodo: 'intervalo', inicio: '2026-05-12', fim: '2026-05-11' })), []);
});
