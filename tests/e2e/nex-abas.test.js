const { chromium } = require('playwright');
const assert = require('assert');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  const dialogAnswers = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', dialog => dialog.accept(dialogAnswers.shift() || ''));
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
    assert.strictEqual(await page.locator('#nex-lista-rotas .nex-rota-card').count(), 2, 'as rotas importadas devem aparecer recolhidas');
    assert.strictEqual(await page.locator('#nex-lista-rotas').innerText().then(t => t.includes('J1') && t.includes('K1')), true, 'a lista deve exibir os códigos das rotas');
    assert.strictEqual(await page.locator('#nex-lista-rotas .nex-saca-numero').count(), 0, 'as sacas só aparecem ao expandir uma rota');
    assert.strictEqual(await page.locator('#nex-rotas-auditoria .nex-rotas-contadores').evaluate(el => getComputedStyle(el).display), 'none', 'a tela inicial da auditoria deve priorizar as rotas sem contadores grandes');
    assert.strictEqual(await page.locator('#nex-rotas-auditoria .nex-filtros-rotas').evaluate(el => getComputedStyle(el).display), 'none', 'os filtros avançados não devem ocupar a tela principal de rotas');
    await page.locator('#nex-lista-rotas .nex-rota-card').first().locator('.nex-rota-toggle').click();
    await page.locator('#nex-lista-rotas .nex-rota-card').first().getByRole('button', { name: '+ Adicionar saca' }).click();
    await page.locator('#nex-dialogo-operacao textarea').fill('060-062');
    assert.match(await page.locator('.nex-lote-sacas__resumo').innerText(), /3 saca/);
    await page.locator('#nex-dialogo-operacao button[type=submit]').click();
    assert.strictEqual(await page.locator('#nex-lista-rotas .nex-saca-numero').count(), 3, 'intervalo em lote deve criar três sacas individuais');
    await page.waitForFunction(() => !document.getElementById('nex-dialogo-operacao'), null, { timeout: 2000 });
    assert.strictEqual(await page.locator('#nex-dialogo-operacao').count(), 0, 'o diálogo deve fechar após cadastrar o lote com sucesso');
    await page.locator('#nex-lista-rotas .nex-adicionar-saca').first().click();
    assert.strictEqual(await page.locator('#nex-dialogo-operacao textarea').count(), 1, 'Adicionar saca deve usar a mesma interface de inclusão múltipla');
    await page.locator('#nex-dialogo-operacao textarea').fill('70-71');
    await page.locator('#nex-dialogo-operacao button[type=submit]').click();
    assert.strictEqual(await page.locator('#nex-lista-rotas .nex-saca-numero').count(), 5, 'Adicionar saca deve aceitar várias sacas no mesmo envio');
    await page.waitForFunction(() => !document.getElementById('nex-dialogo-operacao'), null, { timeout: 2000 });
    assert.strictEqual(await page.locator('#nex-dialogo-operacao').count(), 0, 'a inclusão múltipla na rota deve fechar após sucesso');
    await page.locator('#nex-lista-rotas .nex-adicionar-saca').first().click();
    await page.locator('#nex-dialogo-operacao textarea').fill('72');
    await page.locator('#nex-dialogo-operacao button[type=submit]').click();
    assert.strictEqual(await page.locator('#nex-lista-rotas .nex-saca-numero').count(), 6, 'a rota deve continuar aceitando novas inclusões');
    await page.locator('#nex-lista-rotas .nex-saca-numero').first().click();
    dialogAnswers.push('Gabriel');
    await page.locator('#nex-lista-rotas .nex-saca-item:visible').first().getByRole('button', { name: 'Auditar saca' }).click();
    assert.match(await page.locator('#nex-lista-rotas .nex-saca-item').first().innerText(), /Auditor: Gabriel/);
    assert.match(await page.locator('#nex-lista-rotas .nex-saca-item').first().innerText(), /Concluída/);
    assert.strictEqual(
      await page.locator('#nex-lista-rotas .nex-saca-numero').first().evaluate(el => getComputedStyle(el).backgroundColor),
      'rgb(229, 244, 232)',
      'saca auditada sem ocorrência deve ficar verde pastel'
    );
    assert.strictEqual(
      await page.locator('#nex-lista-rotas .nex-saca-dialog .nex-saca-item').first().evaluate(el => getComputedStyle(el).backgroundColor),
      'rgb(229, 244, 232)',
      'cartão da saca auditada deve ficar verde pastel'
    );
    await page.reload();
    await page.waitForSelector('#nex-abas-principais:not([hidden])');
    await page.click('#nex-tab-btn-gaiolas');
    await page.locator('#nex-lista-rotas .nex-rota-card').first().locator('.nex-rota-toggle').click();
    assert.match(await page.locator('#nex-lista-rotas .nex-saca-item').first().innerText(), /Auditor: Gabriel/, 'auditoria individual deve continuar salva após recarregar');
    const duplicada = await page.evaluate(() => window.MeliNotepad.NexOperations.addSaca('J1', '60'));
    assert.strictEqual(duplicada.sucesso, false, '060 e 60 devem ser tratados como a mesma saca');
    assert.match(duplicada.erro, /já está cadastrada/i);
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
    await page.click('#nex-tab-btn-gaiolas');
    await page.locator('.nex-adicionar-sacas-multiplas-rotas').click();
    await page.locator('#nex-dialogo-operacao textarea').fill('J1 80-81\nK1 90,91');
    assert.match(await page.locator('.nex-lote-sacas__resumo').innerText(), /4 saca/);
    await page.locator('#nex-dialogo-operacao button[type=submit]').click();
    await page.waitForFunction(() => !document.getElementById('nex-dialogo-operacao'), null, { timeout: 2000 });
    assert.strictEqual(await page.locator('#nex-dialogo-operacao').count(), 0, 'cadastro global deve fechar o diálogo após sucesso');
    assert.strictEqual(await page.locator('#nex-lista-rotas .nex-rota-card').count(), 2, 'cadastro global não deve criar rotas adicionais');
    assert.strictEqual(await page.locator('#nex-lista-rotas .nex-rota-card').nth(0).locator('.nex-saca-numero').count(), 8, 'lote global deve adicionar sacas à primeira rota indicada');
    assert.strictEqual(await page.locator('#nex-lista-rotas .nex-rota-card').nth(1).locator('.nex-saca-numero').count(), 2, 'lote global deve adicionar sacas à segunda rota indicada');
    assert.deepStrictEqual(errors, [], 'não deve haver erros de JavaScript');
    console.log('OK - abas NEX, fluxo de quantidades/ocorrências/relatórios e ausência de campos de veículos');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });