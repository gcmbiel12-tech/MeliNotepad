const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('assert');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8743') + '/index.html';
let falhas = 0;
let passos = 0;

function ok(desc) { passos++; console.log('OK  -', desc); }
function fail(desc, err) { falhas++; console.log('FAIL -', desc, '=>', err && err.message ? err.message : err); }

async function etapa(desc, fn) {
  try {
    await fn();
    ok(desc);
  } catch (e) {
    fail(desc, e);
  }
}

async function registrarOcorrencia(page, { codigo, categoria, status, observacao }) {
  await page.fill('#input-codigo', codigo);
  await page.selectOption('#select-categoria', categoria);
  if (status) await page.check('#grupo-status-ocorrencia input[value="' + status + '"]');
  if (observacao) await page.fill('#input-observacao', observacao);
  await page.click('#form-registrar-ocorrencia button[type=submit]');
}

(async () => {
  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });
  const context = await browser.newContext({ permissions: ['camera', 'clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('pageerror: ' + err.message));

  await page.goto(BASE);

  await etapa('Página carrega e mostra o painel de início de sessão', async () => {
    await page.waitForSelector('#painel-inicio:not([hidden])', { timeout: 3000 });
    const chip = await page.textContent('#status-chip');
    assert.strictEqual(chip, 'Sem sessão ativa');
  });

  await etapa('Iniciar sessão (96/7007) e identificação sem "Início"', async () => {
    await page.fill('#input-sacas', '96');
    await page.fill('#input-pacotes', '7007');
    await page.click('#form-iniciar-sessao button[type=submit]');
    await page.waitForSelector('#painel-sessao-ativa:not([hidden])', { timeout: 3000 });
    assert.strictEqual(await page.textContent('#info-sacas'), '96');
    assert.strictEqual(await page.textContent('#info-pacotes'), '7.007');
    const rotulos = await page.$$eval('#painel-sessao-ativa .lista-definicao dt', els => els.map(e => e.textContent));
    assert.deepStrictEqual(rotulos, ['Data', 'Sacas', 'Pacotes'], 'não deveria mais existir o campo "Início"');
    assert.strictEqual(await page.textContent('#status-chip'), 'Em andamento');
  });

  await etapa('Nenhum status vem pré-marcado no formulário de registro', async () => {
    const marcado = await page.evaluate(() => document.querySelector('input[name="status-ocorrencia"]:checked'));
    assert.strictEqual(marcado, null);
  });

  await etapa('Registrar ocorrência com status explícito "Pendente"', async () => {
    await registrarOcorrencia(page, { codigo: '48123456789', categoria: 'avariados', status: 'pendente', observacao: 'Caixa amassada' });
    await page.waitForSelector('.item-ocorrencia');
    assert.strictEqual(await page.textContent('#contagem-total'), '1');
    assert.strictEqual(await page.textContent('#contagem-pendente'), '1');
  });

  await etapa('Registrar ocorrência com status explícito "Resolvido" (código duplicado) pede confirmação', async () => {
    await registrarOcorrencia(page, { codigo: '48123456789', categoria: 'possiveis_duplicados', status: 'resolvido' });
    await page.waitForSelector('#modal-confirmar[open]', { timeout: 3000 });
    const msg = await page.textContent('#modal-confirmar-mensagem');
    assert.ok(msg.includes('já aparece'), 'mensagem de duplicado esperada: ' + msg);
    await page.click('#modal-confirmar-ok');
    await page.waitForFunction(() => document.getElementById('contagem-total').textContent === '2');
    assert.strictEqual(await page.textContent('#contagem-resolvida'), '1');
  });

  await etapa('Não registra sem escolher status (Pendente/Resolvido) e avisa o motivo', async () => {
    await page.fill('#input-codigo', 'SEM-STATUS');
    await page.selectOption('#select-categoria', 'nao_localizados');
    await page.click('#form-registrar-ocorrencia button[type=submit]');
    await page.waitForFunction(() => document.getElementById('toast-container').textContent.includes('status'));
    assert.strictEqual(await page.textContent('#contagem-total'), '2', 'não deveria ter criado ocorrência sem status');
  });

  await etapa('Registrar occ3 (duplicados_inventario/resolvido) e occ4 (nao_localizados/pendente)', async () => {
    await registrarOcorrencia(page, { codigo: 'COD-INV', categoria: 'duplicados_inventario', status: 'resolvido' });
    await page.waitForTimeout(100);
    await registrarOcorrencia(page, { codigo: 'COD-NL', categoria: 'nao_localizados', status: 'pendente' });
    await page.waitForFunction(() => document.getElementById('contagem-total').textContent === '4');
    // "despachar_nao_agregados" fica deliberadamente sem nenhuma ocorrência,
    // para testar mais adiante que ela some do relatório de texto.
  });

  await etapa('Registrar occ5 descartável (para o teste de exclusão)', async () => {
    await registrarOcorrencia(page, { codigo: 'TEMP-DELETE', categoria: 'avariados', status: 'pendente' });
    await page.waitForFunction(() => document.getElementById('contagem-total').textContent === '5');
  });

  await etapa('Filtrar por categoria mostra só os itens esperados', async () => {
    await page.selectOption('#filtro-categoria', 'nao_localizados');
    await page.waitForTimeout(100);
    const itens = await page.$$eval('.item-ocorrencia', els => els.map(e => e.querySelector('.item-ocorrencia__codigo').textContent));
    assert.deepStrictEqual(itens, ['COD-NL']);
    await page.selectOption('#filtro-categoria', '');
  });

  await etapa('Marcar ocorrência como resolvida e reabrir', async () => {
    const totalPendenteAntes = Number(await page.textContent('#contagem-pendente'));
    const botaoResolver = page.locator('.item-ocorrencia button[data-action=resolver]').first();
    await botaoResolver.click();
    await page.waitForFunction((esperado) => document.getElementById('contagem-pendente').textContent === String(esperado), totalPendenteAntes - 1);
    const botaoReabrir = page.locator('.item-ocorrencia button[data-action=reabrir]').first();
    await botaoReabrir.click();
    await page.waitForFunction((esperado) => document.getElementById('contagem-pendente').textContent === String(esperado), totalPendenteAntes);
  });

  await etapa('Editar uma ocorrência', async () => {
    await page.locator('.item-ocorrencia[data-id]').first().locator('button[data-action=editar]').click();
    await page.waitForSelector('#modal-editar[open]');
    await page.fill('#edit-codigo', 'CODIGO-EDITADO');
    await page.click('#form-editar-ocorrencia button[type=submit]');
    await page.waitForFunction(() => document.getElementById('modal-editar').open === false);
    const codigos = await page.$$eval('.item-ocorrencia__codigo', els => els.map(e => e.textContent));
    assert.ok(codigos.includes('CODIGO-EDITADO'), 'código editado deveria aparecer na lista');
  });

  await etapa('Excluir a ocorrência mais recente da lista pede confirmação', async () => {
    const totalAntes = Number(await page.textContent('#contagem-total'));
    await page.locator('.item-ocorrencia[data-id]').first().locator('button[data-action=excluir]').click();
    await page.waitForSelector('#modal-confirmar[open]');
    await page.click('#modal-confirmar-ok');
    await page.waitForFunction((esperado) => document.getElementById('contagem-total').textContent === String(esperado), totalAntes - 1);
    assert.strictEqual(await page.textContent('#contagem-total'), '4');
  });

  await etapa('Atualizar a página mantém a sessão e as ocorrências salvas', async () => {
    await page.reload();
    await page.waitForSelector('#painel-sessao-ativa:not([hidden])');
    assert.strictEqual(await page.textContent('#contagem-total'), '4');
  });

  await etapa('Pré-visualização: estilo WhatsApp, categoria zerada (despachar) não aparece', async () => {
    await page.click('#btn-pre-visualizar');
    await page.waitForSelector('#painel-relatorio:not([hidden])');
    const texto = await page.textContent('#texto-relatorio');
    assert.ok(/\*(Bom dia|Boa tarde|Boa noite)!!!\*/.test(texto), 'saudação em negrito ausente: ' + texto.split('\n')[0]);
    assert.ok(texto.includes('*Rotas Nex finalizadas hoje'), 'cabeçalho em negrito ausente');
    assert.ok(texto.includes('Sacas: *96*'), 'sacas em negrito ausente');
    assert.ok(texto.includes('Pacotes: *7.007*'), 'pacotes em negrito ausente');
    assert.ok(texto.includes('*Pacotes avariados e retirados*'), 'categoria com ocorrência deveria aparecer');
    assert.ok(!texto.includes('despachar'), 'categoria SEM ocorrência não deveria aparecer no texto: trecho = ' + texto);
    assert.ok(/\*Nex Finalizado \(\d{2}:\d{2}\)\*/.test(texto), 'rodapé em negrito ausente/mal formatado');
    assert.ok(/📊 \*4\* ocorrência/.test(texto), 'resumo de totais ausente: ' + texto);
    assert.ok(texto.includes('*MeliOps* — Conferência NEX'), 'cabeçalho de marca ausente');
  });

  let horarioFinalizacaoEscolhido;
  await etapa('Finalizar: horário vem por padrão com "agora", mas é sempre editável manualmente', async () => {
    await page.click('#btn-finalizar-sessao');
    await page.waitForSelector('#modal-finalizar[open]');
    const avisoVisivel = await page.evaluate(() => !document.getElementById('modal-finalizar-aviso-pendentes').hidden);
    assert.ok(avisoVisivel, 'deveria avisar sobre ocorrências pendentes');
    const valorPreenchido = await page.inputValue('#finalizar-horario');
    assert.ok(valorPreenchido.length > 0, 'horário deveria vir pré-preenchido');

    horarioFinalizacaoEscolhido = '2026-10-12T20:22';
    await page.fill('#finalizar-horario', horarioFinalizacaoEscolhido);
    await page.click('#form-finalizar button[type=submit]');
    await page.waitForSelector('#detalhe-historico:not([hidden])', { timeout: 3000 });
    await page.waitForFunction(() => document.getElementById('painel-inicio').hidden === false);
  });

  await etapa('Histórico: detalhe sem "Início", relatório é textarea editável com horário manual exato', async () => {
    const rotulos = await page.$$eval('#detalhe-historico-info dt', els => els.map(e => e.textContent));
    assert.deepStrictEqual(rotulos, ['Data', 'Finalização', 'Sacas', 'Pacotes']);
    const tag = await page.evaluate(() => document.getElementById('detalhe-historico-relatorio').tagName);
    assert.strictEqual(tag, 'TEXTAREA', 'relatório do histórico deveria ser uma textarea editável');
    const texto = await page.inputValue('#detalhe-historico-relatorio');
    assert.ok(texto.includes('Nex Finalizado (20:22)'), 'deveria usar o horário manual exato informado: ' + texto);
    assert.ok(!texto.includes('despachar'), 'categoria zerada ainda não deveria aparecer no texto final');
  });

  await etapa('PDF do histórico: mostra as 5 categorias (despachar com "Zero") e não traz "Início"', async () => {
    await page.evaluate(() => { window.print = () => { window.__printChamado = true; }; });
    await page.click('#btn-gerar-pdf-historico');
    const chamado = await page.evaluate(() => window.__printChamado === true);
    assert.ok(chamado, 'window.print deveria ter sido chamado');
    const categorias = await page.$$eval('#print-area .print-categoria h2', els => els.map(e => e.textContent));
    assert.strictEqual(categorias.length, 5, 'PDF deve manter as 5 categorias mesmo com uma zerada');
    assert.ok(categorias.some(t => t.includes('despachar') && t.includes('(0)')), 'categoria zerada deveria aparecer no PDF com (0): ' + categorias.join(' | '));
    const infoSessao = await page.$eval('#print-area .print-info', el => el.textContent);
    assert.ok(!infoSessao.includes('Início'), 'PDF não deveria mais trazer "Início": ' + infoSessao);
    const rodape = await page.$eval('#print-area .print-rodape', el => el.textContent);
    assert.ok(rodape.includes('20:22'), 'rodapé do PDF deveria usar o horário manual de finalização: ' + rodape);
  });

  await etapa('Editar o texto do relatório manualmente e copiar respeita a edição', async () => {
    await page.fill('#detalhe-historico-relatorio', 'Texto totalmente reescrito pelo usuário antes de enviar.');
    await page.click('#btn-copiar-resumo-historico');
    await page.waitForFunction(() => document.getElementById('aviso-copiar-historico').textContent.includes('copiado'));
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert.strictEqual(clip, 'Texto totalmente reescrito pelo usuário antes de enviar.');
  });

  await etapa('"Restaurar texto gerado" devolve o relatório original', async () => {
    await page.click('#btn-restaurar-relatorio-historico');
    const texto = await page.inputValue('#detalhe-historico-relatorio');
    assert.ok(texto.includes('Nex Finalizado (20:22)'), 'texto restaurado deveria trazer o relatório gerado de novo');
    assert.ok(!texto.includes('reescrito pelo usuário'));
  });

  await etapa('Histórico lista exatamente 1 sessão finalizada', async () => {
    await page.click('#btn-fechar-detalhe-historico');
    const qtd = await page.$$eval('.item-historico__botao', els => els.length);
    assert.strictEqual(qtd, 1);
  });

  await etapa('Nova sessão não mistura ocorrências da sessão anterior', async () => {
    await page.click('#btn-ver-sessao');
    await page.fill('#input-sacas', '10');
    await page.fill('#input-pacotes', '500');
    await page.click('#form-iniciar-sessao button[type=submit]');
    await page.waitForSelector('#painel-sessao-ativa:not([hidden])');
    assert.strictEqual(await page.textContent('#contagem-total'), '0', 'nova sessão deveria começar sem ocorrências');
  });

  await etapa('Bloqueio: não é possível iniciar outra sessão sem finalizar/descartar a atual', async () => {
    await page.click('#btn-nova-sessao-bloqueio');
    await page.waitForSelector('#modal-sessao-bloqueio[open]');
    await page.click('#btn-bloqueio-cancelar');
    await page.waitForFunction(() => document.getElementById('modal-sessao-bloqueio').open === false);
  });

  await etapa('Descartar sessão atual (com confirmação) libera para nova sessão', async () => {
    await page.click('#btn-nova-sessao-bloqueio');
    await page.waitForSelector('#modal-sessao-bloqueio[open]');
    await page.click('#btn-bloqueio-descartar');
    await page.waitForSelector('#modal-confirmar[open]');
    await page.click('#modal-confirmar-ok');
    await page.waitForSelector('#painel-inicio:not([hidden])');
  });

  await etapa('Exportar backup dispara o download de um JSON válido (1 sessão no histórico)', async () => {
    await page.click('#btn-ver-historico');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#btn-exportar-backup')
    ]);
    const destino = '/tmp/melinotepad_backup_teste.json';
    await download.saveAs(destino);
    const conteudo = JSON.parse(fs.readFileSync(destino, 'utf8'));
    assert.strictEqual(conteudo.melinotepadBackup, true);
    assert.strictEqual(conteudo.dados.history.length, 1);
  });

  await etapa('Importar backup inválido não altera os dados e mostra erro', async () => {
    const arquivoInvalido = '/tmp/backup_invalido.json';
    fs.writeFileSync(arquivoInvalido, '{ isso nao é json valido ]');
    await page.setInputFiles('#input-importar-arquivo', arquivoInvalido);
    await page.waitForFunction(() => document.getElementById('toast-container').textContent.includes('inválido'), { timeout: 3000 });
    const modalAberto = await page.evaluate(() => document.getElementById('modal-importar').open);
    assert.strictEqual(modalAberto, false);
  });

  await etapa('Importar backup válido pede confirmação e substitui os dados', async () => {
    const backupValido = {
      melinotepadBackup: true,
      exportadoEm: new Date().toISOString(),
      versao: 1,
      dados: {
        versao: 1,
        currentSession: null,
        history: [{
          id: 'sess_importada',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          status: 'finalizada',
          sacas: 1,
          pacotes: 1,
          occurrences: []
        }]
      }
    };
    const caminho = '/tmp/backup_valido.json';
    fs.writeFileSync(caminho, JSON.stringify(backupValido));
    await page.setInputFiles('#input-importar-arquivo', caminho);
    await page.waitForSelector('#modal-importar[open]');
    await page.click('#btn-confirmar-importar');
    await page.waitForFunction(() => document.querySelectorAll('.item-historico__botao').length === 1);
    const idImportado = await page.evaluate(() => JSON.parse(localStorage.getItem('melinotepad_data_v1')).history[0].id);
    assert.strictEqual(idImportado, 'sess_importada');
  });

  await etapa('Excluir sessão do histórico pede confirmação e remove permanentemente', async () => {
    await page.click('.item-historico__botao');
    await page.waitForSelector('#detalhe-historico:not([hidden])');
    await page.click('#btn-excluir-sessao-historico');
    await page.waitForSelector('#modal-confirmar[open]');
    const msg = await page.textContent('#modal-confirmar-mensagem');
    assert.ok(msg.includes('Excluir a conferência'), 'mensagem de confirmação inesperada: ' + msg);
    await page.click('#modal-confirmar-ok');
    await page.waitForFunction(() => document.getElementById('detalhe-historico').hidden === true);
    const qtd = await page.$$eval('.item-historico__botao', els => els.length);
    assert.strictEqual(qtd, 0, 'histórico deveria ficar vazio após excluir a única sessão');
  });

  await etapa('Dados corrompidos no LocalStorage não travam o carregamento', async () => {
    await page.evaluate(() => localStorage.setItem('melinotepad_data_v1', '{ json quebrado'));
    await page.reload();
    await page.waitForSelector('#painel-inicio:not([hidden])', { timeout: 3000 });
    const aviso = await page.textContent('#avisos-sistema');
    assert.ok(aviso.includes('corrompid'), 'deveria avisar sobre dados corrompidos');
  });

  await etapa('Câmera: abre quando suportada, ou mostra alternativa manual sem travar/gerar erro', async () => {
    await page.evaluate(() => localStorage.removeItem('melinotepad_data_v1'));
    await page.reload();
    await page.fill('#input-sacas', '1');
    await page.fill('#input-pacotes', '1');
    await page.click('#form-iniciar-sessao button[type=submit]');
    await page.waitForSelector('#painel-sessao-ativa:not([hidden])');

    const suportada = await page.evaluate(() => typeof window.BarcodeDetector === 'function');
    await page.click('#btn-abrir-camera');
    await page.waitForTimeout(800);

    if (suportada) {
      const videoVisivel = await page.evaluate(() => !document.getElementById('video-camera').hidden);
      assert.ok(videoVisivel, 'vídeo deveria ficar visível quando BarcodeDetector é suportado');
      await page.click('#btn-fechar-camera');
    } else {
      const aviso = await page.textContent('#aviso-camera');
      const videoEscondido = await page.evaluate(() => document.getElementById('video-camera').hidden);
      assert.ok(aviso.includes('não é compatível'), 'deveria avisar sobre falta de suporte: ' + aviso);
      assert.ok(videoEscondido, 'vídeo deveria permanecer oculto quando não suportado');
      console.log('   (nota: BarcodeDetector indisponível neste Chromium headless — caminho de alternativa manual validado)');
    }

    await registrarOcorrencia(page, { codigo: 'TESTE-FALLBACK-MANUAL', categoria: 'avariados', status: 'pendente' });
    await page.waitForFunction(() => document.getElementById('contagem-total').textContent === '1');
  });

  await etapa('Service worker é registrado em contexto seguro (http://localhost)', async () => {
    const registrado = await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r));
    assert.ok(registrado, 'service worker deveria estar registrado');
  });

  await etapa('Nenhum erro inesperado no console durante o fluxo testado', async () => {
    const relevantes = consoleErrors.filter(e => !e.includes('Service worker não registrado'));
    assert.strictEqual(relevantes.length, 0, 'erros encontrados: ' + JSON.stringify(relevantes));
  });

  await browser.close();

  console.log('\n--- RESULTADO ---');
  console.log(passos + ' passos OK, ' + falhas + ' falha(s).');
  if (consoleErrors.length) console.log('Mensagens de console (erro):', consoleErrors);
  process.exit(falhas > 0 ? 1 : 0);
})();
