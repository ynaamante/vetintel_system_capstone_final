const db = require('../config/db');
const records = require('./clinicRecordController');

function clinicScope(req, res) {
  const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!['owner', 'clinic_owner', 'super_admin'].includes(role)) {
    res.status(403).json({ error: 'Clinic owner access is required.' }); return null;
  }
  const id = Number(role === 'super_admin' ? req.query.clinic_id || req.user.clinic_id : req.user.clinic_id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: 'Your account must be assigned to a clinic.' }); return null; }
  return id;
}

// Reuse the same read handlers as the doctor and receptionist screens.
async function read(handler, req) {
  let status = 200;
  let payload;
  await handler(req, { status(code) { status = code; return this; }, json(value) { payload = value; return this; } }, error => { throw error; });
  if (status >= 400) throw new Error(payload?.error || 'Unable to load clinic records.');
  return payload;
}

exports.summary = async (req, res, next) => {
  const clinicId = clinicScope(req, res);
  if (!clinicId) return;
  const scoped = { ...req, query: { clinic_id: String(clinicId) } };
  try {
    const entries = await Promise.all([
      ['pets', records.listPets], ['clients', records.listClients],
      ['appointments', records.listAppointments], ['invoices', records.listInvoices],
      ['payments', records.listPayments], ['vaccinations', records.listVaccinations],
      ['inventory', require('./inventoryController').list],
    ].map(async ([key, handler]) => [key, await read(handler, scoped)]));
    const [staff, activity] = await Promise.all([
      db.query(`SELECT u.id, u.name, r.name AS role, u.is_active FROM users u
        LEFT JOIN roles r ON r.id=u.role_id WHERE u.clinic_id=$1`, [clinicId]),
      // Overview needs only recent activity labels, never full record snapshots or file data.
      db.query(`SELECT a.id, a.action, a.created_at AS timestamp, COALESCE(u.name,u.email,'System') AS "user"
        FROM audit_trail a LEFT JOIN users u ON u.id=a.user_id
        WHERE COALESCE(a.archived,false)=false AND (
          a.new_data->>'clinic_id'=$1::text OR a.old_data->>'clinic_id'=$1::text
          OR (COALESCE(a.new_data->>'clinic_id',a.old_data->>'clinic_id') IS NULL AND u.clinic_id=$1::integer)
        ) ORDER BY a.created_at DESC, a.id DESC LIMIT 8`, [clinicId]),
    ]);
    res.json({ ...Object.fromEntries(entries), staff: staff.rows, activity: activity.rows, clinic_id: clinicId, checked_at: new Date().toISOString(), expenses_available: false });
  } catch (error) { next(error); }
};

exports.dataStatus = async (req, res, next) => {
  const clinicId = clinicScope(req, res);
  if (!clinicId) return;
  try {
    const result = await db.query(`SELECT
      (SELECT COUNT(*)::int FROM pets WHERE clinic_id=$1) AS patients,
      (SELECT COUNT(*)::int FROM appointments WHERE clinic_id=$1) AS appointments,
      (SELECT COUNT(*)::int FROM invoices WHERE clinic_id=$1) AS invoices,
      (SELECT COUNT(*)::int FROM payments WHERE clinic_id=$1) AS payments,
      (SELECT COUNT(*)::int FROM vaccinations WHERE clinic_id=$1) AS vaccinations,
      (SELECT MAX(created_at) FROM pets WHERE clinic_id=$1) AS latest_patient,
      (SELECT MAX(issued_at) FROM invoices WHERE clinic_id=$1) AS latest_invoice,
      (SELECT MAX(paid_at) FROM payments WHERE clinic_id=$1) AS latest_payment`, [clinicId]);
    res.json({ ...result.rows[0], checked_at: new Date().toISOString(), mode: 'shared_database', scheduled_sync_available: false });
  } catch (error) { next(error); }
};

exports.report = async (req, res, next) => {
  const clinicId = clinicScope(req, res);
  if (!clinicId) return;
  try {
    const summary = await read(records.getDiseaseIntelligenceSummary, { ...req, query: { ...req.query, clinic_id: String(clinicId) } });
    res.json({ ...summary, clinic_id: clinicId, generated_at: new Date().toISOString() });
  } catch (error) { next(error); }
};
