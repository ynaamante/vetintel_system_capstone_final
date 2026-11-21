const db = require('../config/db');
const { publish } = require('../utils/clinicEvents');

function identity(req, res) {
  const email = String(req.user?.email || '').trim().toLowerCase();
  if (!email || !['', 'user', 'pet_owner'].includes(req.user?.role || '')) {
    res.status(403).json({ error: 'Sign in with a pet-owner account.' }); return null;
  }
  return email;
}

// Clinic identities are deliberately separate from pet_owner_pets IDs.
exports.overview = async (req, res, next) => {
  const email = identity(req, res); if (!email) return;
  try {
    const [pets, appointments] = await Promise.all([
      db.query(`SELECT p.id,p.clinic_id,p.name,p.species,p.breed,p.birth_date,p.sex,p.color,p.metadata->>'weight' AS weight,cl.name AS clinic_name,
        (SELECT a.url FROM attachments a WHERE a.clinic_id=p.clinic_id AND a.owner_table='pets' AND a.owner_id=p.id
          AND a.metadata->>'source'='pet_profile_photo' ORDER BY a.uploaded_at DESC,a.id DESC LIMIT 1) AS photo_url
        FROM pets p JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id
        JOIN clinics cl ON cl.id=p.clinic_id
        WHERE lower(trim(c.email))=$1 AND COALESCE((p.metadata->>'archived')::boolean,false)=false
          AND COALESCE(cl.archived,false)=false
          AND NOT EXISTS(SELECT 1 FROM owner_pet_archives a WHERE a.owner_id=$2 AND a.source='clinic' AND a.pet_id=p.id)
          ORDER BY p.name,p.id`, [email,req.user.id]),
      db.query(`SELECT a.id,a.pet_id,a.clinic_id,a.start_time,a.end_time,a.reason,
          CASE WHEN a.workflow_type='pending_confirmation' AND a.status::text='scheduled' THEN 'pending' ELSE a.status::text END AS status,a.workflow_type,
          p.name AS pet,cl.name AS clinic_name,u.name AS practitioner
        FROM appointments a JOIN pets p ON p.id=a.pet_id AND p.clinic_id=a.clinic_id
        JOIN clients c ON c.id=p.client_id AND c.id=a.client_id AND c.clinic_id=a.clinic_id
        JOIN clinics cl ON cl.id=a.clinic_id LEFT JOIN users u ON u.id=a.practitioner_id
        WHERE lower(trim(c.email))=$1 AND COALESCE(a.archived,false)=false
          AND COALESCE((p.metadata->>'archived')::boolean,false)=false
          AND COALESCE(cl.archived,false)=false ORDER BY a.start_time ASC,a.id`, [email]),
    ]);
    res.json({ clinicPets: pets.rows, appointments: appointments.rows });
  } catch (error) { next(error); }
};

exports.updatePet = async (req, res, next) => {
  const email = identity(req, res); if (!email) return;
  const id = Number(req.params.id), body = req.body || {};
  const fields = ['name', 'breed', 'color', 'weight', 'birth_date', 'sex'];
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid pet ID.' });
  const updates = {};
  for (const field of fields) {
    if (body[field] === undefined) continue;
    if (body[field] !== null && !['string', 'number'].includes(typeof body[field])) return res.status(422).json({ error: 'Enter valid profile details.' });
    updates[field] = body[field] == null ? '' : String(body[field]).trim();
    if (updates[field].length > 200) return res.status(422).json({ error: 'Profile fields must be 200 characters or fewer.' });
  }
  if ('name' in updates && !updates.name) return res.status(422).json({ error: 'Enter your pet’s name.' });
  if ('weight' in updates && updates.weight && (!Number.isFinite(Number(updates.weight)) || Number(updates.weight) <= 0 || Number(updates.weight) > 999999)) return res.status(422).json({ error: 'Enter a valid weight in kilograms.' });
  if ('sex' in updates && !['male', 'female', 'unknown'].includes(updates.sex)) return res.status(422).json({ error: 'Choose male, female, or unknown.' });
  if (updates.birth_date) {
    const date = new Date(`${updates.birth_date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(updates.birth_date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== updates.birth_date || date.getTime() > Date.now()) return res.status(422).json({ error: 'Enter a valid date of birth that is not in the future.' });
  }
  let client;
  try {
    client = await db.pool.connect(); await client.query('BEGIN');
    const before = (await client.query(`SELECT p.* FROM pets p
      JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id JOIN clinics cl ON cl.id=p.clinic_id
      WHERE p.id=$1 AND lower(trim(c.email))=$2 AND COALESCE((p.metadata->>'archived')::boolean,false)=false
        AND COALESCE(cl.archived,false)=false FOR UPDATE OF p`, [id,email])).rows[0];
    if (!before) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pet not found in your account.' }); }
    const metadata = { ...before.metadata };
    if ('weight' in updates) metadata.weight = updates.weight ? Number(updates.weight) : null;
    const updated = (await client.query(`UPDATE pets SET name=$2,breed=$3,color=$4,sex=$5::sex_type,birth_date=$6,metadata=$7::jsonb,updated_at=now()
      WHERE id=$1 RETURNING id,clinic_id,name,species,breed,color,sex,birth_date,metadata->>'weight' AS weight`,
    [id,updates.name ?? before.name,updates.breed ?? before.breed,updates.color ?? before.color,updates.sex ?? before.sex,
      'birth_date' in updates ? updates.birth_date || null : before.birth_date,JSON.stringify(metadata)])).rows[0];
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) VALUES($1,'owner_profile_edit','pets',$2,$3::jsonb)`,
    [req.user.id,id,JSON.stringify({ clinic_id: before.clinic_id, fields: updates, source: 'pet_owner_mobile' })]);
    await client.query('COMMIT'); publish(before.clinic_id,'pets');
    res.json(updated);
  } catch (error) { if (client) await client.query('ROLLBACK'); next(error); }
  finally { if (client) client.release(); }
};

exports.book = async (req, res, next) => {
  const email = identity(req, res); if (!email) return;
  const petId = Number(req.body.pet_id), clinicId = Number(req.body.clinic_id);
  const start = new Date(req.body.start_time);
  const reason = String(req.body.reason || '').trim(), notes = String(req.body.notes || '').trim();
  if (!Number.isSafeInteger(petId) || petId < 1 || !Number.isSafeInteger(clinicId) || clinicId < 1
      || !req.body.start_time || !Number.isFinite(start.getTime()) || start.getTime() <= Date.now()
      || !reason || reason.length > 200 || notes.length > 2000) {
    return res.status(422).json({ error: 'Choose a clinic-registered pet, future date and time, and visit type.' });
  }
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [clinicId]);
    const pet = (await client.query(`SELECT p.id,p.client_id FROM pets p
      JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id JOIN clinics cl ON cl.id=p.clinic_id
      WHERE p.id=$1 AND p.clinic_id=$2 AND lower(trim(c.email))=$3
        AND COALESCE((p.metadata->>'archived')::boolean,false)=false AND COALESCE(cl.archived,false)=false
      FOR UPDATE OF p`, [petId, clinicId, email])).rows[0];
    if (!pet) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This pet must be registered at this clinic under your account email.' });
    }
    const end = new Date(start.getTime() + 30 * 60000);
    const duplicate = await client.query(`SELECT id FROM appointments WHERE pet_id=$1 AND clinic_id=$2
      AND COALESCE(archived,false)=false AND status::text NOT IN ('completed','cancelled','canceled','no_show','rescheduled')
      AND start_time < $4 AND COALESCE(end_time,start_time + interval '30 minutes') > $3`,
    [petId, clinicId, start.toISOString(), end.toISOString()]);
    if (duplicate.rows.length) {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'This pet already has an appointment at that time.' });
    }
    // Use reception's existing pending-confirmation workflow, visible to doctors as pending.
    const appointment = (await client.query(`INSERT INTO appointments
      (clinic_id,pet_id,client_id,practitioner_id,status,start_time,end_time,reason,notes,workflow_type)
      VALUES($1,$2,$3,NULL,'scheduled',$4,$5,$6,$7::jsonb,'pending_confirmation') RETURNING id,start_time`,
    [clinicId,petId,pet.client_id,start.toISOString(),end.toISOString(),reason,
      JSON.stringify({ reason_for_visit: notes, source: 'pet_owner_mobile', requested_by: req.user.id })])).rows[0];
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data)
      VALUES($1,'owner_booking','appointments',$2,$3::jsonb)`,
    [req.user.id,appointment.id,JSON.stringify({ clinic_id: clinicId, pet_id: petId, status: 'pending', source: 'pet_owner_mobile' })]);
    await client.query('COMMIT');
    publish(clinicId, 'appointments');
    res.status(201).json({ ...appointment, status: 'pending' });
  } catch (error) { if (client) await client.query('ROLLBACK'); next(error); }
  finally { if (client) client.release(); }
};
