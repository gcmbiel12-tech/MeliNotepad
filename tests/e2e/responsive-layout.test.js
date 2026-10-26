const { chromium } = require('playwright');
const assert = require('assert');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8000') + '/index.html';
const VIEWPORTS = [320, 360, 390, 430, 768, 1024, 1280, 1440];
const MODULES = [
  { id: 'nex', label: 'NEX' },
  { id: 'xpt', label: 'XPT' },
  { id: 'intervalos', label: 'Intervalos' }
];

(async () => {
  const browser = await chromium.launch();
  const failures = [];
  const pageErrors = [];

  try {
    for (const width of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        locale: 'pt-BR',
        isMobile: width < 500,
        deviceScaleFactor: 1
      });
      const page = await context.newPage();
      page.on('pageerror', error => pageErrors.push(`${width}px: ${error.message}`));
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });

      for (const module of MODULES) {
        if (module.id !== 'nex') {
          await page.locator(`button[data-modulo="${module.id}"]`).click();
        }

        const layout = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth
        }));

        if (layout.document > layout.viewport || layout.body > layout.viewport) {
          failures.push(
            `${width}px / ${module.label}: overflow horizontal (viewport=${layout.viewport}, document=${layout.document}, body=${layout.body})`
          );
        }
      }

      await context.close();
    }

    assert.deepStrictEqual(pageErrors, [], 'não deve haver erros JavaScript durante a navegação responsiva');
    assert.deepStrictEqual(failures, [], failures.join('\n') || 'layout responsivo sem overflow horizontal');

    console.log(`PASS responsive E2E: ${VIEWPORTS.length} larguras × ${MODULES.length} módulos, sem overflow horizontal nem erros JavaScript.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
