const { chromium } = require('playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.removeItem('melinotepad_data_v1'));
    await page.reload();
    assert.strictEqual(await page.locator('#nex-tela-iniciar-operacao').isVisible(), true, 'NEX deve abrir na tela de iniciar operação');
    assert.strictEqual(await page.locator('#nex-abas-principais').isVisible(), false, 'abas de trabalho só aparecem após iniciar a operação');
    assert.strictEqual(await page.locator('#painel-inicio').isVisible(), true, 'formulário de início deve estar visível');
    await page.setInputFiles('#nex-arquivo-planilha', {
      name: 'rotas.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Tipos de serviços,ID Otimizado,Quantidade de sacas,Pacotes estimados\nHYBRID,J1_AM1,10,20\nHYBRID,K1_AM1,5,8\n')
    });
    await page.waitForFunction(() => document.getElementById('nex-importacao-resumo').textContent.includes('2 rota'));
    await page.click('#form-iniciar-sessao button[type=submit]');
    await page.waitForFunction(() => !document.getElementById('painel-sessao-ativa').hidden);
    await page.waitForSelector('#nex-abas-principais:not([hidden])');
    await page.click('#nex-tab-btn-gaiolas');
    assert.strictEqual(await page.locator('#nex-lista-rotas .nex-rota-card').count(), 2, 'rotas HYBRID importadas devem aparecer como gaiolas auditáveis');
    assert.strictEqual(await page.locator('#nex-lista-rotas').innerText().then(t => t.includes('J1') && t.includes('K1')), true, 'a lista deve exibir os códigos das rotas');
    await page.locator('#nex-lista-rotas .nex-rota-card').first().locator('input[name=auditor]').fill('Gabriel');
    await page.locator('#nex-lista-rotas .nex-rota-card').first().locator('button[type=submit]').click();
    assert.match(await page.locator('#nex-lista-rotas .nex-rota-card').first().innerText(), /Concluída/);
    assert.match(await page.locator('#nex-lista-rotas .nex-rota-card').first().innerText(), /Auditor: Gabriel/);
    await page.reload();
    await page.waitForSelector('#nex-abas-principais:not([hidden])');
    await page.click('#nex-tab-btn-gaiolas');
    assert.match(await page.locator('#nex-lista-rotas .nex-rota-card').first().innerText(), /Auditor: Gabriel/, 'auditoria da rota deve continuar salva após recarregar');
    await page.click('#nex-tab-btn-ocorrencias');
    await page.click('#nex-tab-btn-quantidades');
    assert.strictEqual(await page.locator('#info-sacas').textContent(), '15', 'quantidades deve mostrar o total de sacas importado');
    assert.strictEqual(await page.locator('#info-pacotes').textContent(), '28', 'quantidades deve mostrar o total de pacotes importado');
    await page.click('#btn-editar-totais');
    assert.strictEqual(await page.locator('#input-sacas-edit').inputValue(), '15');
    assert.strictEqual(await page.locator('#input-pacotes-edit').inputValue(), '28');
    await page.fill('#input-sacas-edit', '16');
    await page.fill('#input-pacotes-edit', '29');
    await page.click('#form-editar-totais button[type=submit]');
    assert.strictEqual(await page.locator('#info-sacas').textContent(), '16', 'edição deve atualizar sacas');
    assert.strictEqual(await page.locator('#info-pacotes').textContent(), '29', 'edição deve atualizar pacotes');
    await page.click('#nex-tab-btn-gaiolas');
    await page.click('#nex-tab-btn-ocorrencias');
    assert.strictEqual(await page.locator('#form-registrar-ocorrencia').isVisible(), true, 'formulário de ocorrência deve ficar na aba Ocorrências');
    await page.fill('#input-codigo', 'PKG-TAB-1');
    await page.selectOption('#select-categoria', 'bingo');
    await page.check('#grupo-status-ocorrencia input[value="pendente"]');
    await page.click('#form-registrar-ocorrencia button[type=submit]');
    await page.waitForFunction(() => document.getElementById('contagem-total').textContent === '1');
    await page.click('#nex-tab-btn-relatorios');
    assert.strictEqual(await page.locator('#btn-pre-visualizar').isVisible(), true, 'prévia deve ficar na aba Relatórios');
    await page.click('#btn-pre-visualizar');
    const report = await page.locator('#texto-relatorio').textContent();
    assert.match(report, /PKG-TAB-1/);
    assert.doesNotMatch(report, /veículo|veiculo|carregamento|placa|paletes/i, 'relatório NEX não deve conter lógica de veículos');
    assert.deepStrictEqual(errors, [], 'não deve haver erros de JavaScript');
    console.log('OK - abas NEX, fluxo de quantidades/ocorrências/relatórios e ausência de campos de veículos');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });