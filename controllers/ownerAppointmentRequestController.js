const { randomUUID } = require('node:crypto');
﻿const db = require('../config/db');
const { publish } = require('../utils/clinicEvents');
const { doctorRoles, normalize } = require('../services/appointmentAvailability');
function doctor(req, res) {
  const clinic = Number(req.user?.clinic_id), user = Number(req.user?.id);
  if (!doctorRoles.has(normalize(req.user?.role)) || !Number.isSafeInteger(clinic) || clinic < 1 || !Number.isSafeInteger(user) || user < 1) {
    res.status(403).json({ error: 'An assigned clinic veterinarian is required.' }); return null;
  }
  return { clinic, user };
}
exports.list = async (req, res, next) => {
  const scope = doctor(req, res); if (!scope) return;
  try {
    const result = await db.query(`SELECT a.id,a.pet_id,a.start_time,a.end_time,a.reason,a.notes,a.created_at,a.status,a.workflow_type,
      CASE WHEN a.notes->'booking_review'->>'action'='reject' THEN 'Declined'
        WHEN a.status::text IN ('cancelled','canceled') THEN 'Cancelled'
        WHEN a.status::text='rescheduled' OR a.workflow_type='rescheduled' THEN 'Reschedule'
        WHEN a.workflow_type='pending_confirmation' THEN 'Needs Review' ELSE 'Approved' END AS request_status,
      (SELECT photo.url FROM attachments photo WHERE photo.clinic_id=p.clinic_id AND photo.owner_table='pets' AND photo.owner_id=p.id
        AND photo.metadata->>'source'='pet_profile_photo' ORDER BY photo.uploaded_at DESC,photo.id DESC LIMIT 1) AS photo_url,
      (SELECT photo.id FROM attachments photo WHERE photo.clinic_id=p.clinic_id AND photo.owner_table='pets' AND photo.owner_id=p.id
        AND photo.metadata->>'source'='pet_profile_photo' ORDER BY photo.uploaded_at DESC,photo.id DESC LIMIT 1) AS photo_attachment_id,
      p.name AS pet,p.species,p.breed,c.name AS owner,c.email,c.phone,u.name AS practitioner
      FROM appointments a JOIN pets p ON p.id=a.pet_id AND p.clinic_id=a.clinic_id
      JOIN clients c ON c.id=a.client_id AND c.clinic_id=a.clinic_id LEFT JOIN users u ON u.id=a.practitioner_id
      WHERE a.clinic_id=$1 AND (a.practitioner_id=$2 OR a.practitioner_id IS NULL)
      AND a.notes->>'source'='pet_owner_mobile' AND COALESCE(a.archived,false)=false
      ORDER BY a.created_at DESC,a.id DESC`, [scope.clinic,scope.user]);
    res.json(result.rows);
  } catch (error) { next(error); }
};
exports.review = async (req, res, next) => {
  const scope = doctor(req, res); if (!scope) return;
  const id = Number(req.params.id), { action } = req.body;
  if (!Number.isSafeInteger(id) || id < 1 || !['approve','reject'].includes(action))
    return res.status(422).json({ error: 'Choose a valid appointment request action.' });
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [scope.clinic]);
    const row = (await client.query(`SELECT * FROM appointments WHERE id=$1 AND clinic_id=$2
      AND (practitioner_id=$3 OR practitioner_id IS NULL) AND COALESCE(archived,false)=false FOR UPDATE`,
      [id,scope.clinic,scope.user])).rows[0];
    if (!row || row.workflow_type !== 'pending_confirmation' || row.status !== 'scheduled' || row.notes?.source !== 'pet_owner_mobile') {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'This request is no longer awaiting your review.' });
    }
    if (action === 'approve') {
      if (new Date(row.start_time).getTime() <= Date.now()) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'The requested time has passed. Decline this request and ask the owner to choose a new time.' });
      }
      const overlap = await client.query(`SELECT id FROM appointments WHERE clinic_id=$1 AND id<>$2
        AND (practitioner_id=$3 OR practitioner_id IS NULL) AND COALESCE(archived,false)=false
        AND status::text NOT IN ('completed','cancelled','canceled','no_show','rescheduled')
        AND start_time < $5 AND COALESCE(end_time,start_time + interval '30 minutes') > $4 LIMIT 1`,
        [scope.clinic,id,scope.user,row.start_time,row.end_time || new Date(new Date(row.start_time).getTime()+1800000)]);
      if (overlap.rows.length) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Your schedule now overlaps this request. Resolve the conflict before approving.' });
      }
    }
    const status = action === 'approve' ? 'scheduled' : 'cancelled';
    await client.query(`UPDATE appointments SET status=$1,workflow_type=$2,practitioner_id=$3,notes=COALESCE(notes,'{}'::jsonb) || $6::jsonb,updated_at=now()
      WHERE id=$4 AND clinic_id=$5`, [status,action === 'approve' ? 'confirmed' : 'cancelled',scope.user,id,scope.clinic,JSON.stringify({ booking_review: { action,doctor_id:scope.user,reviewed_at:new Date().toISOString() } })]);
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data)
      VALUES($1,$2,'appointments',$3,$4::jsonb)`,
      [scope.user,'doctor_' + action + '_owner_booking',id,JSON.stringify({ status,clinic_id:scope.clinic,source:'pet_owner_mobile' })]);
    const title = action === 'approve' ? 'Appointment request approved' : 'Appointment request declined';
    const message = action === 'approve'
      ? 'Your clinic confirmed your requested appointment. Check Appointments for the details.'
      : 'Your clinic declined your appointment request. Contact your clinic or choose another time.';
    await client.query(`WITH delivery AS (
      INSERT INTO clinic_reminder_deliveries(clinic_id,reminder_key,pet_id,client_id,actor_id,request_id,channel,recipient,message,status,sent_at)
      SELECT $1,$2,$3,c.id,$4,$5,'in_app',lower(trim(c.email)),$6,'sent',now()
      FROM clients c WHERE c.id=$7 AND c.clinic_id=$1 AND trim(COALESCE(c.email,''))<>'' RETURNING id,recipient)
      INSERT INTO clinic_owner_notifications(clinic_id,client_id,pet_id,delivery_id,recipient_email,title,message,type,severity)
      SELECT $1,$7,$3,id,recipient,$8,$6,'appointment','low' FROM delivery`,
      [scope.clinic,'appointment-request:' + id,row.pet_id,scope.user,randomUUID(),message,row.client_id,title]);
    await client.query('COMMIT');
    publish(scope.clinic,'appointments'); publish(scope.clinic,'registration');
    res.json({ success:true,id,status });
  } catch (error) { if (client) await client.query('ROLLBACK'); next(error); }
  finally { if (client) client.release(); }
};
