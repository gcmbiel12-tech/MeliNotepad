const { chromium } = require('playwright');
const assert = require('assert');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8000') + '/index.html';

async function novaPagina(browser, autorizado, papel) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript('window.__authTestConfig = { authorized: ' + JSON.stringify(autorizado) + ', role: ' + JSON.stringify(papel || 'operator') + ' };');
  await page.addInitScript(() => {
    const isAuthorized = window.__authTestConfig.authorized;
    const role = window.__authTestConfig.role;
    window.MeliNotepadConfig = {
      supabaseUrl: 'https://project.example',
      supabaseAnonKey: 'public-test-key'
    };
    window.__authRequests = [];
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
      assert.match(await page.locator('#auth-local-data-warning').innerText(), /ainda não sincronizam/);
      assert.deepStrictEqual(errors, [], 'sem erros JavaScript no fluxo autenticado');

      await page.locator('#auth-signout').click();
      await page.locator('#auth-panel').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#conteudo-principal').isVisible(), false, 'logout volta a bloquear os módulos');
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
