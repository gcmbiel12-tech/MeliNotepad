const test = require('node:test');
const assert = require('node:assert');
const { carregar } = require('../lib/carregar');
const { IntervalosRegras: R } = carregar(['js/utils.js', 'js/intervalos-regras.js']);
const MIN = 60000;
const T0 = new Date(2026, 9, 14, 14, 0, 0).getTime(); // 14/10/2026 14:00:00 (hora local)
const func = (nome, setor) => R.novoFuncionario(nome, setor || '', T0);
function intervalo(saidaMs, dur, extra) {
  const r = R.novoIntervalo({ funcionario: func('Ana Souza'), setor: 'NEX', duracaoMin: dur, saidaMs, agoraMs: saidaMs });
  assert.ok(r.ok, r.erro); return Object.assign(r.intervalo, extra || {});
}

test('duração padrão é 60 e a validação aceita só inteiros de 1 a 1440', () => {
  assert.strictEqual(R.DURACAO_PADRAO_MIN, 60);
  assert.ok(R.validarDuracao(60).ok && R.validarDuracao('45').ok && R.validarDuracao(1440).ok);
  for (const v of [0, -5, 1.5, '', 'abc', null, undefined, 1441]) assert.strictEqual(R.validarDuracao(v).ok, false, String(v));
});

test('cor: 59 e 60 min verde; 61 e 62 min vermelho (limite 60)', () => {
  const i = intervalo(T0, 60);
  const exc = (min, seg = 0) => R.avaliar(i, T0 + min * MIN + seg * 1000).excedido;
  assert.strictEqual(exc(59), false);
  assert.strictEqual(exc(60), false);
  assert.strictEqual(exc(60, 59), false, '60 min e 59 s ainda exibe "60 min" -> verde');
  assert.strictEqual(exc(61), true);
  assert.strictEqual(exc(62), true);
  assert.strictEqual(R.avaliar(i, T0 + 61 * MIN).minutos, 61);
  assert.strictEqual(R.rotuloEstado(R.avaliar(i, T0 + 67 * MIN)), 'Excedido há 7 min');
  assert.strictEqual(R.rotuloEstado(R.avaliar(i, T0 + 45 * MIN)), 'No prazo');
});

test('o limite vem da duração prevista de cada intervalo', () => {
  const i = intervalo(T0, 30);
  assert.strictEqual(R.avaliar(i, T0 + 30 * MIN).excedido, false);
  assert.strictEqual(R.avaliar(i, T0 + 31 * MIN).excedido, true);
});

test('o tempo vem dos horários gravados: relógio "pulando" horas dá o valor certo (aba suspensa)', () => {
  const i = intervalo(T0, 60);
  assert.strictEqual(R.avaliar(i, T0 + 3 * 60 * MIN).minutos, 180);
});

test('intervalo encerrado congela no retorno real', () => {
  const i = intervalo(T0, 60);
  const r = R.registrarRetorno(i, T0 + 45 * MIN);
  assert.ok(r.ok);
  assert.strictEqual(R.avaliar(r.intervalo, T0 + 500 * MIN).minutos, 45);
});

test('ordenação: vencidos primeiro (maior atraso), depois o mais perto de vencer', () => {
  const lista = [intervalo(T0 - 42 * MIN, 60, { id: 'a42' }), intervalo(T0 - 72 * MIN, 60, { id: 'a72' }),
                 intervalo(T0 - 58 * MIN, 60, { id: 'a58' }), intervalo(T0 - 65 * MIN, 60, { id: 'a65' })];
  assert.deepStrictEqual(R.ordenar(lista, T0).map(x => x.i.id), ['a72', 'a65', 'a58', 'a42']);
});

test('ordenação considera o atraso em relação ao limite de cada um, e muda com o tempo', () => {
  const a = intervalo(T0 - 45 * MIN, 30, { id: 'a' });  // 15 min de atraso
  const b = intervalo(T0 - 72 * MIN, 60, { id: 'b' });  // 12 min de atraso
  const c = intervalo(T0 - 50 * MIN, 60, { id: 'c' });  // 10 min restantes
  assert.deepStrictEqual(R.ordenar([c, b, a], T0).map(x => x.i.id), ['a', 'b', 'c']);
  assert.deepStrictEqual(R.ordenar([c, b, a], T0 + 11 * MIN).map(x => x.i.id), ['a', 'b', 'c'], 'c venceu há 1 min mas ainda é o menor atraso');
  assert.deepStrictEqual(R.ordenar([c, b, a], T0 + 11 * MIN).map(x => x.av.excedido), [true, true, true]);
});

test('empate: saída mais antiga primeiro, depois id (ordem estável)', () => {
  const x = intervalo(T0 - 70 * MIN, 60, { id: 'x' }), y = intervalo(T0 - 70 * MIN, 60, { id: 'y' });
  assert.deepStrictEqual(R.ordenar([y, x], T0).map(i => i.i.id), ['x', 'y']);
  const velho = intervalo(T0 - 80 * MIN, 70, { id: 'v' }), novo = intervalo(T0 - 70 * MIN, 60, { id: 'n' }); // mesmo atraso (10)
  assert.deepStrictEqual(R.ordenar([novo, velho], T0).map(i => i.i.id), ['v', 'n']);
});

test('HR saída digitada: hoje, ou ontem se ficaria no futuro (virada de dia)', () => {
  const agora = new Date(2026, 9, 15, 0, 10, 0).getTime();
  assert.strictEqual(new Date(R.resolverSaida('23:50', agora).ms).getDate(), 14);
  assert.strictEqual(new Date(R.resolverSaida('00:05', agora).ms).getDate(), 15);
  assert.strictEqual(R.resolverSaida('25:00', agora).ok, false);
  assert.strictEqual(R.resolverSaida('abc', agora).ok, false);
});

test('HR entrada digitada: cruza a meia-noite quando menor; igual à saída é recusada', () => {
  const saida = new Date(2026, 9, 14, 23, 30, 20).getTime();
  const e = R.resolverEntrada('00:30', saida);
  assert.ok(e.ok); assert.strictEqual(new Date(e.ms).getDate(), 15); assert.strictEqual(Math.round((e.ms - saida) / MIN), 60);
  assert.strictEqual(R.resolverEntrada('23:30', saida).ok, false);
  assert.ok(R.resolverEntrada('23:45', saida).ok);
});

test('recalcular: duração/saída mexem na entrada; entrada digitada vira a nova duração', () => {
  const t = { saidaMs: T0, duracaoMin: 60, entradaMs: T0 + 60 * MIN };
  assert.strictEqual(R.recalcular(Object.assign({}, t, { duracaoMin: 45 }), 'duracao').entradaMs, T0 + 45 * MIN);
  assert.strictEqual(R.recalcular(Object.assign({}, t, { saidaMs: T0 + 10 * MIN }), 'saida').entradaMs, T0 + 70 * MIN);
  const e = R.recalcular({ saidaMs: T0, duracaoMin: 60, entradaMs: T0 + 90 * MIN }, 'entrada');
  assert.ok(e.ok); assert.strictEqual(e.duracaoMin, 90); assert.strictEqual(e.entradaMs, T0 + 90 * MIN);
  assert.strictEqual(R.recalcular({ saidaMs: T0, duracaoMin: 60, entradaMs: T0 - MIN }, 'entrada').ok, false);
});

test('editar horários: registra cada mudança, preserva o instante real da liberação e não reinicia nada', () => {
  const i = intervalo(T0, 60);
  const liberado = i.liberadoEm;
  const r = R.editarIntervalo(i, { saidaMs: T0 - 5 * MIN, duracaoMin: 75, entradaMs: T0 + 70 * MIN }, T0 + 10 * MIN);
  assert.ok(r.ok && r.mudou);
  assert.strictEqual(r.intervalo.liberadoEm, liberado);
  assert.deepStrictEqual(r.intervalo.alteracoes.map(a => a.campo).sort(), ['duracaoPrevistaMin', 'retornoPrevistoAt', 'saidaAt']);
  const dur = r.intervalo.alteracoes.find(a => a.campo === 'duracaoPrevistaMin');
  assert.deepStrictEqual([dur.de, dur.para], [60, 75]);
  assert.strictEqual(r.intervalo.status, 'ativo');
  assert.strictEqual(R.editarIntervalo(r.intervalo, { saidaMs: T0 - 5 * MIN, duracaoMin: 75, entradaMs: T0 + 70 * MIN }, T0).mudou, false);
  assert.strictEqual(i.alteracoes.length, 0, 'o original não é alterado');
});

test('editar: recusa duração inválida, saída no futuro e entrada antes da saída', () => {
  const i = intervalo(T0, 60);
  assert.strictEqual(R.editarIntervalo(i, { saidaMs: T0, duracaoMin: 0, entradaMs: T0 + MIN }, T0).ok, false);
  assert.strictEqual(R.editarIntervalo(i, { saidaMs: T0 + 30 * MIN, duracaoMin: 60, entradaMs: T0 + 90 * MIN }, T0).ok, false);
  assert.strictEqual(R.editarIntervalo(i, { saidaMs: T0, duracaoMin: 60, entradaMs: T0 - MIN }, T0).ok, false);
});

test('retorno: grava o horário real, encerra, e o mesmo funcionário pode ter outro intervalo independente', () => {
  const f = func('Carlos Lima');
  const a = R.novoIntervalo({ funcionario: f, setor: 'XPT', duracaoMin: 60, saidaMs: T0, agoraMs: T0 }).intervalo;
  const enc = R.registrarRetorno(a, T0 + 67 * MIN).intervalo;
  assert.strictEqual(enc.status, 'encerrado'); assert.strictEqual(enc.retornoRealAt, new Date(T0 + 67 * MIN).toISOString());
  assert.strictEqual(enc.retornoPrevistoAt, a.retornoPrevistoAt, 'previsto continua distinto do real');
  const b = R.novoIntervalo({ funcionario: f, setor: '', duracaoMin: 60, saidaMs: T0 + 2 * 60 * MIN, agoraMs: T0 + 2 * 60 * MIN }).intervalo;
  assert.notStrictEqual(a.id, b.id);
  assert.strictEqual(R.registrarRetorno(enc, T0 + 90 * MIN).ok, false, 'não encerra duas vezes');
  const dados = { intervalos: [enc, b] };
  assert.strictEqual(R.intervalosAtivosDe(dados, f.id).length, 1);
});

test('liberação: setor opcional, funcionário obrigatório, saída no futuro recusada, liberadoEm = agora', () => {
  const f = func('João Pereira');
  const semSetor = R.novoIntervalo({ funcionario: f, setor: '', duracaoMin: 60, saidaMs: T0, agoraMs: T0 + 5000 });
  assert.ok(semSetor.ok); assert.strictEqual(semSetor.intervalo.setor, ''); assert.strictEqual(semSetor.intervalo.liberadoEm, new Date(T0 + 5000).toISOString());
  assert.strictEqual(R.novoIntervalo({ funcionario: null, duracaoMin: 60, saidaMs: T0, agoraMs: T0 }).ok, false);
  assert.strictEqual(R.novoIntervalo({ funcionario: f, duracaoMin: 60, saidaMs: T0 + 10 * MIN, agoraMs: T0 }).ok, false);
});

test('cadastro: duplicado é o mesmo nome completo (acento, caixa e espaços não diferenciam); homônimos de primeiro nome são permitidos', () => {
  const lista = [func('Ana Souza'), func('Ana  Beatriz Lima')];
  assert.ok(R.buscarDuplicado(lista, '  ana   SOUZA '));
  assert.ok(R.buscarDuplicado([func('José da Silva')], 'jose da silva'));
  assert.strictEqual(R.buscarDuplicado(lista, 'Ana Costa'), null, 'primeiro nome igual, funcionária diferente');
  assert.strictEqual(R.buscarDuplicado(lista, 'Ana Souza', lista[0].id), null, 'editar o próprio cadastro não é duplicidade');
  assert.strictEqual(R.homonimos(lista, lista[0]).length, 1);
  assert.strictEqual(R.primeiroNome('  Ana   Beatriz Lima'), 'Ana');
  assert.ok(R.rotuloFuncionario(func('Ana Souza', 'XPT')).includes('XPT'));
});

test('setor: reaproveita a grafia existente e aceita vazio', () => {
  assert.strictEqual(R.normalizarSetor('  nex ', ['NEX', 'XPT']), 'NEX');
  assert.strictEqual(R.normalizarSetor('Embalagem', ['NEX']), 'Embalagem');
  assert.strictEqual(R.normalizarSetor('   ', ['NEX']), '');
});

test('validação dos dados do módulo', () => {
  assert.strictEqual(R.validarDados(R.padrao()).length, 0);
  assert.ok(R.validarDados(null).length);
  const d = R.padrao(); d.funcionarios.push({ id: 'f1', nome: 'Ana' }, { id: 'f1', nome: 'Bia' });
  assert.ok(R.validarDados(d).some(e => e.includes('repetido')));
  const d2 = R.padrao(); d2.intervalos.push({ id: 'i1', funcionarioId: 'f', saidaAt: 'x', duracaoPrevistaMin: 60, status: 'ativo', alteracoes: [] });
  assert.ok(R.validarDados(d2).some(e => e.includes('saidaAt')));
});
