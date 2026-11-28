const crypto = require('crypto');
const db = require('../config/db');
const { sendTwoFactorCode } = require('../utils/mailer');

const emailChallenges = new Map();
const challengeLifetimeMs = 10 * 60 * 1000;
const resendDelayMs = 60 * 1000;
const maxAttempts = 5;

function getSuperAdminId(req, res) {
  const role = String(req.user?.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const id = Number(req.user?.id);
  if (role !== 'super_admin' || !Number.isInteger(id) || id < 1) {
    res.status(403).json({ error: 'Only a signed-in super admin can update this profile.' });
    return null;
  }
  return id;
}

function profileQuery(userId) {
  return db.query(
    `SELECT u.id, u.name, u.email, u.is_active, u.created_at,
            COALESCE(u.metadata->>'profile_avatar', '') AS avatar,
            COALESCE(r.name, 'Super Admin') AS role
     FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [userId]
  );
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function codeHash(userId, email, code) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET).update(`${userId}:${email}:${code}`).digest();
}

function validateProfile(name, avatar, res) {
  if (!name || name.length > 120) {
    res.status(400).json({ error: 'Enter a name between 1 and 120 characters.' });
    return false;
  }
  if (avatar !== null && avatar !== undefined && avatar !== '' && (typeof avatar !== 'string' || !avatar.startsWith('data:image/'))) {
    res.status(400).json({ error: 'Choose a valid image file.' });
    return false;
  }
  return true;
}

async function ensureEmailAvailable(email, userId) {
  const result = await db.query('SELECT id FROM users WHERE lower(trim(email)) = $1 AND id <> $2 LIMIT 1', [email, userId]);
  return result.rows.length === 0;
}

async function saveProfile(userId, { name, email, avatar }) {
  const avatarJson = JSON.stringify(avatar ?? null);
  const result = await db.query(
    `UPDATE users SET name = $1, email = $2,
       metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('profile_avatar', $3::jsonb),
       updated_at = now()
     WHERE id = $4 RETURNING id`,
    [name, email, avatarJson, userId]
  );
  return result.rows.length > 0;
}

exports.get = async (req, res, next) => {
  try {
    const userId = getSuperAdminId(req, res);
    if (!userId) return;
    const result = await profileQuery(userId);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const userId = getSuperAdminId(req, res);
    if (!userId) return;
    const name = String(req.body?.name || '').trim();
    const avatar = req.body?.avatar ?? null;
    if (!validateProfile(name, avatar, res)) return;
    if (req.body?.email !== undefined) return res.status(400).json({ error: 'Email changes require verification.' });
    const current = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Account not found.' });
    if (!await saveProfile(userId, { name, email: current.rows[0].email, avatar })) return res.status(404).json({ error: 'Account not found.' });
    const result = await profileQuery(userId);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.sendEmailCode = async (req, res, next) => {
  try {
    const userId = getSuperAdminId(req, res);
    if (!userId) return;
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const current = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Account not found.' });
    if (normalizeEmail(current.rows[0].email) === email) return res.status(400).json({ error: 'This is already your current email address.' });
    if (!await ensureEmailAvailable(email, userId)) return res.status(409).json({ error: 'That email address is already in use.' });

    const previous = emailChallenges.get(userId);
    if (previous && Date.now() - previous.sentAt < resendDelayMs) {
      const waitSeconds = Math.ceil((resendDelayMs - (Date.now() - previous.sentAt)) / 1000);
      return res.status(429).json({ error: `Please wait ${waitSeconds} seconds before requesting another code.` });
    }
    const code = String(crypto.randomInt(100000, 1000000));
    await sendTwoFactorCode({ email, code });
    emailChallenges.set(userId, { email, hash: codeHash(userId, email, code), sentAt: Date.now(), expiresAt: Date.now() + challengeLifetimeMs, attempts: 0 });
    res.json({ success: true, expiresInSeconds: challengeLifetimeMs / 1000, destination: email });
  } catch (error) {
    if (/not configured|could not send|unavailable/i.test(String(error.message))) return res.status(503).json({ error: error.message });
    next(error);
  }
};

exports.verifyEmailCode = async (req, res, next) => {
  try {
    const userId = getSuperAdminId(req, res);
    if (!userId) return;
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const name = String(req.body?.name || '').trim();
    const avatar = req.body?.avatar ?? null;
    if (!validateProfile(name, avatar, res)) return;
    if (!validEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter a valid email and its six-digit code.' });
    const challenge = emailChallenges.get(userId);
    if (!challenge || challenge.expiresAt < Date.now() || challenge.email !== email) {
      emailChallenges.delete(userId);
      return res.status(400).json({ error: 'The verification code expired or does not match this email. Send a new code to continue.' });
    }
    if (challenge.attempts >= maxAttempts) {
      emailChallenges.delete(userId);
      return res.status(429).json({ error: 'Too many incorrect attempts. Send a new code to continue.' });
    }
    challenge.attempts += 1;
    if (!crypto.timingSafeEqual(challenge.hash, codeHash(userId, email, code))) {
      if (challenge.attempts >= maxAttempts) emailChallenges.delete(userId);
      return res.status(400).json({ error: 'That verification code is incorrect.' });
    }
    if (!await ensureEmailAvailable(email, userId)) return res.status(409).json({ error: 'That email address is already in use.' });
    if (!await saveProfile(userId, { name, email, avatar })) return res.status(404).json({ error: 'Account not found.' });
    emailChallenges.delete(userId);
    const result = await profileQuery(userId);
    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That email address is already in use.' });
    next(error);
  }
};
