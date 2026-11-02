const { chromium } = require('playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const answers = [];
  const errors = [];
  page.on('dialog', dialog => { if (answers.shift() === 'dismiss') dialog.dismiss(); else dialog.accept(); });
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.removeItem('melinotepad_data_v1'));
    await page.reload();
    await page.locator('[data-abrir-modulo="nex"]').click();
    await page.locator('#summary-nex-operacao').click();

    await page.setInputFiles('#nex-arquivo-planilha', {
      name: 'optimization-inicial.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from([
        'Tipos de serviços,ID Otimizado,Quantidade de sacas,Pacotes estimados',
        'HYBRID,M10_AM1,1,1',
        'HYBRID,N1_AM1,1,1',
        'HYBRID,M2_AM1,2,2',
        'HYBRID,M1_AM1,2,2'
      ].join('\n'))
    });
    await page.waitForFunction(() => document.getElementById('nex-importacao-resumo').textContent.includes('4 rota'));
    await page.click('#form-iniciar-sessao button[type=submit]');
    await page.waitForSelector('#nex-abas-principais:not([hidden])');

    const lerRotas = () => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('melinotepad_data_v1')).currentSession;
      return s.rotasHybrid.map(r => ({ rota: r.rota, numeros: (r.sacasIndividuais || []).map(x => x.numero) }));
    });
    assert.deepStrictEqual(await lerRotas(), [
      { rota: 'M10', numeros: ['5'] },
      { rota: 'N1', numeros: ['6'] },
      { rota: 'M2', numeros: ['3', '4'] },
      { rota: 'M1', numeros: ['1', '2'] }
    ], 'a sequência deve seguir a ordem natural M1, M2, M10, N1, independentemente da ordem na planilha');

    await page.evaluate(() => window.MeliNotepad.NexOperations.addSaca('M1', '99'));
    const antesCancelar = await lerRotas();
    answers.push('dismiss');
    await page.setInputFiles('#nex-arquivo-planilha-quantidades', {
      name: 'optimization-cancelada.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Tipos de serviços,ID Otimizado,Quantidade de sacas,Pacotes estimados\nHYBRID,M1_AM1,1,1\n')
    });
    await page.waitForFunction(() => document.getElementById('nex-arquivo-planilha-quantidades').value === '');
    assert.deepStrictEqual(await lerRotas(), antesCancelar, 'cancelar a confirmação deve preservar sacas e numeração atuais');

    answers.push('accept');
    await page.setInputFiles('#nex-arquivo-planilha-quantidades', {
      name: 'optimization-nova.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from([
        'Tipos de serviços,ID Otimizado,Quantidade de sacas,Pacotes estimados',
        'HYBRID,N1_AM1,1,1',
        'HYBRID,M2_AM1,1,1',
        'HYBRID,M1_AM1,2,2'
      ].join('\n'))
    });
    await page.waitForFunction(() => document.getElementById('nex-importacao-quantidades-estado').textContent.includes('Importação concluída'));
    assert.deepStrictEqual(await lerRotas(), [
      { rota: 'M10', numeros: [] },
      { rota: 'N1', numeros: ['4'] },
      { rota: 'M2', numeros: ['3'] },
      { rota: 'M1', numeros: ['1', '2'] }
    ], 'nova Optimization deve substituir todas as sacas, reiniciar em 1 e manter rota ausente sem sacas');
    assert.deepStrictEqual(errors, [], 'não deve haver erros JavaScript');
    console.log('OK - distribuição automática, ordem natural, confirmação/cancelamento e substituição da Optimization');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
