const { chromium } = require('playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';

(async () => {
  const browser = await chromium.launch();
  const resultados = [];
  try {
    for (const largura of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width: largura, height: 900 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(BASE);
      await page.evaluate(() => localStorage.removeItem('melinotepad_data_v1'));
      await page.reload();
      await page.locator('[data-abrir-modulo="nex"]').click();
      await page.locator('#summary-nex-operacao').click();
      await page.setInputFiles('#nex-arquivo-planilha', {
        name: 'rotas-auditoria.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('Tipos de serviços,ID Otimizado,Quantidade de sacas,Pacotes estimados\nHYBRID,J1,102,20\nHYBRID,K2,10,8\n')
      });
      await page.waitForFunction(() => document.getElementById('nex-importacao-resumo').textContent.includes('2 rota'));
      await page.locator('#form-iniciar-sessao button[type=submit]').click();
      await page.waitForSelector('#nex-abas-principais:not([hidden])');
      await page.locator('#nex-tab-btn-gaiolas').click();
      const botao = page.locator('.nex-auditar-saca-rapido');
      assert.strictEqual(await botao.isVisible(), true);
      assert.strictEqual(await botao.isEnabled(), true);
      await botao.click();
      const dlg = page.locator('#nex-dialogo-operacao');
      await dlg.locator('input').nth(0).fill('103');
      assert.match(await dlg.locator('.nex-auditoria-rapida__valor').innerText(), /Saca: 103\s+·\s+Rota: K2/);
      await dlg.locator('input').nth(1).fill('Pessoa Teste');

      // Cancelar não deve gravar auditoria.
      await dlg.getByRole('button', { name: 'Cancelar' }).click();
      let sessao = await page.evaluate(() => JSON.parse(localStorage.getItem('melinotepad_data_v1')).currentSession);
      let saca103 = sessao.rotasHybrid.flatMap(r => (r.sacasIndividuais || []).map(s => ({ rota:r.rota, saca:s }))).find(x => x.saca.numero === '103');
      assert.strictEqual(saca103.rota, 'K2');
      assert.strictEqual((saca103.saca.auditorias || []).length, 0);

      // Número inexistente não permite confirmação.
      await botao.click();
      await dlg.locator('input').nth(0).fill('9999');
      assert.match(await dlg.locator('.nex-auditoria-rapida__valor').innerText(), /não encontrada/i);
      await dlg.locator('input').nth(1).fill('Pessoa Teste');
      await dlg.locator('button[type=submit]').click();
      assert.strictEqual(await dlg.isVisible(), true);
      assert.match(await dlg.locator('.nex-dialogo__erro').innerText(), /não foi possível identificar/i);
      await dlg.getByRole('button', { name: 'Cancelar' }).click();

      // Saca existente sem auditor não permite confirmar.
      await botao.click();
      await dlg.locator('input').nth(0).fill('103');
      await dlg.locator('button[type=submit]').click();
      assert.strictEqual(await dlg.isVisible(), true);
      assert.match(await dlg.locator('.nex-dialogo__erro').innerText(), /nome da pessoa/i);
      await dlg.getByRole('button', { name: 'Cancelar' }).click();

      // Fluxo confirmado grava auditoria na saca e rota corretas.
      await botao.click();
      await dlg.locator('input').nth(0).fill('103');
      await dlg.locator('input').nth(1).fill('Pessoa Teste');
      await dlg.locator('button[type=submit]').click();
      await page.waitForFunction(() => !document.getElementById('nex-dialogo-operacao'));
      sessao = await page.evaluate(() => JSON.parse(localStorage.getItem('melinotepad_data_v1')).currentSession);
      saca103 = sessao.rotasHybrid.flatMap(r => (r.sacasIndividuais || []).map(s => ({ rota:r.rota, saca:s }))).find(x => x.saca.numero === '103');
      assert.strictEqual(saca103.rota, 'K2');
      assert.strictEqual(saca103.saca.auditorias.length, 1);
      assert.strictEqual(saca103.saca.auditorias[0].auditor, 'Pessoa Teste');
      assert.strictEqual(saca103.saca.auditorias[0].status, 'concluida');
      assert.strictEqual(await page.locator('#nex-lista-rotas .nex-rota-card').filter({ hasText: 'K2' }).locator('.nex-rota-toggle').getAttribute('aria-expanded'), 'true');
      assert.deepStrictEqual(errors, []);
      resultados.push('PASS ' + largura + 'px: identificação automática da rota, validação, cancelamento e confirmação persistida');
      await context.close();
    }
    console.log(resultados.join('\n'));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
