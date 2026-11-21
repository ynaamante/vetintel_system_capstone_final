const db = require('../config/db');
const { publish } = require('../utils/clinicEvents');
const { makeThread } = require('../utils/ownerInbox');
function scope(req, res) {
  const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const clinic = Number(req.user?.clinic_id);
  if (!['owner', 'clinic_owner', 'doctor', 'assistant_doctor', 'veterinarian', 'receptionist'].includes(role) || !Number.isInteger(clinic) || clinic < 1) { res.status(403).json({ error: 'Clinic staff access is required.' }); return null; }
  return clinic;
}
exports.patients = async (req, res, next) => {
  const clinic = scope(req, res); if (!clinic) return;
  try {
    const result = await db.query(`SELECT p.id,p.name AS pet,c.name AS owner FROM pets p
      JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id WHERE p.clinic_id=$1
      AND COALESCE((p.metadata->>'archived')::boolean,false)=false ORDER BY p.name,c.name`, [clinic]);
    res.json(result.rows);
  } catch (error) { next(error); }
};
exports.list = async (req, res, next) => {
  const clinic = scope(req, res); if (!clinic) return;
  try {
    const [threads, staff] = await Promise.all([
      db.query(`SELECT s.value || jsonb_build_object('name', c.name, 'phone', COALESCE(c.phone,''), 'pet', p.name, 'breed', p.breed,
        'clinicName', cl.name, 'nextAppointment', (SELECT a.start_time FROM appointments a WHERE a.pet_id=p.id AND a.clinic_id=p.clinic_id
          AND a.start_time>=now() AND COALESCE(a.archived,false)=false AND a.status::text NOT IN ('cancelled','completed','no_show') ORDER BY a.start_time LIMIT 1)) AS value
        FROM settings s JOIN pets p ON p.clinic_id=s.clinic_id AND s.key='clinic_inbox:pet-' || p.id::text
        JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id JOIN clinics cl ON cl.id=p.clinic_id
        WHERE s.clinic_id=$1 ORDER BY s.updated_at DESC`, [clinic]),
      db.query('SELECT id, name FROM users WHERE clinic_id=$1 AND COALESCE(is_active,true) ORDER BY name', [clinic]),
    ]);
    res.json({ conversations: threads.rows.map(row => row.value), staff: staff.rows });
  } catch (error) { next(error); }
};
exports.create = async (req, res, next) => {
  const clinic = scope(req, res); if (!clinic) return;
  const petId = Number(req.body.pet_id);
  if (!Number.isInteger(petId) || petId < 1) return res.status(400).json({ error: 'Select a saved clinic patient to start a conversation.' });
  try {
    const row = (await db.query(`SELECT p.id, p.name AS pet, p.species, p.breed, p.sex, p.birth_date, p.metadata,
      c.id AS client_id, c.name, c.phone, cl.name AS clinic_name FROM pets p JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id
      JOIN clinics cl ON cl.id=p.clinic_id WHERE p.id=$1 AND p.clinic_id=$2`, [petId, clinic])).rows[0];
    if (!row) return res.status(404).json({ error: 'Patient not found in your clinic.' });
    const id = `pet-${row.id}`;
    const thread = makeThread(row, req.user.name || 'Clinic team');
    const result = await db.query(`INSERT INTO settings (clinic_id,key,value) VALUES ($1,$2,$3::jsonb)
      ON CONFLICT (clinic_id,key) DO UPDATE SET key=EXCLUDED.key RETURNING value`, [clinic, `clinic_inbox:${id}`, JSON.stringify(thread)]);
    publish(clinic, 'inbox-updated');
    res.json(result.rows[0].value);
  } catch (error) { next(error); }
};
exports.update = async (req, res, next) => {
  const clinic = scope(req, res); if (!clinic) return;
  if (!/^pet-\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid conversation.' });
  const patch = {};
  for (const key of ['status', 'assignedTo', 'unread']) if (req.body[key] !== undefined) patch[key] = req.body[key];
  if (patch.status !== undefined && !['Open', 'In Progress', 'Resolved'].includes(patch.status)) return res.status(400).json({ error: 'Invalid conversation status.' });
  if (patch.unread !== undefined && typeof patch.unread !== 'boolean') return res.status(400).json({ error: 'Invalid read status.' });
  const text = req.body.text === undefined ? null : String(req.body.text).trim();
  const kind = req.body.kind || 'reply';
  if (!['reply', 'internal_note', 'communication_log'].includes(kind)) return res.status(400).json({ error: 'Invalid message type.' });
  if (req.body.text !== undefined && typeof req.body.text !== 'string') return res.status(400).json({ error: 'Enter a text message.' });
  if (text !== null && (!text || text.length > 4000)) return res.status(400).json({ error: 'Enter a message of up to 4000 characters.' });
  const time = new Date().toISOString();
  const message = text && kind !== 'communication_log' ? { text, time, source: 'Clinic', outgoing: true,
    kind, visibility: kind === 'internal_note' ? 'internal' : 'owner', author: req.user.name || 'Clinic team' } : null;
  if (message && kind === 'reply') { patch.preview = text; patch.time = time; patch.ownerUnread = true; }
  const history = text ? { type: kind === 'internal_note' ? 'Internal note' : kind === 'communication_log' ? 'Communication logged' : 'Clinic message recorded', time, text, tag: 'Medical' } : null;
  try {
    if (patch.assignedTo !== undefined) {
      const staff = await db.query('SELECT id FROM users WHERE clinic_id=$1 AND name=$2 AND COALESCE(is_active,true)', [clinic, patch.assignedTo]);
      if (!staff.rows.length) return res.status(400).json({ error: 'Assign a staff member from your clinic.' });
    }
    const result = await db.query(`UPDATE settings SET value = value || $3::jsonb ||
      CASE WHEN $4::jsonb IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('messages', COALESCE(value->'messages','[]'::jsonb) || jsonb_build_array($4::jsonb)) END ||
      CASE WHEN $5::jsonb IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('history', jsonb_build_array($5::jsonb) || COALESCE(value->'history','[]'::jsonb)) END,
      updated_at=now() WHERE clinic_id=$1 AND key=$2 RETURNING value`, [clinic, `clinic_inbox:${req.params.id}`, JSON.stringify(patch), message ? JSON.stringify(message) : null, history ? JSON.stringify(history) : null]);
    if (!result.rows.length) return res.status(404).json({ error: 'Conversation not found in your clinic.' });
    publish(clinic, 'inbox-updated');
    res.json(result.rows[0].value);
  } catch (error) { next(error); }
};
