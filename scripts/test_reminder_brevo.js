const assert = require('node:assert/strict');
const { reminderEmailConfigured, sendClinicReminder } = require('../utils/mailer');

async function main() {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  try {
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'SENDER_EMAIL']) delete process.env[key];
    assert.equal(reminderEmailConfigured(), false);
    process.env.BREVO_API_KEY = 'test-key';
    assert.equal(reminderEmailConfigured(), false);
    process.env.SENDER_EMAIL = 'clinic@example.invalid';
    assert.equal(reminderEmailConfigured(), true);
    let requests = 0;
    global.fetch = async (url, options) => {
      requests++;
      assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
      assert.equal(options.headers['api-key'], 'test-key');
      const body = JSON.parse(options.body);
      assert.equal(body.sender.email, 'clinic@example.invalid');
      assert.equal(body.to[0].email, 'owner@example.invalid');
      assert.equal(body.textContent, 'Vaccination is due.');
      return { ok: true, json: async () => ({ messageId: 'mock-message' }) };
    };
    const input = { email: 'owner@example.invalid', clinicName: 'Test clinic', message: 'Vaccination is due.' };
    assert.deepEqual(await sendClinicReminder(input), { sent: true, messageId: 'mock-message' });
    assert.equal(requests, 1);
    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: 'private provider detail' }) });
    const rejected = await sendClinicReminder(input);
    assert.equal(rejected.sent, false);
    assert.match(rejected.reason, /rejected the API key/);
    assert.doesNotMatch(rejected.reason, /private provider detail/);
    global.fetch = async () => ({ ok: false, status: 403, json: async () => ({ code: 'permission_denied' }) });
    assert.match((await sendClinicReminder(input)).reason, /permission to send transactional emails/);
    global.fetch = async () => { throw new Error('network'); };
    assert.equal((await sendClinicReminder(input)).sent, false);
    delete process.env.BREVO_API_KEY;
    process.env.SMTP_HOST = 'smtp.example.invalid';
    process.env.SMTP_USER = 'test';
    process.env.SMTP_PASSWORD = 'test';
    assert.equal(reminderEmailConfigured(), true);
    console.log('Brevo reminder checks passed (mocked requests; no email sent).');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    global.fetch = originalFetch;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
