const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { carregar } = require('../lib/carregar');

const NS = carregar(['js/constants.js']);
const migrationPath = path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261026000000_add_nex_bingo_faltando_categories.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');

test('restrição SQL de categorias NEX inclui todas as categorias do frontend', () => {
  const bloco = migration.match(/add constraint nex_occurrences_category_valid[\s\S]*?not valid/i);
  assert.ok(bloco, 'migração deve recriar a restrição de categorias');

  for (const categoria of NS.Constants.CATEGORIES) {
    assert.ok(bloco[0].includes("'" + categoria.key + "'"), 'categoria ausente na restrição SQL: ' + categoria.key);
  }
});

test('migração valida a restrição e não altera dados existentes', () => {
  assert.match(migration, /validate constraint nex_occurrences_category_valid/i);
  assert.doesNotMatch(migration, /\b(delete\s+from|truncate|drop\s+table)\b/i);
  assert.match(migration, /not valid/i);
});
