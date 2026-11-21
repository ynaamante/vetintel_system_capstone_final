const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'node_modules/playwright'));
const catalog = require('../data/permissionCatalog.json');
const harness = path.join(__dirname, '../admin/preload-test.html');

(async () => {
  let browser;
  assert.equal(fs.existsSync(harness), false, 'The temporary harness must not overwrite a file.');
  try {
    const user = { id: 999, token: 'preload-test', clinic_id: 999, role: 'receptionist',
      permissions: Object.fromEntries(catalog.groups.map(([group, actions]) => [group, Object.fromEntries(actions.map(action => [action, true]))])) };
    fs.writeFileSync(harness, `<!doctype html><html><body><main id="foreground">Current page</main><div id="root"></div>
      <script type="module">
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import BackgroundPagePreloader from '/src/components/BackgroundPagePreloader.jsx';
        import ClientManagementPage from '/src/pages/receptionist/ClientManagementPage.jsx';
        import {pageStateStore,clearPageState} from '/src/utils/pageStateStore.js';
        const user=${JSON.stringify(user)};
        const root=createRoot(document.getElementById('root'));
        const allowed=id=>['client-mgmt','billing','patient-registration'].includes(id);
        root.render(React.createElement(React.StrictMode,null,React.createElement(BackgroundPagePreloader,{user,activePage:'settings',canAccessPage:allowed})));
        window.preloadTest={store:pageStateStore,openClients:()=>root.render(React.createElement(ClientManagementPage,{user})),
          logout:()=>{root.unmount();clearPageState();}};
      </script></body></html>`);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext();
    const requests = [];
    await context.route(url => url.port === '3000' || url.pathname.startsWith('/api/'), async route => {
      const request = route.request();
      requests.push({ path: new URL(request.url()).pathname, method: request.method() });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
        'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*',
      } });
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto((process.env.TEST_ADMIN_URL || 'http://localhost:3002') + '/preload-test.html');
    await page.waitForFunction(() => window.preloadTest && ['ClientManagementPage','BillingPage','PatientRegistrationPage']
      .every(name => window.preloadTest.store.status('pages/receptionist/'+name+'.jsx:loading').value === false), { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('[data-background-preload]'));
    assert.equal(await page.locator('#foreground').innerText(), 'Current page');
    assert.ok(requests.some(request => request.path.includes('/registration-intakes')), 'An unvisited registration page was preloaded.');
    assert.ok(requests.some(request => request.path.includes('/invoices')), 'An unvisited billing page was preloaded.');
    assert.ok(requests.every(request => ['GET', 'OPTIONS'].includes(request.method)), 'Preloading performs only read requests.');
    assert.ok(!requests.some(request => /disease-intelligence|restock|audit-trail/.test(request.path)), 'Pages outside the allowed list are not preloaded.');
    await page.evaluate(() => window.preloadTest.openClients());
    await page.waitForTimeout(100);
    assert.ok(!(await page.locator('#root').innerText()).includes('Loading client'), 'First navigation uses preloaded state.');
    await page.evaluate(() => window.preloadTest.logout());
    assert.equal(await page.evaluate(() => window.preloadTest.store.status('pages/receptionist/ClientManagementPage.jsx:loading').written), false);
    assert.deepEqual(errors, []);
    console.log('PASS: unvisited pages preload without navigation, only allowed GETs run, first view uses the prepared data, and logout clears it (React StrictMode, real Chrome).');
  } finally {
    if (browser) await browser.close();
    if (fs.existsSync(harness)) fs.unlinkSync(harness);
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
