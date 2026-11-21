const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const requests = [], pets = [], errors = [];
    await context.route(url => url.port === '3000', async route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      requests.push({ path: pathname, method: request.method(), body: request.postDataJSON() });
      let body = [];
      if (pathname === '/api/register') body = { email: 'owner@example.test', verification_required: true, email_sent: true, retry_after: 60 };
      if (pathname === '/api/resend-verification') body = { email_sent: true, retry_after: 60, message: 'A new code has been sent.' };
      if (pathname === '/api/verify-email') body = { id: 999, email: 'owner@example.test', name: 'Test Owner', role: 'user', token: 'verified-test-session', email_verified: true };
      if (pathname === '/api/owner/pets') {
        if (request.method() === 'POST') { pets.push({ ...request.postDataJSON(), id: 1 }); body = pets[0]; }
        else body = pets;
      }
      return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.TEST_MOBILE_URL || 'http://localhost:8081');
    await page.getByRole('button', { name: 'Skip the tour for now' }).click();
    await page.getByText('Sign up', { exact: true }).click();
    await page.getByLabel('Full Name', { exact: true }).fill('Test Owner');
    await page.getByLabel('Email', { exact: true }).fill('owner@example.test');
    await page.getByLabel('Password', { exact: true }).fill('Test-Only-Password123');
    await page.getByLabel('Confirm Password', { exact: true }).fill('Test-Only-Password123');
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
    await page.getByText('Please agree to the Terms of Service and Privacy Policy.', { exact: true }).waitFor();
    assert.equal(requests.filter(request => request.path === '/api/register').length, 0);
    await page.getByRole('checkbox').click();
    await page.screenshot({ path: path.join(__dirname, '../tmp/registration-reference-match.png'), fullPage: true });
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
    await page.getByText('Verify your email', { exact: true }).waitFor();
    await page.getByText('Didn’t receive a code?', { exact: true }).waitFor();
    const resend = page.getByRole('button', { name: 'Resend Code', exact: true });
    assert.equal(await resend.isDisabled(), true, 'Resend is disabled during the initial 60 seconds.');
    await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 61000; });
    await page.waitForFunction(() => document.querySelector('[aria-label="Resend Code"]')?.getAttribute('aria-disabled') !== 'true');
    await resend.click();
    await page.getByText('A new six-digit code has been sent. It expires in 10 minutes. Use the newest code.', { exact: true }).waitFor();
    assert.equal(await resend.isDisabled(), true, 'Successful resend starts another 60-second countdown.');
    assert.equal(requests.filter(request => request.path === '/api/resend-verification').length, 1);
    assert.ok(await page.evaluate(() => Object.keys(localStorage).some(key => key.includes('verification-resend:'))), 'Cooldown is saved when leaving the screen.');
    assert.equal(requests.filter(request => request.path === '/api/login').length, 0, 'Registration never signs in before verification.');
    await page.screenshot({ path: path.join(__dirname, '../tmp/verify-email-mobile.png'), fullPage: true });
    await page.getByLabel('Verification code', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Verify Email', exact: true }).click();
    await page.getByText('Add Your First Pet', { exact: true }).waitFor();
    await page.getByPlaceholder('e.g. Buddy').fill('Test Buddy');
    await page.getByPlaceholder('e.g. Golden Retriever').fill('Test Breed');
    await page.getByText('Add Pet', { exact: true }).click();
    await page.getByText('Test Buddy', { exact: true }).first().waitFor();
    assert.equal(pets.length, 1);
    assert.deepEqual(errors, []);
    console.log('PASS: reference registration form, consent, optional phone, pending verification without login, code verification, first-pet navigation and save, and visible saved pet (390px Chrome). No real emails sent.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
