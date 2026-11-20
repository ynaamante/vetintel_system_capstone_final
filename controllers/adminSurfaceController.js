const db = require('../config/db');
const audit = require('../utils/audit');
const { sendMessageNotification, sendPurchaseOrder } = require('../utils/mailer');

const idOf = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

function writeAudit(req, action, table, id, oldData, newData) {
  audit.logAudit({
    user_id: req.user && req.user.id ? Number.parseInt(req.user.id, 10) : null,
    action,
    table_name: table,
    record_id: id,
    old_data: oldData,
    new_data: newData,
    ip_address: req.ip || req.connection.remoteAddress,
  });
}

function normalizeRequestedRole(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function staffLimitOf(value) {
  if (value == null || String(value).trim() === '') return null;
  if (String(value).trim().toLowerCase() === 'unlimited') return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

async function provisionClinicApplicationRoles(clinicId) {
  const clinicResult = await db.query(
    `SELECT name, metadata
     FROM clinics
     WHERE id = $1 AND lower(coalesce(metadata->>'status', '')) = 'active'`,
    [clinicId],
  );
  if (!clinicResult.rows.length) return;

  const requestedRoles = clinicResult.rows[0].metadata?.application?.requestedRoles;
  if (!Array.isArray(requestedRoles)) return;

  for (const requested of requestedRoles) {
    const roleName = normalizeRequestedRole(requested?.role || requested?.name || requested);
    if (!roleName || roleName === 'owner' || roleName === 'clinic_owner' || roleName === 'super_admin') continue;

    await db.query(
      `INSERT INTO roles (name, permissions)
       SELECT $1, '{}'::jsonb
       WHERE NOT EXISTS (SELECT 1 FROM roles WHERE lower(name) = lower($1))`,
      [roleName],
    );

    const existingRequest = await db.query(
      `SELECT id FROM role_requests
       WHERE clinic_id = $1 AND lower(regexp_replace(requested_role, '[\s-]+', '_', 'g')) = lower($2)
       LIMIT 1`,
      [clinicId, roleName],
    );
    if (existingRequest.rows.length) {
      await db.query(
        `UPDATE role_requests
         SET status = 'approved',
             reviewed_at = COALESCE(reviewed_at, now()),
             updated_at = now()
         WHERE id = $1`,
        [existingRequest.rows[0].id],
      );
    } else {
      await db.query(
        `INSERT INTO role_requests
          (clinic_id, clinic_name, requested_role, requested_users, reason, status, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, 'approved', now())`,
        [
          clinicId,
          clinicResult.rows[0].name,
          roleName,
          Math.max(1, Number(requested?.count || requested?.users) || 1),
          'Provisioned from the approved clinic application.',
        ],
      );
    }
  }
}

function list(table, order = 'created_at') {
  return async (req, res, next) => {
    try {
      const result = await db.query(`SELECT * FROM ${table} ORDER BY ${order} DESC`);
      res.json(result.rows);
    } catch (error) { next(error); }
  };
}

function detail(table) {
  return async (req, res, next) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    try {
      const result = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (error) { next(error); }
  };
}

async function updateStatus(req, res, next, table, statusColumn = 'status') {
  const id = idOf(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  const { status } = req.body;
  if (!status || typeof status !== 'string') return res.status(400).json({ error: 'status required' });
  try {
    const before = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (!before.rows.length) return res.status(404).json({ error: 'Not found' });
    const reviewFields = table === 'role_requests'
      ? ', reviewed_by = $3, reviewed_at = now()'
      : '';
    const params = table === 'role_requests'
      ? [status, id, req.user && req.user.id ? req.user.id : null]
      : [status, id];
    const result = await db.query(
      `UPDATE ${table} SET ${statusColumn} = $1, updated_at = now()${reviewFields} WHERE id = $2 RETURNING *`,
      params,
    );
    if (table === 'role_requests' && String(status).toLowerCase() === 'approved') {
      const requestedRole = String(result.rows[0].requested_role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      if (requestedRole) {
        await db.query(
          `INSERT INTO roles (name, permissions)
           SELECT $1, '{}'::jsonb
           WHERE NOT EXISTS (SELECT 1 FROM roles WHERE lower(name) = lower($1))`,
          [requestedRole],
        );
      }
    }
    writeAudit(req, `Updated ${table} status`, table, id, before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) { next(error); }
}

exports.roleRequests = {
  list: async (req, res, next) => {
    try {
      const result = await db.query(`
        SELECT rr.*,
               COALESCE(
                 NULLIF(BTRIM(c.owner), ''),
                 NULLIF(BTRIM(c.metadata->'application'->>'ownerName'), ''),
                 NULLIF(BTRIM(clinic_owner.name), ''),
                 '—'
               ) AS owner
        FROM role_requests rr
        LEFT JOIN clinics c ON c.id = rr.clinic_id
        LEFT JOIN LATERAL (
          SELECT u.name
          FROM users u
          LEFT JOIN roles r ON r.id = u.role_id
          WHERE u.clinic_id = c.id
            AND LOWER(COALESCE(r.name, '')) IN ('clinic_owner', 'owner')
          ORDER BY u.is_active DESC, u.id
          LIMIT 1
        ) clinic_owner ON TRUE
        ORDER BY rr.created_at DESC
      `);
      res.json(result.rows);
    } catch (error) { next(error); }
  },
  detail: async (req, res, next) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    try {
      const result = await db.query(`
        SELECT rr.*,
               COALESCE(
                 NULLIF(BTRIM(c.owner), ''),
                 NULLIF(BTRIM(c.metadata->'application'->>'ownerName'), ''),
                 NULLIF(BTRIM(clinic_owner.name), ''),
                 '—'
               ) AS owner,
               COALESCE(
                 NULLIF(BTRIM(c.metadata->'application'->>'ownerEmail'), ''),
                 NULLIF(BTRIM(c.email), ''),
                 NULLIF(BTRIM(clinic_owner.email), ''),
                 '—'
               ) AS owner_email,
               COALESCE(
                 NULLIF(BTRIM(c.metadata->'application'->>'ownerPhone'), ''),
                 NULLIF(BTRIM(c.phone), ''),
                 NULLIF(BTRIM(clinic_owner.phone), ''),
                 '—'
               ) AS owner_phone,
               COALESCE(NULLIF(BTRIM(c.address), ''), '—') AS clinic_address,
               c.name AS resolved_clinic_name,
               reviewer.name AS reviewer_name,
               reviewer.email AS reviewer_email
        FROM role_requests rr
        LEFT JOIN clinics c ON c.id = rr.clinic_id
        LEFT JOIN LATERAL (
          SELECT u.name, u.email, u.phone
          FROM users u
          LEFT JOIN roles r ON r.id = u.role_id
          WHERE u.clinic_id = c.id
            AND LOWER(COALESCE(r.name, '')) IN ('clinic_owner', 'owner')
          ORDER BY u.is_active DESC, u.id
          LIMIT 1
        ) clinic_owner ON TRUE
        LEFT JOIN users reviewer ON reviewer.id = rr.reviewed_by
        WHERE rr.id = $1
        LIMIT 1
      `, [id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (error) { next(error); }
  },
  status: (req, res, next) => updateStatus(req, res, next, 'role_requests'),
  listMine: async (req, res, next) => {
    try {
      const clinicId = req.user && Number.parseInt(req.user.clinic_id, 10);
      if (!clinicId) return res.json([]);
      await provisionClinicApplicationRoles(clinicId);
      const result = await db.query(
        'SELECT * FROM role_requests WHERE clinic_id = $1 ORDER BY created_at DESC',
        [clinicId],
      );
      res.json(result.rows);
    } catch (error) { next(error); }
  },
  createMine: async (req, res, next) => {
    try {
      const clinicId = req.user && Number.parseInt(req.user.clinic_id, 10);
      const { requested_role, requested_users = 1, reason = '' } = req.body || {};
      if (!clinicId) return res.status(400).json({ error: 'A clinic is required to request a role' });
      if (!requested_role || !String(requested_role).trim()) return res.status(400).json({ error: 'requested_role is required' });
      const clinic = await db.query('SELECT name FROM clinics WHERE id = $1', [clinicId]);
      if (!clinic.rows.length) return res.status(404).json({ error: 'Clinic not found' });
      const result = await db.query(
        `INSERT INTO role_requests (clinic_id, clinic_name, requested_role, requested_users, reason)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [clinicId, clinic.rows[0].name, String(requested_role).trim(), Math.max(1, Number(requested_users) || 1), reason],
      );
      res.status(201).json(result.rows[0]);
    } catch (error) { next(error); }
  },
};

exports.plans = {
  list: async (req, res, next) => {
    try {
      const result = await db.query(`
        SELECT sp.*,
               (
                 SELECT COUNT(*)::int
                 FROM clinics c
                 WHERE COALESCE(c.archived, false) = false
                   AND LOWER(BTRIM(COALESCE(
                     NULLIF(c.metadata->'application'->>'plan', ''),
                     NULLIF(c.metadata->>'plan', '')
                   ))) = LOWER(BTRIM(sp.name))
               ) AS subscribed_clinics
        FROM subscription_plans sp
        ORDER BY sp.created_at DESC
      `);
      res.json(result.rows);
    } catch (error) { next(error); }
  },
  create: async (req, res, next) => {
    try {
      const { name, description = '', price = null, annual_price = null, annualPrice, staff_limit = null, staffLimit, features = [], billing_cycle = 'monthly', active = true, status } = req.body;
      if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
      const normalizedStaffLimit = staffLimitOf(staff_limit == null ? staffLimit : staff_limit);
      if (normalizedStaffLimit === undefined) return res.status(400).json({ error: 'staff_limit must be a non-negative number or Unlimited' });
      const result = await db.query(
        `INSERT INTO subscription_plans
          (name, description, price, annual_price, staff_limit, features, billing_cycle, active, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [String(name).trim(), description, price, annual_price == null ? annualPrice || null : annual_price,
          normalizedStaffLimit,
          JSON.stringify(Array.isArray(features) ? features : []), billing_cycle, Boolean(active), status || (active ? 'active' : 'inactive')],
      );
      writeAudit(req, 'Created subscription plan', 'subscription_plans', result.rows[0].id, null, result.rows[0]);
      res.status(201).json(result.rows[0]);
    } catch (error) { next(error); }
  },
  update: async (req, res, next) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    try {
      const before = await db.query('SELECT * FROM subscription_plans WHERE id = $1', [id]);
      if (!before.rows.length) return res.status(404).json({ error: 'Plan not found' });
      const body = req.body;
      const suppliedStaffLimit = body.staff_limit == null ? body.staffLimit : body.staff_limit;
      const normalizedStaffLimit = staffLimitOf(suppliedStaffLimit);
      if (normalizedStaffLimit === undefined) return res.status(400).json({ error: 'staff_limit must be a non-negative number or Unlimited' });
      const result = await db.query(
        `UPDATE subscription_plans SET
          name = COALESCE($1,name), description = COALESCE($2,description), price = COALESCE($3,price),
          annual_price = COALESCE($4,annual_price), staff_limit = COALESCE($5,staff_limit), features = COALESCE($6,features),
          billing_cycle = COALESCE($7,billing_cycle), active = COALESCE($8,active),
          status = COALESCE($9,status), updated_at = now()
         WHERE id = $10 RETURNING *`,
        [body.name, body.description, body.price, body.annual_price == null ? body.annualPrice : body.annual_price,
          normalizedStaffLimit,
          body.features == null ? null : JSON.stringify(body.features), body.billing_cycle,
          body.active, body.status, id],
      );
      writeAudit(req, 'Updated subscription plan', 'subscription_plans', id, before.rows[0], result.rows[0]);
      res.json(result.rows[0]);
    } catch (error) { next(error); }
  },
  status: (req, res, next) => updateStatus(req, res, next, 'subscription_plans'),
};

exports.demoRequests = {
  create: async (req, res, next) => {
    try {
      const b = req.body;
      if (!b.clinic_name || !b.contact_name || !b.email || !b.phone || !b.preferred_date || !b.preferred_time) {
        return res.status(400).json({ error: 'Clinic, contact, email, phone, date, and time are required' });
      }
      const result = await db.query(
        `INSERT INTO demo_requests
          (clinic_name, contact_name, phone, email, staff_count, preferred_date, preferred_time, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [b.clinic_name, b.contact_name, b.phone, b.email, b.staff_count || null, b.preferred_date, b.preferred_time, b.notes || null],
      );
      res.status(201).json(result.rows[0]);
    } catch (error) { next(error); }
  },
  list: list('demo_requests'),
  detail: detail('demo_requests'),
  update: async (req, res, next) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    try {
      const before = await db.query('SELECT * FROM demo_requests WHERE id = $1', [id]);
      if (!before.rows.length) return res.status(404).json({ error: 'Demo request not found' });
      const b = req.body;
      const result = await db.query(
        `UPDATE demo_requests SET clinic_name=COALESCE($1,clinic_name), contact_name=COALESCE($2,contact_name),
          phone=COALESCE($3,phone), email=COALESCE($4,email), staff_count=COALESCE($5,staff_count),
          preferred_date=COALESCE($6,preferred_date), preferred_time=COALESCE($7,preferred_time),
          address=COALESCE($8,address), notes=COALESCE($9,notes), status=COALESCE($10,status), updated_at=now()
         WHERE id=$11 RETURNING *`,
        [b.clinic_name || b.clinic, b.contact_name || b.contact, b.phone, b.email, b.staff_count || b.staff,
          b.preferred_date || b.preferredDate, b.preferred_time || b.preferredTime, b.address, b.notes, b.status, id],
      );
      writeAudit(req, 'Updated demo request', 'demo_requests', id, before.rows[0], result.rows[0]);
      res.json(result.rows[0]);
    } catch (error) { next(error); }
  },
  status: (req, res, next) => updateStatus(req, res, next, 'demo_requests'),
};

exports.messages = {
  create: async (req, res, next) => {
    try {
      const b = req.body;
      if (!req.user || !req.user.email || !b.body) {
        return res.status(400).json({ error: 'A signed-in account and message are required' });
      }
      const result = await db.query(
        `INSERT INTO messages (sender_name, sender_email, audience, subject, body)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.user.name || req.user.email, req.user.email, b.audience || req.user.role || null, b.subject || 'Message to VetIntel Admin', String(b.body).trim()],
      );
      res.status(201).json(result.rows[0]);
    } catch (error) { next(error); }
  },
  list: list('messages'),
  mine: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT m.*, COALESCE(json_agg(r ORDER BY r.created_at) FILTER (WHERE r.id IS NOT NULL), '[]') AS replies
         FROM messages m LEFT JOIN message_replies r ON r.message_id = m.id
         WHERE lower(m.sender_email) = lower($1)
         GROUP BY m.id ORDER BY m.created_at DESC`,
        [req.user.email],
      );
      res.json(result.rows);
    } catch (error) { next(error); }
  },
  detail: async (req, res, next) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    try {
      const message = await db.query('SELECT * FROM messages WHERE id=$1', [id]);
      if (!message.rows.length) return res.status(404).json({ error: 'Message not found' });
      const replies = await db.query('SELECT * FROM message_replies WHERE message_id=$1 ORDER BY created_at ASC', [id]);
      res.json({ ...message.rows[0], replies: replies.rows });
    } catch (error) { next(error); }
  },
  read: async (req, res, next) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    try {
      const result = await db.query('UPDATE messages SET is_read=true, read_at=now(), updated_at=now() WHERE id=$1 RETURNING *', [id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Message not found' });
      res.json(result.rows[0]);
    } catch (error) { next(error); }
  },
  reply: async (req, res, next) => {
    const messageId = idOf(req.params.id);
    if (!messageId) return res.status(400).json({ error: 'invalid id' });
    const body = req.body.body || req.body.content;
    if (!body || !String(body).trim()) return res.status(400).json({ error: 'reply body required' });
    try {
      const parent = await db.query('SELECT id FROM messages WHERE id=$1', [messageId]);
      if (!parent.rows.length) return res.status(404).json({ error: 'Message not found' });
      const result = await db.query(
        `INSERT INTO message_replies (message_id, body, author_id, created_at)
         VALUES ($1,$2,$3,now()) RETURNING *`,
        [messageId, String(body).trim(), req.user && req.user.id ? req.user.id : null],
      );
      await db.query('UPDATE messages SET is_read=true, read_at=COALESCE(read_at,now()), updated_at=now() WHERE id=$1', [messageId]);
      const message = await db.query('SELECT sender_email, sender_name, subject FROM messages WHERE id=$1', [messageId]);
      if (message.rows[0]) {
        const notification = await sendMessageNotification({
          email: message.rows[0].sender_email,
          senderName: message.rows[0].sender_name,
          subject: message.rows[0].subject,
        });
        result.rows[0].emailSent = notification.sent;
      }
      writeAudit(req, 'Replied to message', 'messages', messageId, null, result.rows[0]);
      res.status(201).json(result.rows[0]);
    } catch (error) { next(error); }
  },
};

exports.purchaseOrders = {
  send: async (req, res, next) => {
    try {
      const { email, supplier, purchaseOrderId, requestedBy, expectedDeliveryDate = '', notes = '' } = req.body || {};
      if (!email || !supplier || !purchaseOrderId || !requestedBy) {
        return res.status(400).json({ error: 'Supplier email, supplier, purchase order ID, and requester are required' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        return res.status(400).json({ error: 'A valid supplier email is required' });
      }
      const result = await sendPurchaseOrder({
        email: String(email).trim(),
        supplier: String(supplier).trim(),
        purchaseOrderId: String(purchaseOrderId).trim(),
        requestedBy: String(requestedBy).trim(),
        expectedDeliveryDate: String(expectedDeliveryDate).trim(),
        notes: String(notes).trim(),
      });
      if (!result.sent) return res.status(503).json({ error: result.reason });
      res.json({ sent: true, purchaseOrderId });
    } catch (error) { next(error); }
  },
};
