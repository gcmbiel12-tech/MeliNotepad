// QR pelo scanner REAL do projeto (scanner.js + app.js), com BarcodeDetector simulado e câmera falsa do Chromium.
const { chromium } = require('playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';
let passos = 0, falhas = 0;
async function etapa(d, fn) { try { await fn(); passos++; console.log('OK  -', d); } catch (e) { falhas++; console.log('FAIL -', d, '=>', String(e.message || e).split('\n')[0]); } }

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ permissions: ['camera'] });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.MeliNotepadConfig = { supabaseUrl: '', supabaseAnonKey: '' }; });
  const erros = []; page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); }); page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => {
    window.__fila = [];
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['qr_code', 'code_128', 'ean_13']; } constructor() {} async detect() { return window.__fila.length ? [{ rawValue: window.__fila.shift(), format: 'qr_code' }] : []; } };
  });
  await page.goto(BASE);
  await page.fill('#input-sacas', '1'); await page.fill('#input-pacotes', '1');
  await page.click('#form-iniciar-sessao button[type=submit]');
  await page.click('#nex-tab-btn-ocorrencias');
  await page.waitForSelector('#painel-sessao-ativa:not([hidden])');

  async function ler(raw) {
    await page.fill('#input-codigo', '');
    await page.click('#btn-abrir-camera');
    await page.waitForFunction(() => !document.getElementById('video-camera').hidden, null, { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.evaluate(r => window.__fila.push(r), raw);
  }
  await etapa('JSON de exemplo -> só o id "48197332782"', async () => {
    await ler('{"id":"48197332782","t":"lm"}');
    await page.waitForFunction(() => document.getElementById('input-codigo').value === '48197332782', null, { timeout: 5000 });
    assert.ok((await page.textContent('#aviso-camera')).includes('Código lido'));
    assert.strictEqual(await page.isVisible('#video-camera'), false, 'câmera fecha após leitura válida');
  });
  await etapa('código numérico simples continua aceito', async () => {
    await ler('12345678');
    await page.waitForFunction(() => document.getElementById('input-codigo').value === '12345678', null, { timeout: 5000 });
  });
  await etapa('zeros à esquerda preservados (JSON e direto)', async () => {
    await ler('{"id":"000123","t":"lm"}');
    await page.waitForFunction(() => document.getElementById('input-codigo').value === '000123', null, { timeout: 5000 });
    await ler('0004455');
    await page.waitForFunction(() => document.getElementById('input-codigo').value === '0004455', null, { timeout: 5000 });
  });
  await etapa('JSON sem "id" e conteúdo inválido: avisa, não preenche e mantém a câmera aberta para nova leitura', async () => {
    await ler('{"t":"lm"}');
    await page.waitForFunction(() => document.getElementById('aviso-camera').textContent.includes('Código não reconhecido'), null, { timeout: 5000 });
    assert.strictEqual(await page.inputValue('#input-codigo'), '');
    assert.strictEqual(await page.isVisible('#video-camera'), true);
    await page.evaluate(() => { document.getElementById('aviso-camera').textContent = ''; window.__fila.push('{"id":'); });
    await page.waitForFunction(() => document.getElementById('aviso-camera').textContent.includes('Código não reconhecido'), null, { timeout: 5000 });
    assert.strictEqual(await page.inputValue('#input-codigo'), '', 'nada foi preenchido');
    await page.evaluate(() => window.__fila.push('{"id":"777","t":"lm"}'));
    await page.waitForFunction(() => document.getElementById('input-codigo').value === '777', null, { timeout: 5000 });
  });
  await etapa('registrar com o código lido: a lista mostra o id, não o JSON', async () => {
    await page.selectOption('#select-categoria', 'avariados'); await page.check('#grupo-status-ocorrencia input[value=pendente]');
    await page.click('#form-registrar-ocorrencia button[type=submit]');
    await page.waitForSelector('.item-ocorrencia__codigo');
    assert.strictEqual(await page.textContent('.item-ocorrencia__codigo'), '777');
  });
  await etapa('JSON colado/digitado no campo também é convertido; JSON inválido é recusado sem registrar', async () => {
    await page.fill('#input-codigo', '{"id":"0099","t":"lm"}'); await page.selectOption('#select-categoria', 'avariados'); await page.check('#grupo-status-ocorrencia input[value=resolvido]');
    await page.click('#form-registrar-ocorrencia button[type=submit]');
    await page.waitForFunction(() => document.getElementById('contagem-total').textContent === '2');
    assert.ok((await page.$$eval('.item-ocorrencia__codigo', e => e.map(x => x.textContent))).includes('0099'));
    await page.fill('#input-codigo', '{"id":'); await page.selectOption('#select-categoria', 'avariados'); await page.check('#grupo-status-ocorrencia input[value=pendente]');
    await page.click('#form-registrar-ocorrencia button[type=submit]');
    await page.waitForFunction(() => document.getElementById('toast-container').textContent.includes('Código não reconhecido'));
    assert.strictEqual(await page.textContent('#contagem-total'), '2', 'nada registrado');
  });
  await etapa('nenhum erro de console', async () => { assert.strictEqual(erros.length, 0, JSON.stringify(erros)); });
  await b.close();
  console.log('\n--- RESULTADO (QR pelo scanner) ---\n' + passos + ' passos OK, ' + falhas + ' falha(s).'); process.exit(falhas ? 1 : 0);
})();
