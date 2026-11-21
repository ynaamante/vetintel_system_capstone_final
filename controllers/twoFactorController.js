const crypto = require('crypto');
const db = require('../config/db');
const { sendTwoFactorCode, sendTwoFactorSms } = require('../utils/mailer');

const challenges = new Map();
const codeLifetimeMs = 10 * 60 * 1000;
const resendDelayMs = 60 * 1000;
const maxAttempts = 5;

function getSuperAdminId(req, res) {
  const role = String(req.user?.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const id = Number(req.user?.id);
  if (role !== 'super_admin' || !Number.isInteger(id) || id < 1) {
    res.status(403).json({ error: 'Only a signed-in super admin can manage two-factor authentication.' });
    return null;
  }
  return id;
}

function settingKey(userId) {
  return `two_factor_enabled_${userId}`;
}

function hashCode(userId, code) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET).update(`${userId}:${code}`).digest();
}

async function getUser(userId) {
  const result = await db.query('SELECT id, email, phone FROM users WHERE id = $1 AND is_active = true', [userId]);
  return result.rows[0] || null;
}

async function saveStatus(userId, value) {
  const key = settingKey(userId);
  const serializedValue = JSON.stringify(value);
  const updated = await db.query(
    'UPDATE settings SET value = $1::jsonb, updated_at = now() WHERE clinic_id IS NULL AND key = $2 RETURNING id',
    [serializedValue, key]
  );
  if (updated.rows.length === 0) {
    await db.query('INSERT INTO settings (clinic_id, key, value, updated_at) VALUES (NULL, $1, $2::jsonb, now())', [key, serializedValue]);
  }
}

exports.status = async (req, res, next) => {
  try {
    const userId = getSuperAdminId(req, res);
    if (!userId) return;
    const user = await getUser(userId);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    const result = await db.query('SELECT value FROM settings WHERE clinic_id IS NULL AND key = $1 ORDER BY id DESC LIMIT 1', [settingKey(userId)]);
    const value = result.rows[0]?.value;
    res.json({ enabled: value?.enabled === true, method: value?.method || null, email: user.email || '', phone: user.phone || '' });
  } catch (error) {
    next(error);
  }
};

exports.sendCode = async (req, res, next) => {
  try {
    const userId = getSuperAdminId(req, res);
    if (!userId) return;
    const method = req.body?.method;
    if (method !== 'email' && method !== 'phone') return res.status(400).json({ error: 'Choose email or phone verification.' });
    const user = await getUser(userId);
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    const phone = String(req.body?.phone || user.phone || '').trim();
    if (method === 'phone' && !/^\+[1-9]\d{7,14}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid phone number in international format, such as +639171234567.' });
    }
    if (method === 'email' && !user.email) return res.status(400).json({ error: 'Your account does not have an email address.' });

    const challengeKey = `${userId}:${method}`;
    const previous = challenges.get(challengeKey);
    if (previous && Date.now() - previous.sentAt < resendDelayMs) {
      const waitSeconds = Math.ceil((resendDelayMs - (Date.now() - previous.sentAt)) / 1000);
      return res.status(429).json({ error: `Please wait ${waitSeconds} seconds before requesting another code.` });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const destination = method === 'email' ? user.email : phone;
    if (method === 'email') await sendTwoFactorCode({ email: destination, code });
    else await sendTwoFactorSms({ phone: destination, code });

    challenges.set(challengeKey, { hash: hashCode(userId, code), destination, method, sentAt: Date.now(), expiresAt: Date.now() + codeLifetimeMs, attempts: 0 });
    res.json({ success: true, expiresInSeconds: codeLifetimeMs / 1000, destination });
  } catch (error) {
    if (/not configured|could not send|unavailable/i.test(String(error.message))) return res.status(503).json({ error: error.message });
    next(error);
  }
};

exports.verifyCode = async (req, res, next) => {
  try {
    const userId = getSuperAdminId(req, res);
    if (!userId) return;
    const method = req.body?.method;
    const code = String(req.body?.code || '').trim();
    if ((method !== 'email' && method !== 'phone') || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the six-digit verification code.' });
    }
    const challengeKey = `${userId}:${method}`;
    const challenge = challenges.get(challengeKey);
    if (!challenge || challenge.expiresAt < Date.now()) {
      challenges.delete(challengeKey);
      return res.status(400).json({ error: 'The verification code expired. Send a new code to continue.' });
    }
    if (challenge.attempts >= maxAttempts) {
      challenges.delete(challengeKey);
      return res.status(429).json({ error: 'Too many incorrect attempts. Send a new code to continue.' });
    }
    challenge.attempts += 1;
    const submittedHash = hashCode(userId, code);
    if (!crypto.timingSafeEqual(challenge.hash, submittedHash)) {
      if (challenge.attempts >= maxAttempts) challenges.delete(challengeKey);
      return res.status(400).json({ error: 'That verification code is incorrect.' });
    }

    const user = await getUser(userId);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if (method === 'phone') await db.query('UPDATE users SET phone = $1 WHERE id = $2', [challenge.destination, userId]);
    await saveStatus(userId, { enabled: true, method, verifiedAt: new Date().toISOString(), destination: challenge.destination });
    challenges.delete(challengeKey);
    res.json({ success: true, enabled: true });
  } catch (error) {
    next(error);
  }
};

exports.disable = async (req, res, next) => {
  try {
    const userId = getSuperAdminId(req, res);
    if (!userId) return;
    const user = await getUser(userId);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    await saveStatus(userId, { enabled: false });
    challenges.delete(`${userId}:email`);
    challenges.delete(`${userId}:phone`);
    res.json({ success: true, enabled: false });
  } catch (error) {
    next(error);
  }
};
