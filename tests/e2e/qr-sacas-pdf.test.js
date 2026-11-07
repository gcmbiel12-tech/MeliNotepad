const { chromium } = require('playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  try {
    await page.addInitScript(() => {
      localStorage.setItem('melinotepad_qr_sacas_v1', JSON.stringify({
        versao: 1,
        rotas: [
          {
            id: 'rota-r1',
            nome: 'R1',
            sacas: [{
              id: 'saca-21',
              numero: '21',
              payload: { container_id: 7000021, facility_id: 'SSC2', assignment: '21' }
            }]
          },
          {
            id: 'rota-r2',
            nome: 'R2',
            sacas: [{
              id: 'saca-22',
              numero: '22',
              payload: { container_id: 7000022, facility_id: 'SSC2', assignment: '22' }
            }]
          }
        ]
      }));
    });

    await page.goto(BASE);
    await page.locator('[data-abrir-modulo="qr-sacas"]').click();
    await page.locator('#qr-sacas-app').waitFor({ state: 'visible' });

    const copias = page.locator('.qr-sacas__controle-copias-global-valor');
    await copias.fill('6');
    await copias.dispatchEvent('change');

    await page.locator('.qr-sacas__rota-card .nex-rota-toggle').nth(0).click();
    await page.locator('.qr-sacas__rota-card .nex-rota-toggle').nth(1).click();
    await page.locator('.qr-sacas__saca-card .qr-sacas__selecao').nth(0).check();
    await page.locator('.qr-sacas__saca-card .qr-sacas__selecao').nth(1).check();

    await page.evaluate(() => {
      window.__qrPrintHtml = '';
      window.open = () => ({
        document: {
          open() {},
          write(html) { window.__qrPrintHtml = html; },
          close() {}
        }
      });
    });
    await page.locator('#qr-sacas-imprimir').click();
    await page.waitForFunction(() => window.__qrPrintHtml.includes('SACA 21') && window.__qrPrintHtml.includes('SACA 22'));

    const html = await page.evaluate(() => window.__qrPrintHtml);
    assert.equal((html.match(/class="etiqueta"/g) || []).length, 12, 'seis cópias por saca devem gerar doze etiquetas');
    assert.match(html, /<strong class="rota">R1<\/strong>[\s\S]*?<svg[\s\S]*?<strong class="numero">SACA 21<\/strong>/);
    assert.match(html, /<strong class="rota">R2<\/strong>[\s\S]*?<svg[\s\S]*?<strong class="numero">SACA 22<\/strong>/);
    assert.match(html, /@page\{size:A4;margin:2mm\}/);
    assert.match(html, /grid-template-columns:repeat\(2,100mm\)/);
    assert.match(html, /grid-auto-rows:144mm/);
    assert.match(html, /width:100mm;height:144mm/);
    assert.match(html, /width:88mm;height:88mm/);

    const paginaImpressao = await context.newPage();
    await paginaImpressao.goto(BASE);
    await paginaImpressao.setContent(html, { waitUntil: 'load' });
    await paginaImpressao.locator('.etiqueta svg').first().waitFor({ state: 'visible' });
    const pdf = await paginaImpressao.pdf({ format: 'A4', printBackground: true });
    assert.ok(pdf.length > 3000, 'o PDF gerado deve conter conteúdo');
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-', 'a saída deve ser um PDF válido');

    const leituraPDF = await paginaImpressao.evaluate(async bytes => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
      const documento = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      const textos = [];
      for (let numero = 1; numero <= documento.numPages; numero++) {
        const pagina = await documento.getPage(numero);
        const texto = await pagina.getTextContent();
        textos.push(texto.items.map(item => item.str).join(' '));
      }
      const resultado = { paginas: documento.numPages, textos, texto: textos.join(' ') };
      await documento.destroy();
      return resultado;
    }, Array.from(pdf));

    assert.equal(leituraPDF.paginas, 3, 'doze etiquetas de 100 x 144 mm devem ser distribuídas em três folhas A4, quatro por folha');
    assert.equal((leituraPDF.texto.match(/SACA 21/g) || []).length, 6, 'as seis cópias da primeira saca devem estar no PDF');
    assert.equal((leituraPDF.texto.match(/SACA 22/g) || []).length, 6, 'as seis cópias da segunda saca devem estar no PDF');
    assert.equal((leituraPDF.textos[0].match(/SACA 21/g) || []).length, 4, 'a primeira folha deve conter quatro etiquetas R1');
    assert.equal((leituraPDF.textos[1].match(/SACA 21/g) || []).length, 2, 'a segunda folha deve conter duas etiquetas R1');
    assert.equal((leituraPDF.textos[1].match(/SACA 22/g) || []).length, 2, 'a segunda folha deve conter duas etiquetas R2');
    assert.equal((leituraPDF.textos[2].match(/SACA 22/g) || []).length, 4, 'a terceira folha deve conter quatro etiquetas R2');
    
    
    assert.match(leituraPDF.texto, /R1/);
    assert.match(leituraPDF.texto, /R2/);

    await page.evaluate(() => { window.__qrPrintHtml = ''; });
    await page.waitForTimeout(1600);
    await page.locator('#qr-sacas-imprimir-zebra').evaluate(element => element.click());
    await page.waitForTimeout(500);
    const htmlZebra = await page.evaluate(() => window.__qrPrintHtml);
    assert.ok(htmlZebra.includes('class="face face-qr"'), 'a impressão Zebra deve gerar HTML com a face do QR Code');
    assert.equal((htmlZebra.match(/class="etiqueta"/g) || []).length, 12, 'cada cópia deve gerar uma etiqueta Zebra');
    assert.ok(htmlZebra.includes('@page{size:100mm 150mm;margin:0}'));
    assert.ok(htmlZebra.includes('grid-template-rows:75mm 75mm'));
    assert.ok(htmlZebra.includes('border-top:0.6mm dotted'));
    assert.ok(htmlZebra.includes('border:0.6mm solid #172033'));
    assert.ok(htmlZebra.includes('font-size:27pt'));
    assert.ok(htmlZebra.includes('transform:translate(-50%,-50%)'));
    assert.ok(htmlZebra.includes('class="marcador-dobra">DOBRA</'));
    assert.ok(htmlZebra.includes('width:64mm;height:64mm'));
    assert.ok(htmlZebra.includes('class="face face-info"><strong class="rota">R1</strong><strong class="numero">SACA 21</strong>'));

    const zebraPage = await context.newPage();
    await zebraPage.goto(BASE);
    await zebraPage.setContent(htmlZebra, { waitUntil: 'load' });
    const pdfZebra = await zebraPage.pdf({ width: '100mm', height: '150mm', printBackground: true });
    assert.ok(pdfZebra.length > 3000, 'o PDF Zebra deve conter conteúdo');
    const leituraZebra = await zebraPage.evaluate(async bytes => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
      const documento = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      const textos = [];
      for (let numero = 1; numero <= documento.numPages; numero++) {
        const pagina = await documento.getPage(numero);
        const texto = await pagina.getTextContent();
        textos.push(texto.items.map(item => item.str).join(' '));
      }
      const resultado = { paginas: documento.numPages, texto: textos.join(' ') };
      await documento.destroy();
      return resultado;
    }, Array.from(pdfZebra));
    assert.equal(leituraZebra.paginas, 12, 'cada etiqueta Zebra deve ocupar uma página de 100 x 150 mm');
    assert.equal((leituraZebra.texto.match(/SACA 21/g) || []).length, 6);
    assert.equal((leituraZebra.texto.match(/SACA 22/g) || []).length, 6);
    await zebraPage.close();

    await page.waitForTimeout(1600);
    const copiasSeguranca = page.locator('.qr-sacas__controle-copias-global-valor');
    await copiasSeguranca.fill('1001');
    await copiasSeguranca.dispatchEvent('change');
    await page.evaluate(() => { window.__qrPrintHtml = ''; });
    await page.locator('#qr-sacas-imprimir').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__qrPrintHtml), '', 'trabalhos acima de 2.000 etiquetas devem ser bloqueados antes de abrir a impressao');

    // Falhas operacionais: nenhuma delas pode apagar a seleção atual.
    await copias.fill('6');
    await copias.dispatchEvent('change');
    await page.waitForTimeout(1600);

    // Popup bloqueado pelo navegador.
    await page.evaluate(() => {
      window.__qrOpenCalls = 0;
      window.open = () => { window.__qrOpenCalls++; return null; };
    });
    await page.locator('#qr-sacas-imprimir-zebra').click();
    await page.waitForFunction(() => document.body.innerText.includes('Permita pop-ups'));
    assert.equal(await page.evaluate(() => window.__qrOpenCalls), 1, 'a tentativa deve detectar o popup bloqueado');
    assert.equal(await page.locator('#qr-sacas-selecao-resumo').innerText(), '2 sacas selecionadas');
    assert.equal(await page.locator('.qr-sacas__saca-card .qr-sacas__selecao:checked').count(), 2,
      'a seleção deve permanecer após popup bloqueado');

    // Gerador ausente: bloquear antes de abrir a janela.
    await page.evaluate(() => {
      window.__qrOpenCalls = 0;
      window.qrcode = undefined;
    });
    await page.locator('#qr-sacas-imprimir-zebra').click();
    await page.waitForFunction(() => document.body.innerText.includes('gerador de QR Code'));
    assert.equal(await page.evaluate(() => window.__qrOpenCalls), 0, 'sem gerador QR, nenhuma janela deve ser aberta');
    assert.equal(await page.locator('#qr-sacas-selecao-resumo').innerText(), '2 sacas selecionadas');
    assert.equal(await page.locator('.qr-sacas__saca-card .qr-sacas__selecao:checked').count(), 2);

    // Erro durante a geração: fechar a janela parcial e nunca chamar print.
    await page.evaluate(() => {
      window.__qrWindowState = { closed: false, writes: 0 };
      window.open = () => ({
        document: {
          open() {},
          write() { window.__qrWindowState.writes++; },
          close() {}
        },
        close() { window.__qrWindowState.closed = true; }
      });
      window.qrcode = () => ({
        addData() { throw new Error('falha simulada do gerador'); },
        make() {},
        createSvgTag() { return '<svg></svg>'; }
      });
    });
    await page.locator('#qr-sacas-imprimir-zebra').click();
    await page.waitForFunction(() => document.body.innerText.includes('falha simulada do gerador'));
    const falhaGeracao = await page.evaluate(() => window.__qrWindowState);
    assert.equal(falhaGeracao.closed, true, 'a janela parcial deve ser fechada após erro de geração');
    assert.equal(falhaGeracao.writes, 0, 'HTML parcial não deve ser enviado à janela');
    assert.equal(await page.locator('#qr-sacas-selecao-resumo').innerText(), '2 sacas selecionadas');
    assert.equal(await page.locator('.qr-sacas__saca-card .qr-sacas__selecao:checked').count(), 2,
      'a seleção deve permanecer após falha do gerador');
    assert.deepEqual(errors, []);
    console.log('PASS QR Sacas PDF: A4 com quatro etiquetas por folha e Zebra 100 x 150 mm com duas faces e dobra central validadas.');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
