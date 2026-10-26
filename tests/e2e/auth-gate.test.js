const { chromium } = require('playwright');
const assert = require('assert');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8000') + '/index.html';

async function novaPagina(browser, autorizado, papel, seedLocal, seedRemote) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript('window.__authTestConfig = { authorized: ' + JSON.stringify(autorizado) + ', role: ' + JSON.stringify(papel || 'operator') + ', seedLocal: ' + JSON.stringify(seedLocal || null) + ', seedRemote: ' + JSON.stringify(seedRemote || null) + ' };');
  await page.addInitScript(() => {
    const isAuthorized = window.__authTestConfig.authorized;
    const role = window.__authTestConfig.role;
    window.MeliNotepadConfig = {
      supabaseUrl: 'https://project.example',
      supabaseAnonKey: 'public-test-key'
    };
    window.__authRequests = [];
    window.__snapshots = JSON.parse(sessionStorage.getItem('__authSnapshots') || 'null') || window.__authTestConfig.seedRemote || {
      nex: { version: 0, payload: null, updatedAt: null },
      xpt: { version: 0, payload: null, updatedAt: null },
      intervalos: { version: 0, payload: null, updatedAt: null }
    };
    sessionStorage.setItem('__authSnapshots', JSON.stringify(window.__snapshots));
    if (window.__authTestConfig.seedLocal && !sessionStorage.getItem('__authSeeded')) {
      Object.keys(window.__authTestConfig.seedLocal).forEach(key => {
        localStorage.setItem(key, JSON.stringify(window.__authTestConfig.seedLocal[key]));
      });
      sessionStorage.setItem('__authSeeded', '1');
    }
    window.fetch = async (input, options) => {
      const url = String(input);
      const opt = options || {};
      window.__authRequests.push({ url, method: opt.method || 'GET', body: opt.body || null });
      const json = (data, status) => new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json' }
      });
      if (url.includes('/auth/v1/token?grant_type=password')) {
        return json({
          access_token: 'access-test',
          refresh_token: 'refresh-test',
          expires_in: 3600,
          user: { id: 'auth-user-test', email: 'funcionario@example.com' }
        });
      }
      if (url.endsWith('/rest/v1/rpc/get_my_employee_context')) {
        return json(isAuthorized
          ? { authorized: true, employeeId: 'employee-1', employeeCode: '0000123', fullName: 'Funcionário Teste', role: role || 'operator', isPrimaryAdmin: role === 'administrator' }
          : { authorized: false, message: 'Acesso ainda não habilitado. Solicite acesso ao administrador.' });
      }
      if (url.endsWith('/rest/v1/rpc/get_module_snapshot')) {
        const args = JSON.parse(opt.body || '{}');
        const snap = window.__snapshots[args.p_module_name];
        return json({ module: args.p_module_name, version: snap.version, payload: snap.payload, updatedAt: snap.updatedAt });
      }
      if (url.endsWith('/rest/v1/rpc/save_module_snapshot')) {
        const args = JSON.parse(opt.body || '{}');
        const snap = window.__snapshots[args.p_module_name];
        if (args.p_expected_version !== snap.version) return json({ code: '40001', message: 'CONFLICT: versão desatualizada' }, 409);
        snap.version++;
        snap.payload = args.p_payload;
        snap.updatedAt = new Date().toISOString();
        sessionStorage.setItem('__authSnapshots', JSON.stringify(window.__snapshots));
        return json({ module: args.p_module_name, version: snap.version, updatedAt: snap.updatedAt });
      }
      if (url.endsWith('/rest/v1/rpc/request_employee_access')) {
        return json({ accepted: true, message: 'Se os dados forem elegíveis, a solicitação será analisada.' });
      }
      if (url.endsWith('/rest/v1/rpc/list_pending_access_requests')) {
        return json([{ request_id: 'request-1', employee_code: '0000042', requested_at: '2026-10-26T12:00:00Z', requester_id: 'auth-user-2', requester_email: 'solicitante@example.com' }]);
      }
      if (url.endsWith('/rest/v1/rpc/approve_employee_access') || url.endsWith('/rest/v1/rpc/deny_employee_access')) return new Response(null, { status: 204 });
      if (url.endsWith('/auth/v1/user') && opt.method === 'PUT') return json({ id: 'auth-user-test' });
      if (url.endsWith('/auth/v1/logout')) return new Response(null, { status: 204 });
      return json({ message: 'Endpoint não simulado: ' + url }, 404);
    };
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  return { context, page, errors };
}

(async () => {
  const browser = await chromium.launch();
  try {
    {
      const { context, page, errors } = await novaPagina(browser, true);
      assert.equal(await page.locator('#auth-panel').isVisible(), true, 'configuração ativa exige autenticação');
      assert.equal(await page.locator('#conteudo-principal').isVisible(), false, 'módulos ficam ocultos antes da autenticação');

      await page.locator('#auth-login-email').fill('funcionario@example.com');
      await page.locator('#auth-login-password').fill('senha-de-teste');
      await page.locator('#auth-login-form button[type="submit"]').click();
      await page.locator('#auth-header').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#conteudo-principal').isVisible(), true);
      assert.equal(await page.locator('#auth-panel').isVisible(), false);
      assert.match(await page.locator('#auth-user-label').innerText(), /Funcionário Teste.*0000123/);
      assert.match(await page.locator('#auth-local-data-warning').innerText(), /continuam locais|Sincronização ativa/);
      await page.locator('#auth-sync-toggle').click();
      await page.locator('#auth-sync-list .auth-sync-item').first().waitFor({ state: 'visible' });
      await page.locator('#auth-sync-list .auth-sync-item').first().locator('button').first().click();
      await page.waitForFunction(() => document.querySelector('#auth-sync-status').textContent.includes('Sincronização ativa: NEX'));
      await page.locator('#auth-sync-list .auth-sync-item').nth(1).locator('button').first().click();
      await page.waitForFunction(() => document.querySelector('#auth-sync-status').textContent.includes('Sincronização ativa: XPT'));
      await page.locator('#auth-sync-list .auth-sync-item').nth(2).locator('button').first().click();
      await page.waitForFunction(() => document.querySelector('#auth-sync-status').textContent.includes('Sincronização ativa: Intervalos'));
      const saveLocal = await page.evaluate(() => {
        const nex = window.MeliNotepad.Storage.salvarDados(window.MeliNotepad.Storage.estruturaVazia());
        localStorage.setItem('melinotepad_xpt_v1', JSON.stringify(window.MeliNotepad.XptRegras.padrao()));
        localStorage.setItem('melinotepad_intervalos_v1', JSON.stringify(window.MeliNotepad.IntervalosRegras.padrao()));
        document.dispatchEvent(new CustomEvent('melios:local-change', { detail: { module: 'xpt', key: 'melinotepad_xpt_v1' } }));
        document.dispatchEvent(new CustomEvent('melios:local-change', { detail: { module: 'intervalos', key: 'melinotepad_intervalos_v1' } }));
        return nex;
      });
      assert.equal(saveLocal.sucesso, true);
      await page.waitForFunction(() => window.__snapshots.nex.version === 1 && window.__snapshots.xpt.version === 1 && window.__snapshots.intervalos.version === 1);
      const snapshotPayload = await page.evaluate(() => window.__snapshots.nex.payload);
      assert.equal(snapshotPayload.currentSession, null);
      assert.deepStrictEqual(errors, [], 'sem erros JavaScript no fluxo autenticado/sincronizado');

      await page.locator('#auth-signout').click();
      await page.locator('#auth-panel').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#conteudo-principal').isVisible(), false, 'logout volta a bloquear os módulos');
      await context.close();
    }

    {
      const localNex = {
        versao: 1,
        currentSession: null,
        history: [{ id: 'session-local', startTime: '2026-10-26T10:00:00.000Z', endTime: '2026-10-26T11:00:00.000Z', status: 'finalizada', sacas: 1, pacotes: 2, occurrences: [] }]
      };
      const { context, page, errors } = await novaPagina(browser, true, 'operator', { melinotepad_data_v1: localNex });
      await page.locator('#auth-login-email').fill('funcionario@example.com');
      await page.locator('#auth-login-password').fill('senha-de-teste');
      await page.locator('#auth-login-form button[type="submit"]').click();
      await page.locator('#auth-header').waitFor({ state: 'visible' });
      await page.locator('#auth-sync-toggle').click();
      await page.locator('#auth-sync-list .auth-sync-item').first().waitFor({ state: 'visible' });
      assert.match(await page.locator('#auth-sync-list .auth-sync-item').first().innerText(), /Há dados locais, mas ainda não existe snapshot na nuvem/);
      await page.locator('#auth-sync-list .auth-sync-item').first().getByRole('button', { name: 'Enviar dados locais' }).click();
      await page.waitForFunction(() => window.__snapshots.nex.version === 1);
      assert.equal(await page.evaluate(() => window.__snapshots.nex.payload.history[0].id), 'session-local');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('melinotepad_data_v1')).history[0].id), 'session-local');
      assert.deepStrictEqual(errors, [], 'migração local inicial não gera erros JavaScript');
      await context.close();
    }

    {
      const localNex = {
        versao: 1,
        currentSession: null,
        history: [{ id: 'session-local', startTime: '2026-10-26T10:00:00.000Z', endTime: '2026-10-26T11:00:00.000Z', status: 'finalizada', sacas: 1, pacotes: 2, occurrences: [] }]
      };
      const remoteNex = {
        versao: 1,
        currentSession: null,
        history: [{ id: 'session-cloud', startTime: '2026-10-25T10:00:00.000Z', endTime: '2026-10-25T11:00:00.000Z', status: 'finalizada', sacas: 3, pacotes: 4, occurrences: [] }]
      };
      const remote = {
        nex: { version: 1, payload: remoteNex, updatedAt: '2026-10-26T12:00:00.000Z' },
        xpt: { version: 0, payload: null, updatedAt: null },
        intervalos: { version: 0, payload: null, updatedAt: null }
      };
      const { context, page, errors } = await novaPagina(browser, true, 'operator', { melinotepad_data_v1: localNex }, remote);
      await page.locator('#auth-login-email').fill('funcionario@example.com');
      await page.locator('#auth-login-password').fill('senha-de-teste');
      await page.locator('#auth-login-form button[type="submit"]').click();
      await page.locator('#auth-header').waitFor({ state: 'visible' });
      await page.locator('#auth-sync-toggle').click();
      await page.locator('#auth-sync-list .auth-sync-item').first().waitFor({ state: 'visible' });
      assert.match(await page.locator('#auth-sync-list .auth-sync-item').first().innerText(), /Os dados locais e da nuvem são diferentes/);
      assert.equal(await page.evaluate(() => window.__snapshots.nex.version), 1, 'não sobrescreve a nuvem sem escolha explícita');
      await page.locator('#auth-sync-list .auth-sync-item').first().getByRole('button', { name: /Enviar local/ }).click();
      await page.waitForFunction(() => window.__snapshots.nex.version === 2);
      assert.equal(await page.evaluate(() => window.__snapshots.nex.payload.history[0].id), 'session-local');
      assert.deepStrictEqual(errors, [], 'resolução explícita de conflito não gera erros JavaScript');
      await context.close();
    }

    {
      const localNex = { versao: 1, currentSession: null, history: [{ id: 'session-local', startTime: '2026-10-26T10:00:00.000Z', endTime: '2026-10-26T11:00:00.000Z', status: 'finalizada', sacas: 1, pacotes: 2, occurrences: [] }] };
      const remoteNex = { versao: 1, currentSession: null, history: [{ id: 'session-cloud', startTime: '2026-10-25T10:00:00.000Z', endTime: '2026-10-25T11:00:00.000Z', status: 'finalizada', sacas: 3, pacotes: 4, occurrences: [] }] };
      const remote = { nex: { version: 1, payload: remoteNex, updatedAt: '2026-10-26T12:00:00.000Z' }, xpt: { version: 0, payload: null, updatedAt: null }, intervalos: { version: 0, payload: null, updatedAt: null } };
      const { context, page, errors } = await novaPagina(browser, true, 'operator', { melinotepad_data_v1: localNex }, remote);
      await page.locator('#auth-login-email').fill('funcionario@example.com');
      await page.locator('#auth-login-password').fill('senha-de-teste');
      await page.locator('#auth-login-form button[type="submit"]').click();
      await page.locator('#auth-header').waitFor({ state: 'visible' });
      await page.locator('#auth-sync-toggle').click();
      await page.locator('#auth-sync-list .auth-sync-item').first().waitFor({ state: 'visible' });
      const reload = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
      await page.locator('#auth-sync-list .auth-sync-item').first().getByRole('button', { name: 'Baixar nuvem (backup local)' }).click();
      await reload;
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('melinotepad_data_v1')).history[0].id === 'session-cloud');
      await page.locator('#auth-header').waitFor({ state: 'visible' });
      const backup = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => k.startsWith('melinotepad_sync_backup_nex_'));
        return key ? JSON.parse(localStorage.getItem(key)) : null;
      });
      assert.equal(backup.dados.history[0].id, 'session-local', 'a versão local foi preservada antes da substituição');
      assert.deepStrictEqual(errors, [], 'baixar a nuvem com backup não gera erros JavaScript');
      await context.close();
    }

    {
      const { context, page, errors } = await novaPagina(browser, false);
      await page.locator('#auth-login-email').fill('novo@example.com');
      await page.locator('#auth-login-password').fill('senha-de-teste');
      await page.locator('#auth-login-form button[type="submit"]').click();
      await page.locator('#auth-request-form').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#conteudo-principal').isVisible(), false, 'conta sem vínculo não abre os módulos');

      await page.locator('#auth-employee-code').fill('0000042');
      await page.locator('#auth-request-form button[type="submit"]').click();
      await page.getByText(/Solicitação registrada para análise/).waitFor({ state: 'visible' });
      const body = await page.evaluate(() => window.__authRequests);
      assert.ok(body.some(x => x.url.endsWith('/rest/v1/rpc/request_employee_access') && JSON.parse(x.body).p_employee_code === '0000042'));
      assert.deepStrictEqual(errors, [], 'sem erros JavaScript no fluxo de solicitação');
      await context.close();
    }

    {
      const { context, page, errors } = await novaPagina(browser, true, 'administrator');
      page.on('dialog', dialog => dialog.accept());
      await page.locator('#auth-login-email').fill('admin@example.com');
      await page.locator('#auth-login-password').fill('senha-de-teste');
      await page.locator('#auth-login-form button[type="submit"]').click();
      await page.locator('#auth-admin-toggle').waitFor({ state: 'visible' });
      await page.locator('#auth-admin-toggle').click();
      await page.locator('#auth-pending-list .auth-pending-item').waitFor({ state: 'visible' });
      assert.match(await page.locator('#auth-pending-list').innerText(), /0000042.*solicitante@example.com/s);
      await page.locator('#auth-pending-list .auth-pending-item button').first().click();
      await page.waitForFunction(() => window.__authRequests.some(x => x.url.endsWith('/rest/v1/rpc/approve_employee_access')));
      const calls = await page.evaluate(() => window.__authRequests);
      assert.ok(calls.some(x => x.url.endsWith('/rest/v1/rpc/approve_employee_access') && JSON.parse(x.body).p_request_id === 'request-1'));
      assert.deepStrictEqual(errors, [], 'sem erros JavaScript no fluxo administrativo');
      await context.close();
    }

    console.log('PASS auth E2E: bloqueio antes do login, contexto autorizado, aviso local, logout, solicitação e revisão administrativa.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
