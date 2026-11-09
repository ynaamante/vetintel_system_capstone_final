const db = require('../config/db');
const { publish } = require('../utils/clinicEvents');
const canRead = new Set(['doctor', 'assistant_doctor', 'veterinarian', 'owner', 'clinic_owner', 'super_admin']);
const canWrite = new Set(['doctor', 'assistant_doctor', 'veterinarian']);
exports.ensureSchema = () => db.query(`CREATE TABLE IF NOT EXISTS diagnosis_observations (
  id SERIAL PRIMARY KEY,
  diagnosis_id INTEGER NOT NULL REFERENCES patient_diagnoses(id) ON DELETE CASCADE,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  notes TEXT NOT NULL,
  vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
); CREATE INDEX IF NOT EXISTS diagnosis_observations_date_idx ON diagnosis_observations(diagnosis_id, observed_at DESC);`);

async function scope(req, res, write) {
  const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!(write ? canWrite : canRead).has(role)) { res.status(403).json({ error: 'Veterinary access required.' }); return; }
  const clinic = Number(role === 'super_admin' ? req.query.clinic_id : req.user?.clinic_id);
  const pet = Number(req.params.id), diagnosis = Number(req.params.diagnosisId);
  if (![clinic, pet, diagnosis].every(value => Number.isInteger(value) && value > 0)) { res.status(400).json({ error: 'A valid clinic, patient, and saved diagnosis are required.' }); return; }
  const found = await db.query('SELECT id FROM patient_diagnoses WHERE id=$1 AND pet_id=$2 AND clinic_id=$3', [diagnosis, pet, clinic]);
  if (!found.rows.length) { res.status(404).json({ error: 'Diagnosis not found for this patient.' }); return; }
  return { clinic, pet, diagnosis };
}

exports.list = async (req, res, next) => {
  try {
    const context = await scope(req, res, false); if (!context) return;
    const result = await db.query(`SELECT o.*,u.name AS author FROM diagnosis_observations o LEFT JOIN users u ON u.id=o.recorded_by
      WHERE o.diagnosis_id=$1 AND o.pet_id=$2 AND o.clinic_id=$3 ORDER BY o.observed_at DESC,o.id DESC`, [context.diagnosis, context.pet, context.clinic]);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json(result.rows);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  let client;
  try {
    const context = await scope(req, res, true); if (!context) return;
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
    const date = new Date(req.body.observed_at);
    if (!notes || notes.length > 5000 || !req.body.observed_at || Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 60000) return res.status(422).json({ error: 'Enter clinical notes and a valid observation time that is not in the future.' });
    const incoming = req.body.vitals || {};
    if (typeof incoming !== 'object' || Array.isArray(incoming)) return res.status(422).json({ error: 'Invalid vital signs.' });
    const vitals = {};
    for (const [key, max] of Object.entries({ temperature: 60, heart_rate: 500, respiratory_rate: 300, weight: 1500 })) {
      if (incoming[key] == null || incoming[key] === '') continue;
      const value = Number(incoming[key]);
      if (!Number.isFinite(value) || value < 0 || value > max) return res.status(422).json({ error: `Enter a valid ${key.replaceAll('_', ' ')}.` });
      vitals[key] = String(value);
    }
    if (incoming.body_condition) {
      if (!['Underweight', 'Ideal', 'Overweight', 'Obese'].includes(incoming.body_condition)) return res.status(422).json({ error: 'Invalid body condition.' });
      vitals.body_condition = incoming.body_condition;
    }
    client = await db.pool.connect();
    await client.query('BEGIN');
    const saved = await client.query(`INSERT INTO diagnosis_observations(diagnosis_id,clinic_id,pet_id,recorded_by,observed_at,notes,vitals)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`, [context.diagnosis, context.clinic, context.pet, req.user.id, date.toISOString(), notes, JSON.stringify(vitals)]);
    const row = saved.rows[0];
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) VALUES($1,'create_observation','diagnosis_observations',$2,$3::jsonb)`, [req.user.id, row.id, JSON.stringify(row)]);
    await client.query('COMMIT');
    publish(context.clinic, 'diagnosis');
    return res.status(201).json({ ...row, author: req.user.name || 'Veterinarian' });
  } catch (error) { if (client) await client.query('ROLLBACK').catch(() => {}); next(error); }
  finally { client?.release(); }
};
