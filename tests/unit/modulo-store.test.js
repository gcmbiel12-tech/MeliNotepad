const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('../lib/carregar');

function ambiente() {
  const dados = new Map();
  let falhas = 0;
  const localStorage = {
    getItem(k) { return dados.has(k) ? dados.get(k) : null; },
    setItem(k, v) { if (falhas > 0) { falhas--; const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } dados.set(k, String(v)); },
    falharProximasGravacoes(n) { falhas = n; }
  };
  const ns = carregar(['js/modulo-store.js'], { localStorage, addEventListener() {} });
  return { store: ns.ModStore.criar({ chave: 'teste', rotulo: 'Teste', padrao: () => ({ itens: [], rev: 0 }), validar: d => d && Array.isArray(d.itens) ? [] : ['itens inválidos'] }), localStorage };
}

test('ModStore confirma mutação apenas após persistência e persiste a revisão', () => {
  const { store, localStorage } = ambiente();
  const r = store.mutar(d => { d.itens.push('A'); });
  assert.equal(r.sucesso, true);
  assert.deepEqual(JSON.parse(localStorage.getItem('teste')).itens, ['A']);
  assert.equal(JSON.parse(localStorage.getItem('teste')).rev, 1);
});

test('ModStore preserva mutação que falhou e permite nova tentativa explícita', () => {
  const { store, localStorage } = ambiente();
  localStorage.falharProximasGravacoes(1);
  const r = store.mutar(d => { d.itens.push('pendente'); });
  assert.equal(r.sucesso, false);
  assert.equal(localStorage.getItem('teste'), null);
  const retry = store.tentarNovamente();
  assert.equal(retry.sucesso, true);
  assert.deepEqual(JSON.parse(localStorage.getItem('teste')).itens, ['pendente']);
  assert.deepEqual(retry.dados.itens, ['pendente']);
});

test('nova mutação após falha preserva a alteração anterior pendente', () => {
  const { store, localStorage } = ambiente();
  localStorage.falharProximasGravacoes(1);
  assert.equal(store.mutar(d => { d.itens.push('A'); }).sucesso, false);
  const segunda = store.mutar(d => { d.itens.push('B'); });
  assert.equal(segunda.sucesso, true);
  assert.deepEqual(JSON.parse(localStorage.getItem('teste')).itens, ['A', 'B']);
});
