const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { reminderEmailConfigured, sendClinicReminder } = require('../utils/mailer');
const { reminderEmail } = require('../utils/reminderEmail');

async function main() {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const originalCreateTransport = nodemailer.createTransport;
  try {
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'SENDER_EMAIL']) delete process.env[key];
    assert.equal(reminderEmailConfigured(), false);
    process.env.BREVO_API_KEY = 'test-key';
    assert.equal(reminderEmailConfigured(), false);
    process.env.SENDER_EMAIL = 'clinic@example.invalid';
    assert.equal(reminderEmailConfigured(), true);
    const reminder = {
      clinicName: 'Happy Paws Clinic', address: 'Sta. Maria, Bulacan', phone: '(02) 8123 4567',
      email: 'appointments@example.invalid', ownerName: 'Yna & family', petName: 'Pearl <3',
      service: 'Grooming', dueDate: 'October 26, 2026',
    };
    const { text, html } = reminderEmail(reminder);
    assert.match(html, /Hello Yna &amp; family/);
    assert.match(html, /A reminder for Pearl &lt;3/);
    assert.match(html, /Grooming/);
    assert.match(html, /October 26, 2026/);
    assert.match(html, /href="mailto:appointments@example.invalid\?subject=Appointment%20request%20for%20Pearl%20%3C3"/);
    assert.match(reminderEmail({ ...reminder, email: null }).html, /href="tel:0281234567"[^>]+>Book an appointment/);
    assert.doesNotMatch(reminderEmail({ ...reminder, email: null, phone: null }).html, /Book an appointment/);
    assert.match(text, /Service: Grooming/);
    let requests = 0;
    global.fetch = async (url, options) => {
      requests++;
      assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
      assert.equal(options.headers['api-key'], 'test-key');
      const body = JSON.parse(options.body);
      assert.equal(body.sender.email, 'clinic@example.invalid');
      assert.equal(body.to[0].email, 'owner@example.invalid');
      assert.equal(body.textContent, text);
      assert.equal(body.htmlContent, html);
      return { ok: true, json: async () => ({ messageId: 'mock-message' }) };
    };
    const input = { email: 'owner@example.invalid', clinicName: reminder.clinicName, message: text, html };
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
    nodemailer.createTransport = () => ({
      async sendMail(options) {
        assert.equal(options.to, input.email);
        assert.equal(options.text, text);
        assert.equal(options.html, html);
        return { accepted: [options.to], messageId: 'mock-smtp-message' };
      },
    });
    assert.deepEqual(await sendClinicReminder(input), { sent: true, messageId: 'mock-smtp-message' });
    console.log('Reminder template and Brevo/SMTP payload checks passed (mocked delivery).');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    global.fetch = originalFetch;
    nodemailer.createTransport = originalCreateTransport;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
