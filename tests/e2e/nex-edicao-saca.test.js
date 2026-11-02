const { chromium } = require('playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const respostas = [];
  const erros = [];
  page.on('pageerror', erro => erros.push(erro.message));
  page.on('dialog', dialog => dialog.accept(respostas.shift() || ''));
  try {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.removeItem('melinotepad_data_v1'));
    await page.reload();
    await page.locator('[data-abrir-modulo="nex"]').click();
    await page.locator('#summary-nex-operacao').click();
    await page.setInputFiles('#nex-arquivo-planilha', {
      name: 'rotas-edicao.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Tipos de serviços,ID Otimizado,Quantidade de sacas,Pacotes estimados\nHYBRID,J1,3,3\nHYBRID,K1,2,2\n')
    });
    await page.waitForFunction(() => document.getElementById('nex-importacao-resumo').textContent.includes('2 rota'));
    await page.locator('#form-iniciar-sessao button[type=submit]').click();
    await page.waitForSelector('#nex-abas-principais:not([hidden])');
    await page.click('#nex-tab-btn-gaiolas');
    const primeiraRota = page.locator('#nex-lista-rotas .nex-rota-card').first();
    await primeiraRota.locator('.nex-rota-toggle').click();
    await page.locator('#nex-lista-rotas .nex-saca-numero').nth(1).click();
    await page.setViewportSize({ width: 375, height: 812 });
    const colunasAcoes = await page.locator('.nex-saca-dialog[open] .nex-saca-acoes').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.strictEqual(colunasAcoes, 1, 'as ações do card devem empilhar em telas estreitas');
    assert.strictEqual(await page.locator('.nex-saca-dialog .nex-editar-saca').first().innerText(), 'Editar numera\u00e7\u00e3o');
    respostas.push('Ana');
    await page.locator('.nex-saca-dialog[open] .nex-saca-item').getByRole('button', { name: 'Auditar saca' }).click();
    await page.locator('#nex-lista-rotas .nex-saca-numero').nth(1).click();
    respostas.push('5', '');
    await page.locator('.nex-saca-dialog[open] .nex-editar-saca').click();
    const dados = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('melinotepad_data_v1')).currentSession;
      return s.rotasHybrid.map(r => ({ rota: r.rota, sacas: r.sacasIndividuais.map(x => ({ numero: x.numero, auditorias: x.auditorias })) }));
    });
    assert.deepStrictEqual(dados.map(r => r.sacas.map(s => s.numero)), [['1', '5', '6'], ['7', '8']], 'a saca editada e as seguintes devem manter sequência entre rotas');
    assert.strictEqual(dados[0].sacas[1].auditorias[0].auditor, 'Ana', 'a edição deve preservar auditorias vinculadas pelo ID da saca');
    assert.strictEqual(await page.locator('#nex-lista-rotas .nex-saca-numero').count(), 5);
    assert.deepStrictEqual(erros, [], 'não deve haver erros de JavaScript');
    console.log('OK - edição de saca no card, renumeração da sequência entre rotas e preservação das auditorias');
  } finally { await browser.close(); }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
