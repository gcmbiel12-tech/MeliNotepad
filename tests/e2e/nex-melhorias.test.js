const { chromium } = require('playwright');
const assert = require('assert');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE);
  await page.evaluate(() => localStorage.removeItem('melinotepad_data_v1'));
  await page.reload();

  await page.fill('#input-sacas', '10');
  await page.fill('#input-pacotes', '20');
  await page.click('#form-iniciar-sessao button[type=submit]');
  await page.waitForSelector('#painel-sessao-ativa:not([hidden])');

  await page.fill('#input-codigo', 'PKG-B1');
  await page.selectOption('#select-categoria', 'bingo');
  assert.match(await page.textContent('#ajuda-categoria'), /produto que não foi encontrado fisicamente/i);
  await page.check('#grupo-status-ocorrencia input[value="pendente"]');
  await page.fill('#input-observacao', 'Produto não localizado');
  await page.click('#form-registrar-ocorrencia button[type=submit]');
  await page.waitForFunction(() => document.getElementById('contagem-total').textContent === '1');

  await page.fill('#input-codigo', 'PKG-F1');
  await page.selectOption('#select-categoria', 'faltando');
  assert.match(await page.textContent('#ajuda-categoria'), /pacote a mais/i);
  await page.check('#grupo-status-ocorrencia input[value="resolvido"]');
  await page.fill('#input-observacao', 'Pacote extra encontrado');
  await page.click('#form-registrar-ocorrencia button[type=submit]');
  await page.waitForFunction(() => document.getElementById('contagem-total').textContent === '2');

  await page.click('#btn-ver-pendentes');
  assert.strictEqual(await page.locator('.item-ocorrencia').count(), 1);
  assert.match(await page.textContent('#btn-ver-pendentes'), /Ver todas/);
  await page.click('#btn-ver-pendentes');
  assert.strictEqual(await page.locator('.item-ocorrencia').count(), 2);

  const itemFaltando = page.locator('.item-ocorrencia').filter({ hasText: 'PKG-F1' });
  await itemFaltando.getByRole('button', { name: 'Editar' }).click();
  await page.fill('#edit-codigo', 'PKG-B1');
  await page.click('#form-editar-ocorrencia button[type=submit]');
  await page.waitForSelector('#modal-confirmar[open]');
  assert.match(await page.textContent('#modal-confirmar-mensagem'), /já aparece em outra ocorrência/i);
  await page.click('#modal-confirmar-cancelar');
  assert.match(await page.locator('.item-ocorrencia').filter({ hasText: 'PKG-F1' }).textContent(), /Faltando/);
  await page.click('#btn-cancelar-editar');

  await page.locator('.item-ocorrencia').filter({ hasText: 'PKG-F1' }).getByRole('button', { name: 'Editar' }).click();
  await page.fill('#edit-codigo', 'PKG-B1');
  await page.click('#form-editar-ocorrencia button[type=submit]');
  await page.waitForSelector('#modal-confirmar[open]');
  await page.click('#modal-confirmar-ok');
  await page.waitForSelector('#modal-editar[open]', { state: 'hidden' });

  await page.click('#btn-pre-visualizar');
  const relatorio = await page.textContent('#texto-relatorio');
  assert.match(relatorio, /Bingo.*produto não encontrado na auditoria/i);
  assert.match(relatorio, /Faltando.*pacote a mais, que não deveria estar no local/i);

  await page.click('#btn-finalizar-sessao');
  await page.waitForSelector('#modal-finalizar[open]');
  const resumo = await page.textContent('#modal-finalizar-resumo');
  assert.match(resumo, /Ocorrências: 2/);
  assert.match(resumo, /Pendentes: 1/);
  assert.match(resumo, /Resolvidas: 1/);
  assert.match(await page.textContent('#modal-finalizar-aviso-pendentes'), /ainda está/);
  await page.click('#form-finalizar button[type=submit]');
  await page.waitForSelector('#modal-finalizar', { state: 'hidden' });
  await page.waitForFunction(() => document.querySelectorAll('.item-historico__botao').length === 1);

  await page.selectOption('#historico-categoria', 'bingo');
  await page.selectOption('#historico-status', 'pendente');
  assert.strictEqual(await page.locator('.item-historico__botao').count(), 1);
  await page.selectOption('#historico-categoria', 'faltando');
  await page.selectOption('#historico-status', 'pendente');
  assert.strictEqual(await page.locator('.item-historico__botao').count(), 0, 'categoria e status devem corresponder à mesma ocorrência');
  await page.selectOption('#historico-status', '');
  await page.fill('#historico-busca', 'Pacote extra encontrado');
  assert.strictEqual(await page.locator('.item-historico__botao').count(), 1, 'busca deve encontrar observações no histórico');

  await page.setViewportSize({ width: 390, height: 844 });
  const dimensoesMobile = await page.evaluate(() => ({ largura: window.innerWidth, documento: document.documentElement.scrollWidth }));
  assert.ok(dimensoesMobile.documento <= dimensoesMobile.largura + 1, 'não deve haver rolagem horizontal em mobile: ' + JSON.stringify(dimensoesMobile));

  assert.deepStrictEqual(errors, [], 'não deve haver erros de JavaScript na página');
  await browser.close();
  console.log('PASS NEX melhorias: descrições Bingo/Faltando, filtro de pendentes, alerta de duplicidade na edição, resumo de finalização e filtros do histórico.');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
