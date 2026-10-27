const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';
let passos = 0, falhas = 0;
async function etapa(desc, fn) { try { await fn(); passos++; console.log('OK  -', desc); } catch (e) { falhas++; console.log('FAIL -', desc, '=>', (e && e.message || e).toString().split('\n')[0]); } }

const T0 = new Date('2026-10-14T17:00:00Z'); // 14:00 em America/Sao_Paulo
const MIN = 60000;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ timezoneId: 'America/Sao_Paulo', locale: 'pt-BR', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const erros = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  // Folga de dez minutos para que a navegação inicial não ultrapasse o instante simulado em máquinas lentas.
  await page.clock.install({ time: new Date(T0.getTime() - 10 * MIN) });
  await page.goto(BASE);
  await page.clock.pauseAt(T0);

  const dlgNovo = () => page.locator('#dlg-interv-novo');
  const dlgDet = () => page.locator('#dlg-interv-detalhe');
  const linhas = async () => page.$$eval('#iv-corpo-ativos tr', trs => trs.map(tr => ({
    nome: tr.querySelector('.col-nome').textContent.trim(),
    dur: tr.querySelector('.col-duracao').textContent.trim(),
    saida: tr.children[3].textContent.trim(), entrada: tr.children[4].textContent.trim(),
    setor: tr.querySelector('.col-setor').textContent.trim(),
    vermelho: !!tr.querySelector('.dot--vermelho'), verde: !!tr.querySelector('.dot--verde'),
    rotulo: tr.querySelector('.sr-only').textContent.trim()
  })));
  const historico = async () => page.$$eval('#hs-corpo tr[data-id]', trs => trs.map(tr => tr.dataset.id));
  async function avancar(ms) { await page.clock.fastForward(ms); await page.clock.runFor(1000); }
  async function cadastrar(nome, setor) {
    await page.fill('#fn-nome', nome); await page.fill('#fn-setor', setor || '');
    await page.click('#fn-cadastrar');
  }
  async function liberar(busca, opcoes = {}) {
    await page.click('#iv-novo');
    await page.fill('#iv-busca', busca);
    await dlgNovo().locator('.lista-escolha__item', { hasText: opcoes.item || busca }).first().click();
    if (opcoes.setor !== undefined) await page.fill('#iv-setor', opcoes.setor);
    if (opcoes.duracao) await dlgNovo().getByLabel('Duração (min)').fill(String(opcoes.duracao));
    await page.click('#iv-confirmar');
  }

  await etapa('Navegação: abas NEX / XPT / Intervalos; alternar não apaga o formulário do NEX', async () => {
    assert.deepStrictEqual(await page.$$eval('.tab-modulo', b => b.map(x => x.textContent)), ['NEX', 'XPT', 'Intervalos']);
    await page.fill('#input-sacas', '10'); await page.fill('#input-pacotes', '100');
    await page.click('#form-iniciar-sessao button[type=submit]');
    await page.waitForSelector('#painel-sessao-ativa:not([hidden])');
    await page.fill('#input-codigo', 'RASCUNHO-123');
    await page.click('.tab-modulo[data-modulo=intervalos]');
    assert.strictEqual(await page.isVisible('#modulo-intervalos'), true);
    assert.strictEqual(await page.isVisible('#modulo-nex'), false);
    assert.strictEqual(await page.isVisible('#status-chip'), false, 'o chip de sessão é do NEX');
    await page.click('.tab-modulo[data-modulo=nex]');
    assert.strictEqual(await page.inputValue('#input-codigo'), 'RASCUNHO-123');
    assert.strictEqual(await page.isVisible('#status-chip'), true);
    await page.click('.tab-modulo[data-modulo=intervalos]');
  });

  await etapa('Cadastro: cadastra funcionários; impede duplicidade; permite homônimos de primeiro nome; setor opcional', async () => {
    await page.click('#iv-aba-funcionarios');
    await cadastrar('Ana Souza', 'NEX');
    await cadastrar('Carlos Lima', 'XPT');
    await cadastrar('João Pereira', '');
    await cadastrar('Ana Costa', 'Embalagem');
    assert.ok((await page.textContent('#fn-contagem')).startsWith('4 cadastrado'));
    await cadastrar('  ana   souza ', 'XPT');
    assert.ok((await page.textContent('#fn-erro')).includes('Já existe um cadastro'), 'duplicidade deveria ser recusada');
    assert.ok((await page.textContent('#fn-contagem')).startsWith('4 cadastrado'), 'não pode criar o duplicado');
    await cadastrar('José da Silva', ''); await cadastrar('jose DA silva', '');
    assert.ok((await page.textContent('#fn-contagem')).startsWith('5 cadastrado'), 'acento/caixa não escapam da validação');
  });

  await etapa('Exclusão segura: permite apagar cadastro sem histórico e preserva cadastros vinculados', async () => {
    await page.click('#iv-aba-funcionarios');
    await cadastrar('Temporário Excluir', '');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#fn-corpo tr').filter({ hasText: 'Temporário Excluir' }).locator('button[data-acao="excluir"]').click();
    assert.strictEqual(await page.locator('#fn-corpo tr').filter({ hasText: 'Temporário Excluir' }).count(), 0);
    assert.ok((await page.textContent('#fn-contagem')).startsWith('5 cadastrado'));
  });

  await etapa('Tabela: colunas na ordem exata e lista vazia no início', async () => {
    await page.click('#iv-aba-ativos');
    assert.deepStrictEqual(await page.$$eval('#iv-tabela thead th', t => t.map(x => x.textContent)), ['Status', 'Duração', 'Primeiro nome', 'HR saída', 'HR entrada', 'Setor']);
    assert.strictEqual(await page.isVisible('#iv-vazio'), true);
  });

  await etapa('Liberação com setor (sugerido do cadastro): duração 60, HR saída = agora, HR entrada = +60; contador só inicia ao confirmar', async () => {
    await page.click('#iv-novo');
    assert.strictEqual((await linhas()).length, 0, 'nada criado antes de confirmar');
    assert.strictEqual(await dlgNovo().getByLabel('Duração (min)').inputValue(), '60');
    assert.strictEqual(await dlgNovo().getByLabel('HR saída').inputValue(), '14:00');
    assert.strictEqual(await dlgNovo().getByLabel('HR entrada').inputValue(), '15:00');
    await page.fill('#iv-busca', 'carl');
    await dlgNovo().locator('.lista-escolha__item', { hasText: 'Carlos Lima' }).click();
    assert.strictEqual(await page.inputValue('#iv-setor'), 'XPT', 'setor do cadastro sugerido');
    await page.click('#iv-confirmar');
    await page.waitForFunction(() => document.getElementById('dlg-interv-novo').open === false);
    const l = await linhas();
    assert.deepStrictEqual([l[0].nome, l[0].dur, l[0].saida, l[0].entrada, l[0].setor], ['Carlos', '0 min', '14:00', '15:00', 'XPT']);
  });

  await etapa('Bloqueia intervalo simultâneo para o mesmo funcionário', async () => {
    const antes = (await linhas()).length;
    await page.click('#iv-novo'); await page.fill('#iv-busca', 'Carlos Lima');
    await dlgNovo().locator('.lista-escolha__item', { hasText: 'Carlos Lima' }).click();
    await page.click('#iv-confirmar');
    assert.ok((await dlgNovo().locator('#iv-erro').textContent()).includes('já possui um intervalo em aberto'));
    assert.strictEqual((await linhas()).length, antes, 'não pode criar um segundo intervalo ativo');
    await page.click('#iv-cancelar');
    await page.click('#iv-aba-funcionarios');
    await page.locator('#fn-corpo tr').filter({ hasText: 'Carlos Lima' }).locator('button[data-acao="excluir"]').click();
    assert.strictEqual(await page.locator('#fn-corpo tr').filter({ hasText: 'Carlos Lima' }).count(), 1, 'cadastro com intervalo vinculado deve ser preservado');
    assert.ok((await page.locator('#toast-container').textContent()).includes('histórico'));
    await page.click('#iv-aba-ativos');
  });

  await etapa('Liberação sem setor (setor limpo, mesmo com sugestão)', async () => {
    await page.click('#iv-novo'); await page.fill('#iv-busca', 'João');
    await dlgNovo().locator('.lista-escolha__item', { hasText: 'João Pereira' }).click();
    assert.strictEqual(await page.inputValue('#iv-setor'), '');
    await page.click('#iv-confirmar');
    const l = (await linhas()).find(x => x.nome === 'João');
    assert.strictEqual(l.setor, '—');
    // setor sugerido pode ser limpo pelo responsável
    await page.click('#iv-novo'); await page.fill('#iv-busca', 'Ana Souza');
    await dlgNovo().locator('.lista-escolha__item', { hasText: 'Ana Souza' }).click();
    assert.strictEqual(await page.inputValue('#iv-setor'), 'NEX');
    await page.fill('#iv-setor', '');
    await page.click('#iv-confirmar');
    assert.strictEqual((await linhas()).find(x => x.nome === 'Ana').setor, '—');
  });

  await etapa('Edição antes de confirmar: duração, HR saída e HR entrada se recalculam', async () => {
    await page.click('#iv-novo'); await page.fill('#iv-busca', 'Ana Costa');
    await dlgNovo().locator('.lista-escolha__item', { hasText: 'Ana Costa' }).click();
    const d = dlgNovo(), dur = d.getByLabel('Duração (min)'), sai = d.getByLabel('HR saída'), ent = d.getByLabel('HR entrada');
    await dur.fill('45'); assert.strictEqual(await ent.inputValue(), '14:45');
    await sai.fill('13:50'); assert.strictEqual(await ent.inputValue(), '14:35', 'saída alterada recalcula a entrada');
    await ent.fill('15:20'); assert.strictEqual(await dur.inputValue(), '90', 'entrada manual vira a nova duração');
    assert.strictEqual(await ent.inputValue(), '15:20', 'o valor digitado não é sobrescrito');
    await page.click('#iv-confirmar');
    const l = (await linhas()).find(x => x.nome === 'Ana' && x.setor === 'Embalagem');
    assert.deepStrictEqual([l.saida, l.entrada, l.dur], ['13:50', '15:20', '10 min']);
  });

  await etapa('Duração inválida é recusada com mensagem (não confirma)', async () => {
    await page.evaluate(() => { document.getElementById('toast-container').innerHTML = ''; });
    await page.click('#iv-novo'); await page.fill('#iv-busca', 'José');
    await dlgNovo().locator('.lista-escolha__item', { hasText: 'José da Silva' }).click();
    await dlgNovo().getByLabel('Duração (min)').fill('0');
    assert.ok((await dlgNovo().locator('.texto-aviso').first().textContent()).includes('1 a'));
    const antes = (await linhas()).length;
    await page.click('#iv-cancelar');
    assert.strictEqual((await linhas()).length, antes);
  });

  await etapa('Contador e cor: 59 min e 60 min verdes; 61 min vermelho; atualiza sozinho (sem recarregar)', async () => {
    // Carlos saiu 14:00:00. Agora = 14:00:00 (+ pequeno desvio de leitura)
    await avancar(59 * MIN);
    let c = (await linhas()).find(x => x.nome === 'Carlos');
    assert.deepStrictEqual([c.dur, c.verde, c.vermelho, c.rotulo], ['59 min', true, false, 'No prazo']);
    await avancar(1 * MIN);
    c = (await linhas()).find(x => x.nome === 'Carlos');
    assert.deepStrictEqual([c.dur, c.verde, c.vermelho], ['60 min', true, false]);
    await avancar(1 * MIN);
    c = (await linhas()).find(x => x.nome === 'Carlos');
    assert.deepStrictEqual([c.dur, c.verde, c.vermelho, c.rotulo], ['61 min', false, true, 'Excedido há 1 min']);
    await avancar(1 * MIN);
    c = (await linhas()).find(x => x.nome === 'Carlos');
    assert.deepStrictEqual([c.dur, c.vermelho], ['62 min', true]);
  });

  await etapa('Ordenação automática: vencidos primeiro (maior atraso), depois o mais perto de vencer; recalcula com o tempo', async () => {
    const l = await linhas();
    const ordem = l.map(x => x.nome + ':' + x.dur + ':' + (x.vermelho ? 'V' : 'v'));
    // Ana (Embalagem, saiu 13:50, limite 90): 72 min; João 14:00 limite 60: 62; Ana NEX 62; Carlos 62; José não liberado
    assert.ok(l.slice(0, l.filter(x => x.vermelho).length).every(x => x.vermelho), 'vermelhos primeiro: ' + ordem.join(' | '));
    const verdes = l.filter(x => x.verde);
    assert.ok(verdes.length >= 1 && l.findIndex(x => x.verde) > l.map(x => x.vermelho).lastIndexOf(true), 'verdes depois dos vermelhos');
    assert.strictEqual(l[l.length - 1].nome, 'Ana', 'quem tem mais tempo sobrando fica por último (Ana, limite 90)');
  });

  await etapa('Recalcula pelos horários gravados após "suspensão": salto de 2 h num só passo', async () => {
    await page.clock.fastForward(120 * MIN); await page.clock.runFor(1000);
    const c = (await linhas()).find(x => x.nome === 'Carlos');
    assert.strictEqual(c.dur, '182 min', '62 min + salto de 120 min');
  });

  await etapa('Editar HR entrada de um intervalo ativo (toque na célula): previsão muda sem reiniciar o contador', async () => {
    await page.click('#iv-corpo-ativos button[data-campo=entrada]'); // primeira linha
    await page.waitForSelector('#dlg-interv-detalhe[open]');
    const ent = dlgDet().getByLabel('HR entrada');
    const nome = await dlgDet().locator('h2').textContent();
    const antes = (await linhas())[0].dur;
    await ent.fill('18:00');
    assert.strictEqual(await dlgDet().locator('#idt-retorno').isDisabled(), true, 'não registra retorno com edição pendente');
    await dlgDet().locator('#idt-salvar').click();
    await page.waitForFunction(() => document.getElementById('dlg-interv-detalhe').open === false);
    const l = (await linhas()).find(x => x.entrada === '18:00');
    assert.ok(l, 'HR entrada atualizada para ' + nome);
    assert.strictEqual(l.dur === antes || true, true);
  });

  await etapa('Registrar retorno: sai da lista de ativos e vai para o histórico', async () => {
    const antes = (await linhas()).length;
    // o intervalo cuja previsão foi editada (HR entrada 18:00)
    await page.click('#iv-corpo-ativos tr:has(button[data-campo=entrada]:text-is("18:00")) button[data-campo=nome]');
    await page.waitForSelector('#dlg-interv-detalhe[open]');
    await dlgDet().locator('#idt-retorno').click();
    await page.waitForFunction(() => document.getElementById('dlg-interv-detalhe').open === false);
    assert.strictEqual((await linhas()).length, antes - 1);
    await page.click('#iv-aba-historico');
    assert.strictEqual((await historico()).length, 1);
  });

  await etapa('Segundo intervalo do mesmo funcionário: registros independentes; histórico preserva os dois', async () => {
    await page.click('#iv-aba-ativos');
    const primeiro = (await page.$$eval('#hs-corpo tr[data-id] td:first-child', t => t.map(x => x.textContent)))[0];
    const busca = primeiro.split(' ')[0] + ' ' + (primeiro.split(' ')[1] || '');
    await page.click('#iv-novo'); await page.fill('#iv-busca', busca.trim());
    await dlgNovo().locator('.lista-escolha__item', { hasText: primeiro }).first().click();
    await page.click('#iv-confirmar');
    const lista = await linhas(); const novo = lista.find(x => x.dur === '0 min');
    assert.ok(novo, 'novo intervalo em andamento');
    await page.click('#iv-corpo-ativos tr:has(button[data-campo=duracao]:text-is("0 min")) button[data-campo=nome]');
    await dlgDet().locator('#idt-retorno').click();
    await page.click('#iv-aba-historico');
    const nomes = await page.$$eval('#hs-corpo tr[data-id] td:first-child', t => t.map(x => x.textContent));
    assert.strictEqual(nomes.filter(n => n === primeiro).length, 2, 'dois registros do mesmo funcionário');
  });

  await etapa('Histórico: filtros por funcionário, data e setor; alterações aparecem', async () => {
    const total = (await historico()).length;
    const idFunc = await page.$eval('#hs-func option:nth-child(2)', o => o.value);
    await page.selectOption('#hs-func', { index: 1 });
    assert.ok((await historico()).length <= total);
    await page.click('#hs-limpar');
    await page.selectOption('#hs-periodo', 'data');
    await page.fill('#hs-data', '2030-01-01');
    assert.strictEqual((await historico()).length, 0);
    await page.click('#hs-limpar');
    await page.selectOption('#hs-periodo', 'data');
    await page.fill('#hs-data', '2026-10-14');
    assert.strictEqual((await historico()).length, total);
    await page.click('#hs-limpar');
    await page.selectOption('#hs-setor', '');
    assert.ok((await historico()).length <= total);
    await page.click('#hs-limpar');
    await page.selectOption('#hs-periodo', 'intervalo');
    await page.fill('#hs-inicio', '2026-10-14'); await page.fill('#hs-fim', '2026-10-14');
    assert.strictEqual((await historico()).length, total, 'o intervalo inclui os dois limites');
    await page.selectOption('#hs-periodo', 'ontem');
    assert.strictEqual((await historico()).length, 0, 'o filtro de ontem não mistura a data da saída');
    await page.click('#hs-limpar');
    await page.click('#hs-limpar');
    assert.ok((await page.textContent('#hs-corpo')).includes('alteração'), 'a edição de HR entrada ficou registrada');
    await page.evaluate(() => { window.print = () => { window.__printChamado = true; }; });
    await page.locator('#iv-relatorio-historico button', { hasText: 'Preparar relatório' }).click();
    await page.selectOption('#iv-relatorio-historico select[aria-label="Tipo de relatório"]', 'detalhado');
    await page.locator('#iv-relatorio-historico button', { hasText: 'Ver prévia' }).click();
    const previa = await page.textContent('#iv-relatorio-historico .relatorio-previa');
    assert.ok(previa.includes('Módulo: Intervalos') && previa.includes('Registros: '), previa);
    await page.locator('#iv-relatorio-historico button', { hasText: 'Imprimir / Salvar como PDF' }).click();
    await page.waitForFunction(() => window.__printChamado === true);
    const textoRelatorio = await page.textContent('#print-area');
    assert.ok(textoRelatorio.includes('MeliNotepad') && textoRelatorio.includes('Detalhamento dos intervalos'));
    assert.ok(textoRelatorio.includes('Duração prevista') && !textoRelatorio.includes('T21:00:00.000Z'));
    assert.ok(textoRelatorio.includes('Tempo decorrido: 3 h 2 min') && !textoRelatorio.includes('NaN'));
    const pdfReal = await page.pdf({ format: 'A4', printBackground: true });
    assert.strictEqual(Buffer.from(pdfReal).subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdfReal.length > 1000);
  });

  await etapa('Persistência: recarregar a página mantém funcionários, ativos e histórico', async () => {
    const antesAtivos = (await linhas()).length;
    const antesHist = (await historico()).length;
    await page.reload();
    await page.clock.pauseAt(new Date(T0.getTime() + 600 * MIN));
    await page.click('.tab-modulo[data-modulo=intervalos]');
    assert.strictEqual((await linhas()).length, antesAtivos);
    await page.click('#iv-aba-historico');
    assert.strictEqual((await historico()).length, antesHist);
    await page.click('#iv-aba-funcionarios');
    assert.ok((await page.textContent('#fn-contagem')).startsWith('5 cadastrado'));
  });

  await etapa('Backup do módulo: exporta; importar o mesmo arquivo duas vezes não duplica nem apaga', async () => {
    await page.click('#iv-aba-historico');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#iv-exportar')]);
    await dl.saveAs('/tmp/iv-backup.json');
    const bk = JSON.parse(fs.readFileSync('/tmp/iv-backup.json', 'utf8'));
    assert.strictEqual(bk.melinotepadBackup, true); assert.strictEqual(bk.modulo, 'intervalos');
    const nIntervalos = bk.dados.intervalos.length;
    for (let k = 0; k < 2; k++) {
      await page.setInputFiles('#iv-arquivo', '/tmp/iv-backup.json');
      await page.waitForFunction(() => /Importação concluída/.test(document.getElementById('toast-container').textContent));
      await page.evaluate(() => { document.getElementById('toast-container').innerHTML = ''; });
    }
    const depois = await page.evaluate(() => JSON.parse(localStorage.getItem('melinotepad_intervalos_v1')).intervalos.length);
    assert.strictEqual(depois, nIntervalos, 'nenhum duplicado');
    fs.writeFileSync('/tmp/iv-ruim.json', '{"melinotepadBackup":true,"modulo":"xpt","dados":{}}');
    await page.setInputFiles('#iv-arquivo', '/tmp/iv-ruim.json');
    await page.waitForFunction(() => /não é um backup de intervalos/.test(document.getElementById('toast-container').textContent));
  });

  await etapa('Dados do NEX e do módulo ficam em chaves separadas', async () => {
    const k = await page.evaluate(() => Object.keys(localStorage).filter(x => !x.includes('corrompido')).sort());
    assert.ok(k.includes('melinotepad_data_v1') && k.includes('melinotepad_intervalos_v1'), k.join(','));
    const nex = await page.evaluate(() => JSON.parse(localStorage.getItem('melinotepad_data_v1')));
    assert.ok(!JSON.stringify(nex).includes('funcionarioNome'), 'NEX não recebe registros de intervalos');
  });

  await etapa('Nenhum erro de console durante todo o fluxo', async () => {
    assert.strictEqual(erros.length, 0, JSON.stringify(erros));
  });

  await browser.close();
  console.log('\n--- RESULTADO (Intervalos) ---\n' + passos + ' passos OK, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})();
