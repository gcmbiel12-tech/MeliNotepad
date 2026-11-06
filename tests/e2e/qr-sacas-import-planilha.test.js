const { chromium } = require('playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('Auditor teste');
    else if (dialog.message().includes('encontrou divergÃªncia')) await dialog.dismiss();
    else await dialog.accept();
  });
  try {
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.setItem('melinotepad_qr_sacas_v1', JSON.stringify({
        versao: 1,
        rotas: [{
          id: 'rota-legada',
          nome: 'ROTA_LEGADA',
          pacotesEstimados: 12,
          sacas: [{
            id: 'saca-legada',
            numero: '9',
            payload: null,
            auditorias: [{ id: 'auditoria-legada', status: 'concluida', auditor: 'Teste' }]
          }]
        }]
      }));
    });
    await page.reload();
    const dadosLegados = await page.evaluate(() => JSON.parse(localStorage.getItem('melinotepad_qr_sacas_v1')));
    assert.equal(Object.prototype.hasOwnProperty.call(dadosLegados.rotas[0], 'pacotesEstimados'), false, 'metadados de pacotes antigos devem ser removidos');
    assert.equal(Object.prototype.hasOwnProperty.call(dadosLegados.rotas[0].sacas[0], 'auditorias'), false, 'historico antigo de auditoria deve ser removido');
    await page.evaluate(() => localStorage.removeItem('melinotepad_qr_sacas_v1'));
    await page.reload();
    await page.locator('[data-abrir-modulo="qr-sacas"]').click();
    assert.equal(await page.locator('#qr-sacas-app').isVisible(), true);
    assert.equal(await page.locator('.qr-sacas__importacao .nex-importacao__area').count(), 1);
    const csv = [
      'Tipos de servi\u00e7os,ID Otimizado,Quantidade de sacas,Pacotes estimados',
      'HYBRID,ROTA_A_AM1,10,120',
      'HYBRID,ROTA_B_AM1,8,95',
      'STANDARD,ROTA_C_AM1,99,999'
    ].join('\n');
    await page.locator('#qr-sacas-arquivo').setInputFiles({
      name: 'optimization.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv)
    });
    await page.waitForFunction(() => {
      const el = document.getElementById('qr-sacas-status');
      return el && el.textContent.includes('Importa\u00e7\u00e3o conclu\u00edda');
    });
    const estado = await page.evaluate(() => JSON.parse(localStorage.getItem('melinotepad_qr_sacas_v1')));
    assert.deepEqual(estado.rotas.map(r => r.nome).sort(), ['ROTA_A', 'ROTA_B']);
    assert.deepEqual(estado.rotas.map(r => r.quantidadeSacas).sort((a,b) => a-b), [8, 10]);
    assert.ok(estado.rotas.every(r => !Object.prototype.hasOwnProperty.call(r, 'pacotesEstimados')), 'pacotes estimados nao devem ser armazenados no QR Sacas');
    const rotaA = estado.rotas.find(r => r.nome === 'ROTA_A');
    const rotaB = estado.rotas.find(r => r.nome === 'ROTA_B');
    assert.equal(rotaA.sacas.length, 10, 'a importaÃ§Ã£o deve criar as sacas individuais da primeira rota');
    assert.equal(rotaB.sacas.length, 8, 'a importaÃ§Ã£o deve criar as sacas individuais da segunda rota');
    assert.deepEqual(rotaA.sacas.map(s => s.numero), Array.from({ length: 10 }, (_, i) => String(i + 1)));
    assert.deepEqual(rotaB.sacas.map(s => s.numero), Array.from({ length: 8 }, (_, i) => String(i + 11)));
    assert.ok(estado.rotas.every(r => r.sacas.every(s => s.payload === null && !Object.prototype.hasOwnProperty.call(s, 'auditorias'))), 'cada saca deve iniciar sem payload inventado e sem dados de auditoria');
    await page.locator('.qr-sacas__rota-card .nex-rota-toggle').filter({ hasText: 'ROTA_A' }).click();
    assert.equal(await page.locator('.qr-sacas__rota-card').filter({ hasText: 'ROTA_A' }).locator('.qr-sacas__saca-card').count(), 10);
    assert.equal(await page.locator('.qr-sacas__dialogo-saca').count(), 0, 'o clique na saca nao deve abrir card de auditoria');
    assert.equal(await page.getByRole('button', { name: /Auditar saca|Realizar nova auditoria/i }).count(), 0, 'QR Sacas nao deve exibir acoes de auditoria');
    assert.equal(await page.locator('#qr-sacas-app').getByRole('button', { name: 'Selecionar Tudo', exact: true }).count(), 1);
    assert.equal(await page.locator('#qr-sacas-app').getByRole('button', { name: 'Deselecionar Tudo', exact: true }).count(), 1);
    const imprimir = page.locator('#qr-sacas-app').getByRole('button', { name: 'Imprimir', exact: true });
    assert.equal(await imprimir.isDisabled(), true, 'imprimir deve ficar desabilitado sem selecao');
    await page.locator('#qr-sacas-app').getByRole('button', { name: 'Selecionar Tudo', exact: true }).click();
    assert.equal(await page.locator('#qr-sacas-selecao-resumo').innerText(), '18 sacas selecionadas');
    assert.equal(await imprimir.isDisabled(), false);
    await page.locator('#qr-sacas-app').getByRole('button', { name: 'Deselecionar Tudo', exact: true }).click();
    assert.equal(await page.locator('#qr-sacas-selecao-resumo').innerText(), '0 sacas selecionadas');
    assert.equal(await imprimir.isDisabled(), true);
    await page.locator('.qr-sacas__saca-card .qr-sacas__selecao').first().check();
    assert.equal(await page.locator('#qr-sacas-selecao-resumo').innerText(), '1 saca selecionada');
    await page.evaluate(() => { window.__qrPrintOpened = false; window.open = () => { window.__qrPrintOpened = true; return null; }; });
    await imprimir.click();
    assert.equal(await page.evaluate(() => window.__qrPrintOpened), false, 'nao deve abrir impressao quando a saca nao possui payload QR');    await page.evaluate(() => {
      const estado = JSON.parse(localStorage.getItem('melinotepad_qr_sacas_v1'));
      const primeira = estado.rotas.find(r => r.nome === 'ROTA_A').sacas[0];
      primeira.payload = { container_id: 5938605, facility_id: 'SSC2', assignment: primeira.numero };
      localStorage.setItem('melinotepad_qr_sacas_v1', JSON.stringify(estado));
    });
    await page.reload();
    if (!(await page.locator('#qr-sacas-app').isVisible())) await page.locator('[data-abrir-modulo="qr-sacas"]').click();
    await page.locator('.qr-sacas__rota-card').filter({ hasText: 'ROTA_A' }).locator('.nex-rota-toggle').click();
    await page.locator('.qr-sacas__rota-card').filter({ hasText: 'ROTA_A' }).locator('.qr-sacas__selecao').first().check();
    await page.evaluate(() => {
      window.__qrPrintHtml = '';
      window.open = () => ({ document: { open() {}, write(html) { window.__qrPrintHtml = html; }, close() {} } });
    });
    await page.locator('#qr-sacas-app').getByRole('button', { name: 'Imprimir', exact: true }).click();
    await page.waitForFunction(() => window.__qrPrintHtml.includes('Saca 1'));
    assert.match(await page.evaluate(() => window.__qrPrintHtml), /<svg/);
    const textoRotas = await page.locator('.qr-sacas__lista-rotas').innerText();
    assert.doesNotMatch(textoRotas, /auditoria|pacotes?|pendentes?|ocorr[e?]ncias?/i, 'a lista deve exibir somente rotas e sacas');
    await page.setViewportSize({ width: 1440, height: 900 });
    const larguraPainelDesktop = await page.locator('#modulo-qr-sacas .qr-sacas__painel-rotas').evaluate(el => Math.round(el.getBoundingClientRect().width));
    assert.ok(larguraPainelDesktop > 1120, 'o painel de rotas deve aproveitar a largura maior no desktop: ' + larguraPainelDesktop + 'px');
    await page.setViewportSize({ width: 390, height: 844 });
    const dims = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    assert.ok(dims.scroll <= dims.width + 1, 'sem overflow horizontal no celular');
    assert.deepEqual(errors, []);
    console.log('PASS QR Sacas: importaÃ§Ã£o da planilha NEX, rotas HYBRID, quantidades e layout responsivo.');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
