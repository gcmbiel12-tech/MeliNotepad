const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
global.MeliNotepad = {};
const regras = require('../../js/qr-sacas-regras.js');

test('interpreta números individuais, intervalos e combinações sem duplicar', () => {
  assert.deepEqual(regras.parsearSelecao('10,11,15').numeros, [10, 11, 15]);
  assert.deepEqual(regras.parsearSelecao('1-5,3,8,10-11').numeros, [1, 2, 3, 4, 5, 8, 10, 11]);
});

test('rejeita intervalos e números inválidos', () => {
  assert.equal(regras.parsearSelecao('10-1').valido, false);
  assert.equal(regras.parsearSelecao('1,,3').valido, false);
  assert.equal(regras.parsearSelecao('abc').valido, false);
});

test('valida conteúdo JSON de QR e mantém os campos originais', () => {
  const entrada = { container_id: 5938612, facility_id: 'SSC2', assignment: '10' };
  const lido = regras.interpretarPayload(JSON.stringify(entrada));
  assert.equal(lido.valido, true);
  assert.deepEqual(lido.payload, entrada);
});

test('renumera a saca editada e as seguintes, atualizando assignment', () => {
  const sacas = [10, 11, 12].map((n) => ({
    id: String(n), numero: String(n),
    payload: { container_id: n * 7, facility_id: 'SSC2', assignment: String(n) }
  }));
  const resultado = regras.ajustarSequencia(sacas, 0, '15');
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.sacas.map((s) => s.numero), ['15', '16', '17']);
  assert.deepEqual(resultado.sacas.map((s) => s.payload.assignment), ['15', '16', '17']);
  assert.deepEqual(resultado.sacas.map((s) => s.payload.container_id), [70, 77, 84]);
});

test('impede renumeração que gere duplicidade na mesma rota', () => {
  const sacas = [5, 10, 11].map((n) => ({
    id: String(n), numero: String(n),
    payload: { container_id: n, facility_id: 'SSC2', assignment: String(n) }
  }));
  const resultado = regras.ajustarSequencia(sacas, 1, '4');
  assert.equal(resultado.valido, false);
  assert.match(resultado.erro, /duplicados/);
});
