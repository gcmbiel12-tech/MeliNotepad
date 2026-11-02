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
    await page.evaluate(() => {
      const api = window.MeliNotepad.NexOperations;
      api.addRoute('M2');
      api.addSaca('M2', '15');
      const saca = api.getCurrentSession().rotasHybrid.find(r => r.rota === 'M2').sacasIndividuais[0];
      api.auditSaca('M2', saca.id, 'Ana', 'concluida', '');
    });
    await page.locator('#nex-tab-btn-ocorrencias').click();

    await page.locator('#btn-foto-ocorrencia').click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
    await page.locator('#input-foto-ocorrencia').setInputFiles({ name: 'evidencia.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => document.getElementById('status-foto-ocorrencia').textContent.includes('Foto anexada'));

    await page.fill('#input-codigo', 'PROD-OCORRENCIA-01');
    await page.selectOption('#select-categoria', 'avariados');
    await page.fill('#input-tipo-produto', 'Eletrônico');
    await page.selectOption('#input-rota-ocorrencia', 'M2');
    await page.selectOption('#input-saca-ocorrencia', { label: '15' });
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
    assert.ok(salvo.o.sacaId, 'ocorrência deve manter vínculo com o ID da saca cadastrada');

    await page.locator('#nex-tab-btn-relatorios').click();
    await page.locator('#btn-pre-visualizar').click();
    const texto = await page.locator('#texto-relatorio').innerText();
    const statusEstruturado = await page.evaluate(() => window.MeliNotepad.Report.montarDadosCompletos(window.MeliNotepad.NexOperations.getCurrentSession()).rotasHybrid[0].sacasIndividuais[0].status);
    assert.equal(statusEstruturado, 'Auditada com ocorrência', 'relatório estruturado deve usar o mesmo status');
    ['PROD-OCORRENCIA-01', 'Tipo do produto: Eletrônico', 'Rota: M2', 'Saca: 15', 'Gaiola correta: G-12', 'Encontrado por: Carlos', 'Observações: Embalagem molhada', 'Foto da ocorrência anexada', '1/1 auditada(s) · 1 com divergência', 'Rota M2 · Saca 15 — Auditada com ocorrência'].forEach(v => assert.ok(texto.includes(v), 'relatório sem: ' + v));
    assert.ok(!texto.includes('Gaiola encontrada'), 'campo Gaiola encontrada deve ser removido do relatório');
    assert.ok(!texto.includes('Nex Finalizado'), 'rodapé removido');

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const botoesRelatorio = page.locator('#painel-relatorio .nex-acoes-relatorio button');
    assert.equal(await botoesRelatorio.count(), 3, 'devem existir três ações independentes de relatório');
    assert.equal(await botoesRelatorio.nth(0).innerText(), 'Copiar resumo');
    assert.equal(await botoesRelatorio.nth(1).innerText(), 'Copiar Relatório Completo');
    assert.equal(await botoesRelatorio.nth(2).innerText(), 'Preparar relatório PDF');

    await botoesRelatorio.nth(0).click();
    const resumo = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(resumo.includes('🛒 *Auditoria das sacas cadastradas*'), resumo);
    assert.ok(resumo.includes('Rota M2 · Saca 15 — Auditada com ocorrência'), resumo);
    assert.ok(!resumo.includes('PROD-OCORRENCIA-01'), 'resumo não deve detalhar ocorrências');
    assert.ok(!resumo.includes('Não realizada'), 'resumo não deve listar sacas não realizadas');

    await botoesRelatorio.nth(1).click();
    const completoCopiado = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(completoCopiado.includes('PROD-OCORRENCIA-01'), 'cópia completa mantém detalhes da ocorrência');
    assert.ok(completoCopiado.includes('1/1 auditada(s) · 1 com divergência'), 'cópia completa mantém contagem');

    await page.evaluate(() => {
      window.MeliNotepad.Impressao.imprimir = function (titulo, construir) {
        const raiz = document.createElement('div');
        const h = (tag, attrs) => { const el = document.createElement(tag); if (attrs.text) el.textContent = attrs.text; return el; };
        construir(raiz, h);
        window.__pdfTextoPreparado = raiz.textContent;
        return Promise.resolve();
      };
    });
    await botoesRelatorio.nth(2).click();
    const pdfTexto = await page.evaluate(() => window.__pdfTextoPreparado);
    assert.ok(pdfTexto.includes('PROD-OCORRENCIA-01'), 'PDF continua usando o relatório completo');
    assert.deepEqual(errors, [], 'sem erros JavaScript');
    console.log('PASS E2E ocorrência NEX: captura de foto, persistência IndexedDB e detalhamento do relatório.');
  } finally { await context.close(); await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
