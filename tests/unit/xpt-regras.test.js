const test = require('node:test');
const assert = require('node:assert');
const { carregar } = require('../lib/carregar');
const { XptRegras: X } = carregar(['js/utils.js', 'js/xpt-regras.js']);
const T = new Date(2026, 9, 14, 8, 0, 0).getTime();
const arr = a => Array.from(a);

test('códigos: lista simples por linha, vírgula e ponto e vírgula', () => {
  const r = X.interpretarCodigos('101, 102\n103;104');
  assert.deepStrictEqual(arr(r.novos), ['101', '102', '103', '104']);
});
test('códigos: intervalos (100-105, G100-G103, G100-103, 100..103, 100 a 103) expandem para revisão', () => {
  assert.deepStrictEqual(arr(X.interpretarCodigos('100-105').novos), ['100', '101', '102', '103', '104', '105']);
  assert.deepStrictEqual(arr(X.interpretarCodigos('G100-G102').novos), ['G100', 'G101', 'G102']);
  assert.deepStrictEqual(arr(X.interpretarCodigos('G100-102').novos), ['G100', 'G101', 'G102']);
  assert.deepStrictEqual(arr(X.interpretarCodigos('100..102').novos), ['100', '101', '102']);
  assert.deepStrictEqual(arr(X.interpretarCodigos('100 a 102').novos), ['100', '101', '102']);
  assert.strictEqual(X.interpretarCodigos('100-105').linhas[0].tipo, 'intervalo');
});
test('códigos: zeros à esquerda preservados no intervalo e nos códigos soltos', () => {
  assert.deepStrictEqual(arr(X.interpretarCodigos('0098-0101').novos), ['0098', '0099', '0100', '0101']);
  assert.deepStrictEqual(arr(X.interpretarCodigos('007, 0008').novos), ['007', '0008']);
});
test('códigos: hífen que faz parte do código não vira intervalo (nem com a opção ligada, nem sem número)', () => {
  assert.deepStrictEqual(arr(X.interpretarCodigos('XPT-123').novos), ['XPT-123']);
  assert.deepStrictEqual(arr(X.interpretarCodigos('2026-10-14').novos), ['2026-10-14']);
  assert.deepStrictEqual(arr(X.interpretarCodigos('100-105', { hifenComoCodigo: true }).novos), ['100-105']);
});
test('códigos: intervalo invertido, grande demais e conteúdo inválido viram erro de revisão, sem gravar nada', () => {
  const r = X.interpretarCodigos('10-5\n1-99999\n{"id":\n55');
  assert.strictEqual(r.erros.length, 3);
  assert.deepStrictEqual(arr(r.novos), ['55']);
});
test('códigos: repetidos no lote e já existentes são separados; JSON de QR vira só o id', () => {
  const r = X.interpretarCodigos('1, 2, 2, 3, {"id":"9","t":"lm"}', {}, ['3']);
  assert.deepStrictEqual(arr(r.novos), ['1', '2', '9']);
  assert.deepStrictEqual(arr(r.repetidosNoLote), ['2']);
  assert.deepStrictEqual(arr(r.jaExistentes), ['3']);
});
test('nenhum código de gaiola fixo no módulo', () => {
  const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../../js/xpt-regras.js', 'utf8');
  assert.ok(!/gaiola\s*[:=]\s*['"]\d+['"]/i.test(src));
});

function opComGaiolas(codigos) { const op = X.novaOperacao(T); X.adicionarGaiolas(op, codigos, T); return op; }

test('auditoria: VUC é excluído de todos os totais e cálculos', () => {
  const op = opComGaiolas(['1', '2', '3', '4', '5', '6']);
  const g = op.gaiolas;
  g[5].vuc = true; // campo legado ignorado
  assert.ok(X.definirAuditoria(g[0], 'concluida_sem_divergencia', 'Ana', T).ok);
  assert.ok(X.definirAuditoria(g[1], 'concluida_com_divergencia', 'Carlos', T).ok);
  assert.ok(X.definirAuditoria(g[2], 'pendente', null, T).ok);
  const r = X.resumoAuditoria(g);
  assert.deepStrictEqual([r.total, r.concluidas, r.pendentes, r.naoIniciadas, r.vuc], [5, 2, 1, 2, 1]);
  assert.strictEqual(r.percentual, 40);
  assert.strictEqual(r.concluidas, 2);
});
test('auditoria: concluir exige nome do auditor; estado inválido é recusado; histórico guardado', () => {
  const g = opComGaiolas(['1']).gaiolas[0];
  assert.strictEqual(X.definirAuditoria(g, 'concluida_sem_divergencia', '', T).ok, false);
  assert.strictEqual(X.definirAuditoria(g, 'xyz', 'Ana', T).ok, false);
  X.definirAuditoria(g, 'concluida_sem_divergencia', 'Ana', T);
  X.definirAuditoria(g, 'pendente', null, T + 1);
  assert.strictEqual(g.auditoria.historico.length, 2); assert.strictEqual(g.auditoria.auditor, null);
});
test('auditoria: sem gaiolas convencionais não há percentual (não inventa 0% nem 100%)', () => {
  const op = opComGaiolas(['1']); op.gaiolas[0].vuc = true;
  assert.strictEqual(X.resumoAuditoria(op.gaiolas).percentual, null);
});
test('gaiolas: não duplica a mesma gaiola (sem diferenciar caixa) e devolve as ignoradas', () => {
  const op = opComGaiolas(['A1', 'a2']);
  const r = X.adicionarGaiolas(op, ['a1', 'A3'], T);
  assert.strictEqual(op.gaiolas.length, 3); assert.deepStrictEqual(arr(r.ignoradas), ['a1']);
});

test('quantidades: total de produtos soma pacotes+volumosos+extra; redes não usa valores legados de veículo nem paletes', () => {
  const op = X.novaOperacao(T);
  Object.assign(op.quantidades, { pacotes: 100, volumosos: 20, extraVolumosos: 5, totalBK: 999, paletes: 10, redes: 4 });
  assert.strictEqual(X.totais(op).totalProdutos, 125);
  let v = X.novoVeiculo({ placa: 'abc-1234', paletes: 4, redes: 2 }, T).veiculo; op.veiculos.push(v);
  v = X.novoVeiculo({ placa: 'DEF1G23', paletes: 3, redes: 2 }, T).veiculo; op.veiculos.push(v);
  const t = X.totais(op);
  assert.strictEqual(t.paletesVeiculos, 7); assert.strictEqual(t.redesVeiculos, 0);
  assert.strictEqual(t.avisos.length, 1); assert.ok(t.avisos[0].includes('Paletes'));
});

test('redes por veículo: soma G+V das rotas associadas uma única vez e exclui P', () => {
  const op = opComGaiolas(['R1', 'R2']);
  const a = op.gaiolas[0], b = op.gaiolas[1];
  a.auditoria.quantidades = { g: 3, v: 2, p: 99 };
  b.auditoria.quantidades = { g: 4, v: 1, p: 88 };
  const v = X.novoVeiculo({ placa: 'AAA1111', redes: 999 }, T).veiculo; op.veiculos.push(v);
  v.gaiolaIds.push(a.id, b.id, a.id);
  const redes = X.redesDoVeiculo(op, v);
  assert.deepStrictEqual([redes.valor, redes.rotasInformadas, redes.rotasAssociadas], [10, 2, 2]);
  assert.strictEqual(X.totais(op).redesVeiculos, 10);
  assert.ok(!X.relatorioBasico(op).includes('Redes: 4'));
  assert.ok(X.relatorioBasico(op).includes('redes calculadas: 10'));
});
test('quantidades vazias valem zero na soma, sem virar NaN', () => {
  assert.strictEqual(X.totais(X.novaOperacao(T)).totalProdutos, 0);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(X.inteiroOuNulo(''))), { ok: true, valor: null });
  assert.strictEqual(X.inteiroOuNulo('-1').ok, false); assert.strictEqual(X.inteiroOuNulo('1.5').ok, false);
});

test('veículos: placa normalizada e obrigatória; paletes/redes inteiros', () => {
  assert.strictEqual(X.normalizarPlaca(' abc-1d23 '), 'ABC1D23');
  assert.ok(X.placaPadraoConhecido('ABC1234') && X.placaPadraoConhecido('ABC1D23') && !X.placaPadraoConhecido('12'));
  assert.strictEqual(X.novoVeiculo({ placa: ' ' }, T).ok, false);
  assert.strictEqual(X.novoVeiculo({ placa: 'ABC1234', paletes: 'x' }, T).ok, false);
});
test('veículo × gaiola: associação exclusiva; remover registra histórico e libera para outro veículo', () => {
  const op = opComGaiolas(['G1', 'G2']);
  const a = X.novoVeiculo({ placa: 'AAA1111' }, T).veiculo, b = X.novoVeiculo({ placa: 'BBB2222' }, T).veiculo; op.veiculos.push(a, b);
  const g1 = op.gaiolas[0].id;
  assert.ok(X.carregarGaiola(op, a.id, g1, T).ok);
  const dup = X.carregarGaiola(op, b.id, g1, T); assert.strictEqual(dup.ok, false); assert.ok(dup.erro.includes('AAA1111'));
  assert.strictEqual(X.carregarGaiola(op, a.id, g1, T).ok, false, 'nem duas vezes no mesmo veículo');
  assert.strictEqual(X.veiculoDaGaiola(op, g1).id, a.id);
  assert.ok(X.descarregarGaiola(op, a.id, g1, T + 5).ok);
  assert.deepStrictEqual(arr(a.historico.map(h => h.acao)), ['gaiola_carregada', 'gaiola_removida']);
  assert.ok(X.carregarGaiola(op, b.id, g1, T + 9).ok);
  assert.strictEqual(X.descarregarGaiola(op, a.id, g1, T).ok, false);
});

test('ocorrências: categorias, "outra" exige descrição, identificador passa pela interpretação do QR', () => {
  assert.strictEqual(X.novaOcorrencia({ categoria: 'x' }, T).ok, false);
  assert.strictEqual(X.novaOcorrencia({ categoria: 'outra' }, T).ok, false);
  assert.ok(X.novaOcorrencia({ categoria: 'outra', outraDescricao: 'Etiqueta ilegível', produtoId: '42', gaiolaEncontrada: 'G1', identificadoPor: 'Ana' }, T).ok);
  const r = X.novaOcorrencia({ categoria: 'bingo', produtoId: '{"id":"0042","t":"lm"}', gaiolaEncontrada: 'G9', gaiolaCorreta: 'G3', identificadoPor: 'Ana' }, T);
  assert.ok(r.ok); assert.strictEqual(r.ocorrencia.produtoId, '0042'); assert.strictEqual(r.ocorrencia.status, 'pendente');
  assert.strictEqual(X.novaOcorrencia({ categoria: 'avaria', produtoId: '{"id":' }, T).ok, false);
  assert.deepStrictEqual(arr(X.CATEGORIAS.map(c => c.id)), ['bingo', 'faltante', 'duplicado', 'avaria', 'retirado', 'outra']);
});
test('ocorrências: divergência da auditoria é derivada das ocorrências na gaiola POO', () => {
  const op = opComGaiolas(['A2','A4']); const g = op.gaiolas[1];
  X.definirAuditoria(g, 'concluida', 'Carlos', T);
  assert.strictEqual(X.rotuloAuditoria(op, g), 'Concluído');
  op.ocorrencias.push(X.novaOcorrencia({ categoria: 'bingo', produtoId: 'PKG-9', gaiolaEncontrada: 'A4', gaiolaCorreta: 'A2', identificadoPor: 'Carlos' }, T).ocorrencia);
  assert.strictEqual(X.rotuloAuditoria(op, g), 'Concluído com divergência');
  assert.strictEqual(X.rotuloAuditoria(op, op.gaiolas[0]), 'Não auditado');
  const relatorio = X.relatorioBasico(op);
  assert.ok(relatorio.includes('Gaiola A4: Concluído com divergência'));
  assert.ok(relatorio.includes('produto PKG-9'));
  assert.ok(relatorio.includes('encontrado por: Carlos'));
});

test('ocorrências: resolver e reabrir preservam o histórico; mesmo produto é detectado', () => {
  const op = X.novaOperacao(T);
  const oc = X.novaOcorrencia({ categoria: 'faltante', produtoId: 'P-1', gaiolaEncontrada: 'G1', identificadoPor: 'Ana' }, T).ocorrencia; op.ocorrencias.push(oc);
  assert.ok(X.mudarStatus(oc, 'resolvido', 'achado na gaiola 7', T + 1).ok);
  assert.strictEqual(X.mudarStatus(oc, 'resolvido', '', T).ok, false);
  assert.ok(X.mudarStatus(oc, 'pendente', 'voltou', T + 2).ok);
  assert.deepStrictEqual(arr(oc.historico.map(h => h.para)), ['resolvido', 'pendente']);
  assert.strictEqual(oc.historico[0].nota, 'achado na gaiola 7');
  assert.strictEqual(X.produtoJaRegistrado(op, ' p-1 ').length, 1);
  assert.strictEqual(X.produtoJaRegistrado(op, '').length, 0);
});

test('operação: fim do carregamento e encerramento são distintos; atravessar a meia-noite não muda o dia de referência', () => {
  const op = X.novaOperacao(new Date(2026, 9, 14, 23, 0, 0).getTime());
  assert.strictEqual(X.situacaoOperacao(op), 'em_andamento');
  op.fimCarregamentoAt = new Date(2026, 9, 15, 1, 0, 0).toISOString();
  assert.strictEqual(X.situacaoOperacao(op), 'carregamento_encerrado', 'aberta depois do carregamento');
  assert.strictEqual(op.diaRef, '2026-10-14');
  op.encerradaAt = new Date(2026, 9, 15, 2, 0, 0).toISOString();
  assert.strictEqual(X.situacaoOperacao(op), 'encerrada');
  assert.strictEqual(op.diaRef, '2026-10-14');
  const aberta = X.novaOperacao(new Date(2026, 9, 11, 8, 0, 0).getTime());
  assert.strictEqual(X.diasAberta(aberta, new Date(2026, 9, 14, 9, 0, 0).getTime()), 3);
});

test('validação dos dados: aceita o padrão; recusa gaiola em dois veículos e auditoria inválida', () => {
  assert.strictEqual(X.validarDados(X.padrao()).length, 0);
  const op = opComGaiolas(['1']); const d = { operacoes: [op] };
  const a = X.novoVeiculo({ placa: 'AAA1111' }, T).veiculo, b = X.novoVeiculo({ placa: 'BBB2222' }, T).veiculo;
  a.gaiolaIds.push(op.gaiolas[0].id); b.gaiolaIds.push(op.gaiolas[0].id); op.veiculos.push(a, b);
  assert.ok(X.validarDados(d).some(e => e.includes('mais de um veículo')));
  op.gaiolas[0].auditoria.estado = 'inventado';
  assert.ok(X.validarDados(d).some(e => e.includes('auditoria inválida')));
});

test('códigos: vários JSONs de QR colados juntos (com vírgula interna) são lidos cada um como um id', () => {
  const r = X.interpretarCodigos('{"id":"11","t":"lm"}, {"id":"0012","t":"lm"}\n{"id":"13"}, 14');
  assert.deepStrictEqual(arr(r.novos), ['11', '0012', '13', '14']); assert.strictEqual(r.erros.length, 0);
});
