const { chromium } = require('../node_modules/playwright');
const assert = require('assert');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));

  try {
    await page.goto(BASE);
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter(key => key.startsWith('melinotepad_'))
        .forEach(key => localStorage.removeItem(key));
    });
    await page.reload();

    await page.locator('[data-abrir-modulo="nex"]').click();
    await page.locator('#summary-nex-operacao').click();
    await page.fill('#input-sacas', '7');
    await page.fill('#input-pacotes', '14');
    await page.locator('#form-iniciar-sessao button[type=submit]').click();

    // Reabre o módulo pela navegação principal para acessar as abas da sessão ativa.
    await page.locator('#nav-voltar-app').click();
    await page.locator('[data-abrir-modulo="nex"]').click();
    await page.locator('#summary-nex-abrir-operacao').click();
    await page.locator('#nex-tab-btn-relatorios').click();

    assert.equal(await page.locator('#btn-cancelar-operacao').count(), 1,
      'o botão de cancelamento deve aparecer nos relatórios da operação ativa');
    await page.locator('#btn-cancelar-operacao').click();
    await page.waitForSelector('#modal-confirmar[open]');
    assert.match(await page.locator('#modal-confirmar-mensagem').innerText(), /CANCELADA/,
      'a confirmação deve informar que a operação será preservada como cancelada');
    await page.locator('#modal-confirmar-ok').click();
    await page.waitForFunction(() => document.getElementById('view-historico').hidden === false);

    assert.equal(await page.locator('#lista-historico .item-historico').count(), 1,
      'a operação cancelada deve aparecer no histórico');
    assert.match(await page.locator('#lista-historico').innerText(), /CANCELADA/);
    assert.match(await page.locator('#detalhe-historico-info').innerText(), /Cancelada/);

    const data = await page.evaluate(() => JSON.parse(localStorage.getItem('melinotepad_data_v1')));
    const cancelada = data.history.find(session => session.status === 'cancelada');
    assert.equal(data.currentSession, null, 'o cancelamento deve encerrar a sessão ativa');
    assert.ok(cancelada, 'a sessão cancelada deve ser preservada');
    assert.equal(cancelada.sacas, 7, 'a quantidade de sacas deve ser preservada');
    assert.equal(cancelada.pacotes, 14, 'a quantidade de pacotes deve ser preservada');
    assert.deepEqual(errors, [], 'a navegação e o cancelamento não devem gerar erros JavaScript');

    console.log('PASS E2E cancelamento NEX: confirmação, encerramento, histórico e preservação dos dados.');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
