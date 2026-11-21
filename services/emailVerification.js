const crypto = require('crypto');
const db = require('../config/db');
const mailer = require('../utils/mailer');
const failure = (message, status = 400, retryAfter) => Object.assign(new Error(message), { status, retryAfter });
const hash = (id, code) => crypto.createHmac('sha256', process.env.AUTH_SECRET).update(`${id}:${code}`).digest('hex');
exports.ensureSchema = () => db.query(require('fs').readFileSync(require('path').join(__dirname, '../scripts/pet_owner_verification_schema.sql'), 'utf8'));

exports.sendCode = async user => {
  const client = await db.pool.connect();
  const code = String(crypto.randomInt(100000, 1000000));
  const digest = hash(user.id, code);
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
    const existing = (await client.query('SELECT * FROM pet_owner_email_verifications WHERE user_id=$1', [user.id])).rows[0];
    if (existing?.sent_at && Date.now() - new Date(existing.sent_at).getTime() < 60000) throw failure('Please wait before requesting another code.', 429,
      Math.ceil((new Date(existing.sent_at).getTime() + 60000 - Date.now()) / 1000));
    const sameWindow = existing && Date.now() - new Date(existing.window_started_at).getTime() < 3600000;
    if (sameWindow && existing.send_count >= 5) throw failure('Too many code requests. Please try again later.', 429,
      Math.ceil((new Date(existing.window_started_at).getTime() + 3600000 - Date.now()) / 1000));
    await client.query(`INSERT INTO pet_owner_email_verifications(user_id,code_hash,expires_at,attempts,sent_at,send_count,window_started_at)
      VALUES($1,$2,now()+interval '10 minutes',0,now(),$3,$4)
      ON CONFLICT(user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0,
        sent_at=now(),send_count=EXCLUDED.send_count,window_started_at=EXCLUDED.window_started_at`,
    [user.id, digest, sameWindow ? existing.send_count + 1 : 1, sameWindow ? existing.window_started_at : new Date()]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  const delivery = await mailer.sendVerificationCode({ email: user.email, code });
  if (!delivery.sent) {
    console.warn(`[Verification email] ${delivery.errorCode || 'email_delivery_failed'}: ${delivery.reason || 'Provider did not accept the email.'}`);
    await db.query('UPDATE pet_owner_email_verifications SET sent_at=NULL WHERE user_id=$1 AND code_hash=$2', [user.id, digest]);
  }
  return { email_sent: delivery.sent, retry_after: delivery.sent ? 60 : 0,
    ...(!delivery.sent && { delivery_error: delivery.errorCode || 'email_delivery_failed' }) };
};

exports.verify = async (email, code) => {
  if (!/^\d{6}$/.test(String(code || ''))) throw failure('Enter the six-digit code from your email.');
  const client = await db.pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    // Match the send lock order so resend and verification cannot deadlock.
    const user = (await client.query(`SELECT * FROM users WHERE lower(trim(email))=$1 FOR UPDATE`, [email])).rows[0];
    if (!user || user.is_active === false || !user.email_verification_required || user.email_verified_at) throw failure('This code is invalid or has already been used.');
    const record = (await client.query('SELECT * FROM pet_owner_email_verifications WHERE user_id=$1 FOR UPDATE', [user.id])).rows[0];
    if (!record) throw failure('Request a new verification code.');
    if (new Date(record.expires_at).getTime() <= Date.now()) throw failure('This code has expired. Request a new code.', 410);
    if (record.attempts >= 5) throw failure('Too many incorrect codes. Request a new code.', 429);
    const actual = Buffer.from(hash(user.id, code), 'hex');
    const expected = Buffer.from(record.code_hash, 'hex');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      await client.query('UPDATE pet_owner_email_verifications SET attempts=attempts+1 WHERE user_id=$1', [user.id]);
      await client.query('COMMIT'); committed = true;
      throw failure('The verification code is incorrect.');
    }
    await client.query('UPDATE users SET email_verified_at=now(),updated_at=now() WHERE id=$1', [user.id]);
    await client.query('DELETE FROM pet_owner_email_verifications WHERE user_id=$1', [user.id]);
    await client.query('COMMIT'); committed = true;
    return { id: user.id, name: user.name, email: user.email, role: 'user', clinic_id: null, email_verified: true, password_reset_at: user.password_reset_at || null };
  } catch (error) { if (!committed) await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
