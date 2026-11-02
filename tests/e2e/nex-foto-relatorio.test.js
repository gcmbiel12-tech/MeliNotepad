const { chromium } = require('../node_modules/playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  try {
    await page.goto(BASE);
    await page.evaluate(() => { Object.keys(localStorage).filter(k => k.startsWith('melinotepad_')).forEach(k => localStorage.removeItem(k)); });
    await page.reload();
    await page.locator('[data-abrir-modulo="nex"]').click();
    await page.locator('#summary-nex-operacao').click();
    await page.fill('#input-sacas', '1'); await page.fill('#input-pacotes', '1');
    await page.locator('#form-iniciar-sessao button[type=submit]').click();
    await page.locator('#nav-voltar-app').click();
    await page.locator('[data-abrir-modulo="nex"]').click();
    await page.locator('#summary-nex-abrir-operacao').click();
    await page.locator('#nex-tab-btn-ocorrencias').click();

    await page.locator('#btn-foto-ocorrencia').click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
    await page.locator('#input-foto-ocorrencia').setInputFiles({ name: 'evidencia.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => document.getElementById('status-foto-ocorrencia').textContent.includes('Foto anexada'));

    await page.fill('#input-codigo', 'PROD-OCORRENCIA-01');
    await page.selectOption('#select-categoria', 'avariados');
    await page.fill('#input-tipo-produto', 'Eletrônico');
    await page.fill('#input-rota-ocorrencia', 'M2');
    await page.fill('#input-saca-ocorrencia', '15');
    await page.fill('#select-gaiola-encontrada', 'G-10');
    await page.fill('#input-gaiola-correta', 'G-12');
    await page.fill('#input-encontrado-por', 'Carlos');
    await page.fill('#input-observacao', 'Embalagem molhada');
    await page.check('#grupo-status-ocorrencia input[value=pendente]');
    await page.locator('#form-registrar-ocorrencia button[type=submit]').click();
    await page.waitForFunction(() => document.getElementById('contagem-total').textContent === '1');

    const salvo = await page.evaluate(async () => {
      const d = JSON.parse(localStorage.getItem('melinotepad_data_v1'));
      const o = d.currentSession.occurrences[0];
      const foto = await new Promise(resolve => { const r = indexedDB.open('melinotepad_fotos_v1'); r.onsuccess = () => { const q = r.result.transaction('fotos').objectStore('fotos').get(o.fotoId); q.onsuccess = () => resolve(!!(q.result && q.result.blob)); }; r.onerror = () => resolve(false); });
      return { o, foto };
    });
    assert.ok(salvo.o.fotoId, 'foto deve ficar vinculada à ocorrência');
    assert.equal(await salvo.foto, true, 'imagem deve estar persistida no IndexedDB');
    assert.equal(salvo.o.rota, 'M2'); assert.equal(salvo.o.saca, '15');

    await page.locator('#nex-tab-btn-relatorios').click();
    await page.locator('#btn-pre-visualizar').click();
    const texto = await page.locator('#texto-relatorio').innerText();
    ['PROD-OCORRENCIA-01', 'Tipo do produto: Eletrônico', 'Rota: M2', 'Saca: 15', 'Gaiola encontrada: G-10', 'Gaiola correta: G-12', 'Encontrado por: Carlos', 'Observações: Embalagem molhada', 'Foto da ocorrência anexada'].forEach(v => assert.ok(texto.includes(v), 'relatório sem: ' + v));
    assert.ok(!texto.includes('Nex Finalizado'), 'rodapé removido');
    assert.deepEqual(errors, [], 'sem erros JavaScript');
    console.log('PASS E2E ocorrência NEX: captura de foto, persistência IndexedDB e detalhamento do relatório.');
  } finally { await context.close(); await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
