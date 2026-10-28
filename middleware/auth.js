const crypto = require('crypto');

const authSecret = process.env.AUTH_SECRET;
if (!authSecret) throw new Error('AUTH_SECRET is not set in .env');

function base64UrlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload) {
  const finalPayload = { ...payload };
  if (!finalPayload.iat) {
    finalPayload.iat = Date.now();
  }
  const json = JSON.stringify(finalPayload);
  const signature = crypto.createHmac('sha256', authSecret).update(json).digest('hex');
  return `${base64UrlEncode(json)}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadEncoded, signature] = parts;
  let payloadJson;
  try {
    payloadJson = base64UrlDecode(payloadEncoded);
  } catch (e) {
    return null;
  }

  const expected = crypto.createHmac('sha256', authSecret).update(payloadJson).digest('hex');
  const valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  if (!valid) return null;

  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch (e) {
    return null;
  }

  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

module.exports = {
  optional: (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.slice(7);

    if (process.env.API_TOKEN && token === process.env.API_TOKEN) {
      req.user = { id: null, role: 'super_admin' };
      return next();
    }

    const payload = verifyToken(token);
    if (!payload) return next();

    req.user = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      clinic_id: payload.clinic_id,
      clinic_name: payload.clinic_name,
    };
    next();
  },

  required: (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.slice(7);

    if (process.env.API_TOKEN && token === process.env.API_TOKEN) {
      req.user = { id: null, role: 'super_admin' };
      console.log('auth.required: api token matched, granting super_admin');
      return next();
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      clinic_id: payload.clinic_id,
      clinic_name: payload.clinic_name,
    };
    console.log('auth.required: user token valid', { userId: req.user.id, role: req.user.role });
    next();
  },

  superAdmin: (req, res, next) => {
    const role = req.user && req.user.role ? req.user.role : null;
    if (role === 'super_admin') return next();
    return res.status(403).json({ error: 'Forbidden' });
  },

  signUserToken: (payload) => signPayload(payload),
};