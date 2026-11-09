const db = require('../config/db');
const normalize = value => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const staffRoles = new Set(['receptionist', 'clinic_owner', 'owner', 'super_admin', 'doctor', 'assistant_doctor', 'veterinarian']);

exports.addWalkIn = async (req, res, next) => {
  const clinic = Number(req.user?.clinic_id);
  if (!staffRoles.has(normalize(req.user?.role)) || !Number.isInteger(clinic) || clinic < 1)
    return res.status(403).json({ error: 'Clinic staff access required.' });
  const petId = Number(req.body.pet_id);
  const doctorId = Number(req.body.practitioner_id);
  const reason = String(req.body.reason || '').trim();
  if (!Number.isInteger(petId) || petId < 1 || !Number.isInteger(doctorId) || doctorId < 1 || !reason)
    return res.status(422).json({ error: 'Select a registered patient, veterinarian, and visit type.' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [clinic]);
    const pet = await client.query(`SELECT id, client_id FROM pets WHERE id=$1 AND clinic_id=$2 AND COALESCE((metadata->>'archived')::boolean,false)=false`, [petId, clinic]);
    const doctor = await client.query(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
      WHERE u.id=$1 AND u.clinic_id=$2 AND COALESCE(u.is_active,true)
      AND lower(regexp_replace(trim(r.name),'[[:space:]-]+','_','g')) IN ('doctor','assistant_doctor','veterinarian')`, [doctorId, clinic]);
    if (!pet.rows.length || !doctor.rows.length) {
      await client.query('ROLLBACK'); return res.status(422).json({ error: 'Choose an active patient and veterinarian from this clinic.' });
    }
    const duplicate = await client.query(`SELECT id FROM patient_queue WHERE clinic_id=$1 AND pet_id=$2 AND status IN ('waiting','in_consultation','in-consultation')`, [clinic, petId]);
    if (duplicate.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This patient is already in the active queue.' }); }
    const appointment = await client.query(`INSERT INTO appointments
      (clinic_id, pet_id, client_id, practitioner_id, status, start_time, reason, workflow_type)
      VALUES ($1,$2,$3,$4,'checked_in',now(),$5,'walk_in') RETURNING id`,
    [clinic, petId, pet.rows[0].client_id, doctorId, reason]);
    const id = appointment.rows[0].id;
    await client.query(`INSERT INTO patient_queue (clinic_id,appointment_id,pet_id,position,status)
      SELECT $1,$2,$3,COALESCE(MAX(position),0)+1,'waiting' FROM patient_queue WHERE clinic_id=$1`, [clinic,id,petId]);
    await client.query(`INSERT INTO clinic_notifications (clinic_id,recipient_user_id,title,text)
      VALUES ($1,$2,'Walk-in patient checked in',$3)`, [clinic,doctorId,`Walk-in appointment #${id} is waiting for consultation.`]);
    await client.query(`INSERT INTO audit_trail (user_id,action,table_name,record_id,new_data)
      VALUES ($1,'add_walk_in','appointments',$2,$3::jsonb)`,
    [req.user.id,id,JSON.stringify({ status:'checked_in', workflow_type:'walk_in', _audit:{role:req.user.role} })]);
    await client.query('COMMIT');
    return res.status(201).json({ id, status: 'checked_in' });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); return next(error); }
  finally { client.release(); }
};

function scope(req, res) {
  const clinic = Number(req.user?.clinic_id);
  const id = Number(req.params.id);
  if (!staffRoles.has(normalize(req.user?.role))) {
    res.status(403).json({ error: 'Clinic staff access required.' });
    return null;
  }
  if (!Number.isInteger(clinic) || clinic < 1 || !Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'A valid appointment and assigned clinic are required.' });
    return null;
  }
  return [id, clinic];
}

exports.context = async (req, res, next) => {
  const params = scope(req, res);
  if (!params) return;
  try {
    const result = await db.query(`SELECT a.id, a.status, a.start_time, a.end_time, a.reason,
      a.workflow_type, a.workflow_reason, a.created_at, a.updated_at, a.parent_appointment_id,
      p.name AS pet, p.species, p.breed, c.name AS owner, c.phone, c.email,
      u.name AS practitioner, co.status AS consultation_status, co.completed_at
      FROM appointments a LEFT JOIN pets p ON p.id=a.pet_id
      LEFT JOIN clients c ON c.id=a.client_id LEFT JOIN users u ON u.id=a.practitioner_id
      LEFT JOIN consultations co ON co.appointment_id=a.id AND co.clinic_id=a.clinic_id
      WHERE a.id=$1 AND a.clinic_id=$2`, params);
    if (!result.rows.length) return res.status(404).json({ error: 'Appointment not found.' });
    const queue = await db.query(`SELECT q.position, q.status, q.checkin_at,
      (SELECT count(*) FROM patient_queue ahead WHERE ahead.clinic_id=q.clinic_id
        AND ahead.status='waiting' AND ahead.position < q.position) AS patients_ahead
      FROM patient_queue q WHERE q.appointment_id=$1 AND q.clinic_id=$2
      ORDER BY q.checkin_at DESC LIMIT 1`, params);
    // Return only scheduling history; clinical notes in old_data/new_data stay private.
    const history = await db.query(`SELECT t.id, t.action, t.created_at, u.name AS responsible_user,
      t.old_data->>'status' AS previous_status, t.new_data->>'status' AS status,
      t.new_data->'_audit'->>'reason' AS reason
      FROM audit_trail t LEFT JOIN users u ON u.id=t.user_id
      WHERE t.table_name='appointments' AND (t.record_id=$1 OR t.record_id IN
        (SELECT id FROM appointments WHERE parent_appointment_id=$1 AND clinic_id=$2))
      ORDER BY t.created_at DESC, t.id DESC`, params);
    res.json({ appointment: result.rows[0], queue: queue.rows[0] || null, history: history.rows,
      no_show_grace_minutes: Math.max(0, Number(process.env.APPOINTMENT_NO_SHOW_GRACE_MINUTES) || 15) });
  } catch (error) { next(error); }
};

exports.act = async (req, res, next) => {
  const params = scope(req, res);
  if (!params) return;
  const { action, attendance_verified: verified } = req.body;
  const reason = String(req.body.reason || '').trim();
  if (!['confirm', 'checkin', 'cancel', 'noshow'].includes(action)) return res.status(422).json({ error: 'Invalid appointment action.' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT * FROM appointments WHERE id=$1 AND clinic_id=$2 FOR UPDATE`, params);
    const appointment = result.rows[0];
    const fail = async (message, code = 409) => { await client.query('ROLLBACK'); return res.status(code).json({ error: message }); };
    if (!appointment) return await fail('Appointment not found.', 404);
    const queue = await client.query('SELECT status FROM patient_queue WHERE appointment_id=$1 AND clinic_id=$2 FOR UPDATE', params);
    const status = normalize(appointment.status);
    if (normalize(appointment.workflow_type).includes('request') || status.includes('request')) {
      return await fail('This request is awaiting doctor review. Reception can view and track it.');
    }
    const pending = ['pending', 'pending_confirmation'].includes(status) || normalize(appointment.workflow_type) === 'pending_confirmation';
    const expected = ['scheduled', 'confirmed', 'expected', 'due'].includes(status) && !pending;
    if (queue.rows.some(q => ['waiting', 'in_consultation'].includes(normalize(q.status)))
      || ['checked_in', 'in_consultation', 'completed', 'cancelled', 'canceled', 'no_show'].includes(status)) {
      return await fail('This action is unavailable after arrival, consultation, or closure. Refresh the appointment.');
    }
    if (action === 'confirm' ? !pending : action === 'checkin' || action === 'noshow' ? !expected : !pending && !expected) {
      return await fail('This action is unavailable for the current appointment status.');
    }
    if (action === 'cancel' && !reason) return await fail('Enter a cancellation reason.', 422);
    if (action === 'noshow') {
      const grace = Math.max(0, Number(process.env.APPOINTMENT_NO_SHOW_GRACE_MINUTES) || 15);
      if (verified !== true || Date.now() < new Date(appointment.start_time).getTime() + grace * 60000) {
        return await fail(`Verify attendance and wait until ${grace} minutes after the appointment time.`, 422);
      }
    }
    const nextStatus = { confirm: 'scheduled', checkin: 'checked_in', cancel: 'cancelled', noshow: 'no_show' }[action];
    await client.query(`UPDATE appointments SET status=$1, workflow_type=$2, workflow_reason=$3, updated_at=now() WHERE id=$4 AND clinic_id=$5`,
      [nextStatus, action === 'confirm' ? 'confirmed' : action, reason || null, ...params]);
    if (action === 'checkin') {
      // Serialize queue numbering across concurrent arrivals in the same clinic.
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [params[1]]);
      await client.query(`INSERT INTO patient_queue (clinic_id, appointment_id, pet_id, position, status)
        SELECT $1, $2, $3, COALESCE(MAX(position),0)+1, 'waiting' FROM patient_queue WHERE clinic_id=$1`,
      [params[1], params[0], appointment.pet_id]);
      if (appointment.practitioner_id) await client.query(`INSERT INTO clinic_notifications
        (clinic_id, recipient_user_id, title, text) VALUES ($1,$2,'Patient checked in',$3)`,
      [params[1], appointment.practitioner_id, `Appointment #${appointment.id} has arrived and is waiting.`]);
    }
    await client.query(`INSERT INTO audit_trail (user_id, action, table_name, record_id, old_data, new_data)
      VALUES ($1,$2,'appointments',$3,$4::jsonb,$5::jsonb)`,
    [req.user.id, action, appointment.id, JSON.stringify({ status }), JSON.stringify({ status: nextStatus,
      _audit: { reason, role: req.user.role, attendance_verified: verified === true } })]);
    await client.query('COMMIT');
    res.json({ id: appointment.id, status: nextStatus });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); }
  finally { client.release(); }
};
