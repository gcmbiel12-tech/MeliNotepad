// Carrega scripts clássicos do projeto (IIFEs que usam `window`) num contexto isolado do Node.
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');

function carregar(arquivos, extras) {
  const ctx = Object.assign({ console, Date, Math, JSON, Number, String, Array, Object, Promise, Set, Map, Intl, setTimeout, clearTimeout }, extras || {});
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of arquivos) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.MeliNotepad;
}
module.exports = { carregar, RAIZ };
