const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../utils/mailer.js'), 'utf8');
async function scenario(status, payload) {
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: () => ({}), AbortSignal,
    process: { env: { BREVO_API_KEY: 'test-key-never-expose', SENDER_EMAIL: 'verified@example.test' } },
    fetch: async () => ({ ok: status >= 200 && status < 300, status, json: async () => payload }),
  });
  return module.exports.sendVerificationCode({ email: 'owner@example.test', code: '123456' });
}
(async () => {
  assert.equal((await scenario(201, { messageId: 'accepted-message' })).sent, true);
  const blocked = await scenario(401, { code: 'unauthorized', message: 'We have detected you are using an unrecognised IP address.' });
  assert.equal(blocked.sent, false); assert.equal(blocked.errorCode, 'email_ip_not_authorized');
  assert.equal((await scenario(401, { code: 'unauthorized', message: 'Key not found' })).errorCode, 'email_api_key_invalid');
  assert.equal((await scenario(403, { code: 'permission_denied' })).errorCode, 'email_permission_denied');
  assert.equal((await scenario(429, {})).errorCode, 'email_rate_limited');
  assert.equal((await scenario(400, { code: 'invalid_parameter' })).sent, false);
  assert.equal((await scenario(201, {})).sent, false, 'A missing provider message ID is not reported as sent.');
  assert.ok(!JSON.stringify(blocked).includes('test-key-never-expose'));
  console.log('PASS: Brevo acceptance, IP rejection, invalid key, denied permissions, rate limits, invalid responses, and safe diagnostics. No emails sent.');
})().catch(error => { console.error(error); process.exitCode = 1; });
