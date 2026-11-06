const { chromium } = require('playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.MeliNotepadConfig = { supabaseUrl: '', supabaseAnonKey: '' };
    window.__capturasXpt = 0;
    window.BarcodeDetector = class {
      static async getSupportedFormats() { return ['qr_code', 'code_128']; }
      async detect() {
        window.__capturasXpt++;
        return [{ rawValue: '{"id":"XPT-000123","t":"lm"}', format: 'qr_code' }];
      }
    };
  });

  await page.goto(BASE);
  await page.locator('[data-abrir-modulo="xpt"]').click();
  await page.locator('#summary-xpt-operacoes').click();
  await page.locator('#xo-nova').click();
  await page.locator('dialog[open] #xh-ok').click();
  await page.locator('button[data-aba="gaiolas"]').click();
  await page.locator('#xg-adicionar').click();
  await page.locator('dialog[open] #xc-texto').fill('1001');
  await page.locator('dialog[open] #xc-ok').click();
  await page.locator('button[data-aba="ocorrencias"]').click();
  await page.locator('#xoc-abrir-camera').waitFor({ state: 'visible' });
  await page.locator('#xoc-abrir-camera').click();
  await page.waitForFunction(() => {
    const v = document.getElementById('xoc-video');
    return v && !v.hidden && v.readyState >= 2 && v.videoWidth > 0;
  }, null, { timeout: 7000 });
  await page.waitForTimeout(500);
  assert.strictEqual(await page.evaluate(() => window.__capturasXpt), 0, 'XPT não deve detectar automaticamente');
  assert.strictEqual(await page.locator('#xoc-produto').inputValue(), '');
  assert.strictEqual(await page.locator('#xoc-area-camera .scanner-moldura').count(), 1);
  await page.locator('#xoc-capturar-camera').click();
  await page.waitForFunction(() => document.getElementById('xoc-produto').value === 'XPT-000123');
  assert.strictEqual(await page.evaluate(() => window.__capturasXpt), 1);
  assert.match(await page.locator('#xoc-aviso-camera').innerText(), /Código capturado/);

  await page.locator('#xoc-categoria').selectOption({ index: 1 });
  await page.locator('#xoc-encontrada').selectOption('1001');
  await page.locator('#xoc-pessoa').fill('Teste XPT');
  await page.evaluate(() => window.scrollTo(0, 40));
  const scrollAntes = await page.evaluate(() => window.scrollY);
  await page.locator('#xoc-form').evaluate(form => form.requestSubmit());
  await page.waitForSelector('#xo-ocorrencias .xpt-ocorrencia');
  await page.waitForTimeout(100);
  const scrollDepois = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(scrollDepois - scrollAntes) <= 2, 'XPT alterou a rolagem de ' + scrollAntes + ' para ' + scrollDepois);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS XPT: câmera em visualização, sem leitura automática e captura manual de QR.');
})().catch(e => { console.error(e); process.exit(1); });
