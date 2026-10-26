const { chromium } = require('playwright');
const assert = require('assert');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8000') + '/index.html';
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1280];

(async () => {
  const browser = await chromium.launch();
  const failures = [];
  const errors = [];
  try {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        isMobile: width < 500,
        serviceWorkers: 'block'
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(width + 'px: ' + e.message));
      await page.addInitScript(() => {
        window.MeliNotepadConfig = {
          supabaseUrl: 'https://project.example',
          supabaseAnonKey: 'public-test-key'
        };
        window.fetch = async () => new Response(JSON.stringify({ message: 'not expected before login' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      });
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        loginVisible: !document.querySelector('#auth-panel').hidden
      }));
      if (metrics.document > metrics.viewport || metrics.body > metrics.viewport || !metrics.loginVisible) {
        failures.push(width + 'px: ' + JSON.stringify(metrics));
      }
      await context.close();
    }
    assert.deepStrictEqual(errors, [], 'sem erros JavaScript no layout de autenticação');
    assert.deepStrictEqual(failures, [], failures.join('\n') || 'layout de autenticação sem overflow');
    console.log('PASS auth responsive E2E: tela de login em 7 larguras (320–1280 px), sem overflow horizontal.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
