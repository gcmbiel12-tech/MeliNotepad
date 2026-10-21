const test = require('node:test');
const assert = require('node:assert');
const { carregar } = require('../lib/carregar');
const { Utils } = carregar(['js/utils.js']);
const ler = Utils.extrairIdentificadorDeCodigo;

test('1. JSON de exemplo -> somente o id', () => {
  const r = ler('{"id":"48197332782","t":"lm"}');
  assert.deepStrictEqual({ ok: r.ok, id: r.id, origem: r.origem }, { ok: true, id: '48197332782', origem: 'json' });
});
test('2. código numérico simples continua aceito, sem alteração', () => {
  const r = ler('48197332782');
  assert.deepStrictEqual({ ok: r.ok, id: r.id, origem: r.origem }, { ok: true, id: '48197332782', origem: 'direto' });
});
test('3. zeros à esquerda preservados (direto e dentro do JSON)', () => {
  assert.strictEqual(ler('0004819733').id, '0004819733');
  assert.strictEqual(ler('{"id":"000123","t":"lm"}').id, '000123');
  assert.strictEqual(typeof ler('000123').id, 'string');
});
test('4. JSON sem o campo id -> não reconhecido', () => {
  for (const c of ['{"t":"lm"}', '{}', '{"ID":"123"}', '{"id":null}', '{"id":""}', '{"id":"   "}', '{"id":{"x":1}}', '{"id":[1]}', '{"id":true}', '[]', '[{"id":"1"}]']) {
    const r = ler(c);
    assert.strictEqual(r.ok, false, 'deveria recusar: ' + c);
    assert.ok(r.motivo && r.motivo.length > 0);
  }
});
test('5. conteúdo inválido -> não reconhecido', () => {
  for (const c of ['{"id":', '{id:123}', '{"id":"48197332782"', "{'id':'1'}", '', '   ', '\u0000\u0001', 'abc\u0000def', 'x'.repeat(129), undefined, null, 123]) {
    assert.strictEqual(ler(c).ok, false, 'deveria recusar: ' + JSON.stringify(c));
  }
});
test('extras: id numérico JSON seguro vira texto; inteiro inseguro/negativo/decimal é recusado', () => {
  assert.strictEqual(ler('{"id":48197332782}').id, '48197332782');
  for (const c of ['{"id":-5}', '{"id":1.5}', '{"id":9007199254740993}']) assert.strictEqual(ler(c).ok, false, c);
});
test('extras: alfanumérico e espaços nas pontas são tratados como código direto', () => {
  assert.strictEqual(ler('  AB-123x  ').id, 'AB-123x');
  assert.strictEqual(ler('ABC123').origem, 'direto');
});
test('extras: JSON entre aspas com string -> usa a string; "t" é ignorado', () => {
  assert.strictEqual(ler('"0099"').id, '0099');
  assert.strictEqual(ler('{"t":"x","id":"7","extra":1}').id, '7');
});
