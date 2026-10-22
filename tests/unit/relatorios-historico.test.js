const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { carregar, RAIZ } = require('../lib/carregar');
const NS = carregar(['js/constants.js', 'js/utils.js', 'js/intervalos-regras.js', 'js/report.js', 'js/relatorios-historico.js']);
const P = NS.RelatoriosHistorico;

const s = (id, startTime, endTime, extra = {}) => ({ id, startTime, endTime, sacas: 10, pacotes: 20, occurrences: [], ...extra });
const i = (id, saidaAt, extra = {}) => ({
  id, funcionarioId: 'fun_01', funcionarioNome: 'Ana Souza', setor: 'NEX', saidaAt,
  duracaoPrevistaMin: 60, retornoPrevistoAt: new Date(Date.parse(saidaAt) + 60 * 60000).toISOString(),
  retornoRealAt: new Date(Date.parse(saidaAt) + 55 * 60000).toISOString(), status: 'encerrado', alteracoes: [], ...extra
});

test('NEX seleciona um dia por startTime no fuso operacional, mesmo que termine no dia seguinte', () => {
  const dados = [
    s('antes', '2026-10-14T02:59:59Z', '2026-10-15T01:00:00Z'),
    s('alvo', '2026-10-14T03:00:00Z', '2026-10-15T04:00:00Z'),
    s('depois', '2026-10-15T03:00:00Z', '2026-10-15T04:00:00Z')
  ];
  const r = P.construirNex(dados, { periodo: 'dia', inicio: '2026-10-14', tipo: 'resumido', agora: '2026-10-20T15:00:00Z' });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.quantidade, 1);
  assert.strictEqual(r.dias[0].data, '2026-10-14');
  assert.strictEqual(r.totais.sacas, 10);
});

test('intervalo e todo o histórico incluem limites de calendário e mantêm os totais coerentes', () => {
  const dados = [s('a', '2026-10-14T03:00:00Z'), s('b', '2026-10-15T15:00:00Z'), s('c', '2026-10-16T02:59:59Z')];
  const opcoes = { periodo: 'intervalo', inicio: '2026-10-14', fim: '2026-10-15', tipo: 'resumido' };
  const intervalo = P.construirNex(dados, opcoes);
  assert.strictEqual(intervalo.quantidade, 3); assert.strictEqual(intervalo.totais.sacas, 30);
  assert.strictEqual(intervalo.dias.length, 2);
  const todo = P.construirNex(dados, { periodo: 'todo', tipo: 'resumido' });
  assert.strictEqual(todo.quantidade, 3); assert.strictEqual(todo.totais.pacotes, 60);
});

test('datas inválidas e intervalos invertidos são rejeitados', () => {
  assert.strictEqual(P.validarSelecao({ periodo: 'dia', inicio: '2026-02-30', tipo: 'resumido' }).ok, false);
  assert.strictEqual(P.validarSelecao({ periodo: 'intervalo', inicio: '2026-10-16', fim: '2026-10-15', tipo: 'resumido' }).ok, false);
  assert.strictEqual(P.validarSelecao({ periodo: 'intervalo', inicio: '2026-10-15', fim: '', tipo: 'resumido' }).ok, false);
});

test('resumo exclui identificadores e detalhes incluem códigos, status, notas e subtotais', () => {
  const dados = [s('sessao-privada', '2026-10-14T15:00:00Z', '2026-10-15T02:00:00Z', { occurrences: [
    { id: 'occ_1', code: 'PKG123', category: 'avariados', status: 'pendente', note: 'Embalagem danificada' },
    { id: 'occ_2', code: 'PKG456', category: 'avariados', status: 'resolvido', note: '' }
  ] })];
  const resumo = P.construirNex(dados, { periodo: 'todo', tipo: 'resumido', agora: '2026-10-16T12:00:00Z' });
  assert.strictEqual(resumo.registros.length, 0); assert.strictEqual(resumo.totais.ocorrencias, 2);
  assert.strictEqual(resumo.totais.categorias['Pacotes avariados e retirados'], 2);
  const detalhe = P.construirNex(dados, { periodo: 'todo', tipo: 'detalhado', agora: '2026-10-16T12:00:00Z' });
  assert.strictEqual(detalhe.registros[0].id, 'sessao-privada');
  assert.strictEqual(detalhe.registros[0].occurrences[0].code, 'PKG123');
  assert.strictEqual(detalhe.registros[0].occurrences[0].note, 'Embalagem danificada');
  assert.deepStrictEqual(dados[0].occurrences.map(x => x.id), ['occ_1', 'occ_2']);
});

test('Intervalos usa saidaAt, filtra apenas encerrados e preserva IDs no detalhado', () => {
  const dados = [
    i('int-a', '2026-10-14T03:00:00Z', { retornoRealAt: '2026-10-15T02:59:59Z' }),
    i('int-b', '2026-10-15T03:00:00Z'),
    i('int-ativo', '2026-10-14T15:00:00Z', { status: 'ativo', retornoRealAt: null })
  ];
  const resumo = P.construirIntervalos(dados, { periodo: 'dia', inicio: '2026-10-14', tipo: 'resumido' });
  assert.strictEqual(resumo.quantidade, 1); assert.strictEqual(resumo.dias[0].data, '2026-10-14');
  assert.strictEqual(resumo.dias[0].minutosDecorridos, 1439);
  assert.strictEqual(resumo.totais.minutosDecorridos, 1439);
  assert.strictEqual(resumo.registros.length, 0);
  const detalhe = P.construirIntervalos(dados, { periodo: 'dia', inicio: '2026-10-14', tipo: 'detalhado' });
  assert.strictEqual(detalhe.registros[0].id, 'int-a');
  assert.strictEqual(detalhe.registros[0].funcionarioId, 'fun_01');
  assert.strictEqual(detalhe.registros[0].saidaAt, '2026-10-14T03:00:00Z');
});

test('histórico vazio gera prévia válida com zero registros e identifica a marca correta', () => {
  const r = P.construirNex([], { periodo: 'todo', tipo: 'resumido', agora: '2026-10-16T12:00:00Z' });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.quantidade, 0); assert.match(r.periodo, /sem registros/);
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.json'), 'utf8'));
  assert.match(html, /<title>MeliNotepad/); assert.match(html, /class="app-header__nome">MeliNotepad/);
  assert.strictEqual(manifest.short_name, 'MeliNotepad');
  assert.strictEqual(NS.Report.montarDadosCompletos(s('sess-brand', '2026-10-14T15:00:00Z')).nomeApp, 'MeliNotepad');
  assert.ok(NS.Report.gerarTextoRelatorio(s('sess-brand', '2026-10-14T15:00:00Z')).includes('*MeliNotepad*'));
  assert.match(fs.readFileSync(path.join(RAIZ, 'js/xpt-regras.js'), 'utf8'), /\*MeliNotepad\* — Expedição XPT/);
});
