const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('../lib/carregar');

const NS = carregar(['js/nex-planilha.js']);
const Planilha = NS.NexPlanilha;

test('importação NEX considera somente HYBRID e soma sacas e pacotes estimados', () => {
  const resultado = Planilha.interpretarMatriz([
    ['ID Planejado', 'ID Otimizado', 'Tipos de serviços', 'Quantidade de sacas', 'Pacotes estimados'],
    ['AM1_1', 'A1_AM1', 'HYBRID', 4, 125],
    ['AM1_2', 'A2_AM1', 'XPT - ESC14', 99, 999],
    ['AM1_3', 'A3_AM1', 'ESC14 HYBRID', 2, 30]
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(resultado.rotas.map(r => r.rota))), ['A1', 'A3']);
  assert.equal(resultado.totalSacas, 6);
  assert.equal(resultado.totalPacotes, 155);
  assert.equal(resultado.rotas[0].idOtimizado, 'A1_AM1');
});

test('CSV aceita delimitador ponto e vírgula, BOM, acentos e campos entre aspas', () => {
  const csv = '\uFEFFID Planejado;ID Otimizado;Tipos de serviços;Quantidade de sacas;Pacotes estimados\r\n' +
    'AM1_1;A1_AM1;HYBRID - ESC14;1;1.234\r\n' +
    'AM1_2;A2_AM1;"XPT - ESC14";10;999\r\n';
  const resultado = Planilha.analisarCSV(csv);
  assert.equal(resultado.rotas.length, 1);
  assert.equal(resultado.rotas[0].rota, 'A1');
  assert.equal(resultado.totalSacas, 1);
  assert.equal(resultado.totalPacotes, 1234);
});

test('rejeita planilha sem colunas obrigatórias', () => {
  assert.throws(() => Planilha.interpretarMatriz([
    ['Rota', 'Serviço'],
    ['A1', 'HYBRID']
  ]), /colunas obrigatórias/);
});

test('rejeita rota HYBRID duplicada para evitar somas ambíguas', () => {
  assert.throws(() => Planilha.interpretarMatriz([
    ['ID Otimizado', 'Tipos de serviços', 'Quantidade de sacas', 'Pacotes estimados'],
    ['A1_AM1', 'HYBRID', 1, 10],
    ['A1_AM1', 'HYBRID', 2, 20]
  ]), /aparece mais de uma vez/);
});

test('rejeita quantidade inválida em uma linha HYBRID', () => {
  assert.throws(() => Planilha.interpretarMatriz([
    ['ID Otimizado', 'Tipos de serviços', 'Quantidade de sacas', 'Pacotes estimados'],
    ['A1_AM1', 'HYBRID', '', 10]
  ]), /está vazia/);
});

test('rejeita arquivo sem linhas HYBRID', () => {
  assert.throws(() => Planilha.interpretarMatriz([
    ['ID Otimizado', 'Tipos de serviços', 'Quantidade de sacas', 'Pacotes estimados'],
    ['A1_AM1', 'XPT - ESC14', 1, 10]
  ]), /Não encontrei linhas com serviço HYBRID/);
});
