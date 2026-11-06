// Captura manual de QR/barcodes pelo scanner do projeto, com câmera e BarcodeDetector simulados.
const { chromium } = require('playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';
let passos = 0, falhas = 0;
async function etapa(d, fn) {
  try { await fn(); passos++; console.log('OK  -', d); }
  catch (e) { falhas++; console.log('FAIL -', d, '=>', String(e.message || e).split('\n')[0]); }
}

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ permissions: ['camera'], serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.MeliNotepadConfig = { supabaseUrl: '', supabaseAnonKey: '' }; });
  const erros = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => {
    window.__fila = [];
    window.__capturas = 0;
    window.BarcodeDetector = class {
      static async getSupportedFormats() { return ['qr_code', 'code_128', 'ean_13']; }
      constructor() {}
      async detect() {
        window.__capturas++;
        return window.__fila.length ? [{ rawValue: window.__fila.shift(), format: 'qr_code' }] : [];
      }
    };
  });
  await page.goto(BASE);
  await page.locator('[data-abrir-modulo="nex"]').click();
  await page.locator('#summary-nex-operacao').click();
  await page.fill('#input-sacas', '1');
  await page.fill('#input-pacotes', '1');
  await page.click('#form-iniciar-sessao button[type=submit]');
  await page.click('#nex-tab-btn-ocorrencias');
  await page.waitForSelector('#painel-sessao-ativa:not([hidden])');

  async function abrirCamera() {
    await page.click('#btn-abrir-camera');
    await page.waitForFunction(() => {
      const v = document.getElementById('video-camera');
      return !v.hidden && v.readyState >= 2 && v.videoWidth > 0;
    }, null, { timeout: 7000 });
  }
  async function prepararCaptura(raw) {
    await page.evaluate(r => window.__fila.push(r), raw);
    await page.click('#btn-capturar-camera');
  }

  await etapa('a câmera abre em modo de visualização e não lê automaticamente', async () => {
    await abrirCamera();
    await page.waitForTimeout(700);
    assert.strictEqual(await page.evaluate(() => window.__capturas), 0, 'nenhuma análise antes do botão');
    assert.strictEqual(await page.inputValue('#input-codigo'), '');
    assert.strictEqual(await page.isVisible('.scanner-moldura'), true);
    assert.ok((await page.textContent('.scanner-instrucao')).includes('dentro da área'));
    assert.strictEqual(await page.isVisible('#btn-capturar-camera'), true);
  });

  await etapa('captura manual de JSON -> somente o identificador', async () => {
    await prepararCaptura('{"id":"48197332782","t":"lm"}');
    await page.waitForFunction(() => document.getElementById('input-codigo').value === '48197332782');
    assert.ok((await page.textContent('#aviso-camera')).includes('Código capturado'));
    assert.strictEqual(await page.isVisible('#video-camera'), false, 'câmera fecha após captura válida');
    assert.strictEqual(await page.evaluate(() => window.__capturas), 1);
  });

  await etapa('captura manual preserva códigos numéricos e zeros à esquerda', async () => {
    await page.fill('#input-codigo', '');
    await abrirCamera();
    await prepararCaptura('0004455');
    await page.waitForFunction(() => document.getElementById('input-codigo').value === '0004455');
    assert.strictEqual(await page.evaluate(() => window.__capturas), 2);
  });

  await etapa('código inválido não preenche o campo e permite nova captura', async () => {
    await page.fill('#input-codigo', '');
    await abrirCamera();
    await prepararCaptura('{"t":"lm"}');
    await page.waitForFunction(() => document.getElementById('aviso-camera').textContent.includes('Código não reconhecido'));
    assert.strictEqual(await page.inputValue('#input-codigo'), '');
    assert.strictEqual(await page.isVisible('#video-camera'), true);
    assert.strictEqual(await page.isVisible('#btn-capturar-camera'), true);
    await prepararCaptura('{"id":"777","t":"lm"}');
    await page.waitForFunction(() => document.getElementById('input-codigo').value === '777');
  });

  await etapa('registrar com o código capturado mantém somente o identificador', async () => {
    await page.selectOption('#select-categoria', 'avariados');
    await page.check('#grupo-status-ocorrencia input[value=pendente]');
    await page.locator('#form-registrar-ocorrencia').evaluate(form => form.requestSubmit());
    await page.waitForSelector('.item-ocorrencia__codigo');
    assert.strictEqual(await page.textContent('.item-ocorrencia__codigo'), '777');
  });

  await etapa('manter posição de rolagem ao concluir uma ação', async () => {
    await page.fill('#input-codigo', '0099');
    await page.selectOption('#select-categoria', 'avariados');
    await page.check('#grupo-status-ocorrencia input[value=resolvido]');
    await page.evaluate(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.min(500, max));
    });
    const antes = await page.evaluate(() => window.scrollY);
    await page.locator('#form-registrar-ocorrencia').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => document.getElementById('contagem-total').textContent === '2');
    await page.waitForTimeout(100);
    const depois = await page.evaluate(() => window.scrollY);
    assert.ok(Math.abs(depois - antes) <= 2, 'rolagem mudou de ' + antes + ' para ' + depois);
  });

  await etapa('nenhum erro de console', async () => {
    assert.strictEqual(erros.length, 0, JSON.stringify(erros));
  });

  await b.close();
  console.log('\n--- RESULTADO (captura manual) ---\n' + passos + ' passos OK, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})();
