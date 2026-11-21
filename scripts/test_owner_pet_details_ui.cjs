const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem('token', 'test-owner-session');
      localStorage.setItem('user', JSON.stringify({ id: 999, name: 'Test Owner', email: 'owner@example.test', role: 'user' }));
    });
    let pet = { id: '9942', name: 'Pearl', species: 'dog', breed: 'Shih Tzu', age: '3', weight: '5', color: 'White' };
    const errors = [];
    await context.route(url => url.port === '3000', async route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      let body = [];
      if (pathname === '/api/owner/pets') body = [pet];
      if (pathname === '/api/owner/pets/9942') {
        if (request.method() === 'PUT') pet = { ...pet, ...request.postDataJSON() };
        body = pet;
      }
      return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.TEST_MOBILE_URL || 'http://localhost:8081');
    await page.getByRole('button', { name: 'Skip the tour for now' }).click();
    await page.getByText('Pearl', { exact: true }).click();
    await page.getByText('Pet Profile', { exact: true }).waitFor();
    await page.getByText('Pearl', { exact: true }).last().waitFor();
    assert.equal(await page.getByText('Pet not found', { exact: true }).count(), 0);
    await page.getByText('Edit', { exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Pearl Updated');
    await page.getByText('Save', { exact: true }).click();
    await page.getByText('Pearl Updated', { exact: true }).first().waitFor();
    assert.equal(pet.name, 'Pearl Updated');
    await page.getByLabel('Back to My Pets', { exact: true }).click();
    await page.getByText('My Pets', { exact: true }).waitFor();
    await page.getByText('Pearl Updated', { exact: true }).first().waitFor();
    await page.getByText('Pearl Updated', { exact: true }).first().click();
    await page.getByText('Pet Profile', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: real saved pet opens its profile, edit saves, Home refreshes on return, and the pet reopens without “Pet not found” (390px Chrome).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
