const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'node_modules/playwright'));
const db = require('../config/db');
const auth = require('../middleware/auth');
const policy = require('../utils/rolePermissions');
const { loadPrincipal } = require('../services/clinicPermissions');

(async () => {
  let browser;
  try {
    const actors = (await db.query(`SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id=u.role_id
      WHERE COALESCE(u.is_active,true) AND u.clinic_id IS NOT NULL ORDER BY (u.clinic_id=11) DESC,u.id`)).rows;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const role of ['owner', 'doctor', 'receptionist']) {
      const actor = actors.find(row => policy.profile(row.role) === role);
      if (!actor) continue;
      const user = await loadPrincipal(actor.id);
      const token = auth.signUserToken({ ...user, exp: Date.now() + 600000 });
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addInitScript(token => localStorage.setItem('vetintel_token', token), token);
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.TEST_ADMIN_URL || 'http://localhost:3002');
      await page.locator('.sidebar-nav-item').first().waitFor();
      const labels = await page.locator('.sidebar-nav-item').allTextContents();
      const targets = ['Dashboard', 'Disease Monitoring', 'Risk Monitoring', 'Reports',
        'Local Clinic Records', 'Patient Records', 'Due Dates & Reminders', 'Clinic Overview',
        'User Management', 'Roles & Permissions', 'Financial Monitoring', 'Services Management',
        'Client Management', 'Appointment Management', 'Patient Queue', 'Billing & Payments', 'New Patient Registration'];
      const nav = label => page.locator('.sidebar-nav-item').filter({ hasText: label }).first();
      const away = labels.some(label => label.includes('Settings')) ? 'Settings' : labels[0].trim();
      for (const label of targets.filter(target => labels.some(label => label.includes(target)))) {
        await nav(label).click();
        await page.waitForFunction(() => !/\bLoading\b|Calculating|Checking\.\.\./i.test(document.querySelector('.admin-content')?.innerText || ''));
        // Allow all data setters and passive effects to finish before leaving.
        await page.waitForTimeout(250);
        await nav(away).click();
        // Clear only request cache through the existing live-update event.
        await page.evaluate(() => window.dispatchEvent(new Event('vetintel:appointment-updated')));
        await page.evaluate(() => {
          window.__navigationLoading = [];
          window.__navigationObserver?.disconnect();
          window.__navigationObserver = new MutationObserver(() => {
            const text = document.querySelector('.admin-content')?.innerText || '';
            const loading = text.split('\n').filter(line => /\bLoading\b/i.test(line));
            if (loading.length) window.__navigationLoading.push(...loading);
          });
          window.__navigationObserver.observe(document.querySelector('.admin-content'), { childList: true, subtree: true, characterData: true });
        });
        await nav(label).click();
        await page.waitForTimeout(800);
        const loading = await page.evaluate(() => [...new Set(window.__navigationLoading)]);
        console.log(JSON.stringify({ role, page: label, loading }));
        if (loading.length) process.exitCode = 1;
      }
      if (labels.some(label => label.includes('Local Clinic Records'))) {
        await nav('Local Clinic Records').click();
        const tabs = await page.locator('.clinic-records-tabnav-item').allTextContents();
        for (const tab of tabs.map(text => text.trim())) {
          await page.getByRole('button', { name: tab, exact: true }).first().click();
          await page.waitForFunction(() => !/\bLoading\b/i.test(document.querySelector('.clinic-records-content')?.innerText || ''));
          await page.waitForTimeout(250);
          const other = tabs.map(text => text.trim()).find(text => text !== tab);
          await page.getByRole('button', { name: other, exact: true }).first().click();
          await page.evaluate(() => { window.__navigationLoading = []; });
          await page.getByRole('button', { name: tab, exact: true }).first().click();
          await page.waitForTimeout(800);
          const loading = await page.evaluate(() => [...new Set(window.__navigationLoading)]);
          console.log(JSON.stringify({ role, tab, loading }));
          if (loading.length) process.exitCode = 1;
        }
      }
      console.log(JSON.stringify({ role, errors }));
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await db.pool.end();
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
