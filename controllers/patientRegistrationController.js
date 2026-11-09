const { evaluate: evaluateScreening, rules: screeningRules } = require('../utils/intakeScreening');
const screening = require('../data/intakeScreening.json');
const { publish } = require('../utils/clinicEvents');
const db = require('../config/db');

const normalizeRole = value => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const receptionistRoles = new Set(['receptionist', 'clinic_owner', 'owner', 'super_admin']);
const doctorRoles = new Set(['doctor', 'assistant_doctor', 'veterinarian']);
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const maxFileBytes = 10 * 1024 * 1024;
const maxFilesBytes = 10 * 1024 * 1024;

function clinicIdFor(req, res) {
  const clinicId = Number(req.user?.clinic_id);
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    res.status(400).json({ error: 'Your account is not assigned to a clinic.' });
    return null;
  }
  return clinicId;
}

function validateSubmission(body) {
  const owner = body.owner && typeof body.owner === 'object' ? body.owner : {};
  const pet = body.pet && typeof body.pet === 'object' ? body.pet : {};
  const ownerName = String(owner.name || '').trim().replace(/\s+/g, ' ');
  const phone = String(owner.phone || '').trim();
  const email = String(owner.email || '').trim();
  const petName = String(pet.name || '').trim();
  const species = String(pet.species || '').trim();
  const sex = String(pet.sex || '').trim().toLowerCase();
  const dateOfBirth = String(pet.birth_date || '').trim();
  const ageValue = String(pet.age_value || '').trim();
  const errors = {};
  const reportedReason = pet.reason_for_visit;
  if (reportedReason != null && (typeof reportedReason !== 'string' || reportedReason.length > 1000)) errors.reasonForVisit = 'Reported symptoms must be text of 1000 characters or fewer.';
  let calculated;
  try { calculated = evaluateScreening(pet.screening_inputs); } catch(error) { errors.screening = error.message; }
  const triagePriority = calculated?.effective.triage_priority || 'not_assessed';
  const infectionRisk = calculated?.effective.infection_risk || 'not_assessed';
  const reasonForVisit = typeof reportedReason === 'string' ? reportedReason.trim() : '';

  if (!/^[A-Za-z][A-Za-z .'-]{1,99}$/.test(ownerName) || ownerName.split(/\s+/).length < 2) errors.ownerName = 'Enter the owner’s first and last name.';
  if (!/^(09\d{9}|\+639\d{9})$/.test(phone.replace(/[ ()-]/g, ''))) errors.phone = 'Enter a valid Philippine mobile number.';
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(petName)) errors.petName = 'Enter a valid pet name.';
  if (!species) errors.species = 'Select a species.';
  if (!['male', 'female'].includes(sex)) errors.sex = 'Select the pet’s sex.';
  if (!dateOfBirth && (!/^\d+$/.test(ageValue) || Number(ageValue) < 0)) errors.age = 'Enter the pet’s date of birth or age.';
  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) errors.dateOfBirth = 'Enter a valid date of birth.';
  if (dateOfBirth) {
    const parsedDate = new Date(`${dateOfBirth}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateOfBirth) errors.dateOfBirth = 'Enter a valid date of birth.';
  }
  return { errors, owner: { ...owner, name: ownerName, phone, email }, pet: { ...pet, name: petName, species, sex, birth_date: dateOfBirth || null, reason_for_visit: reasonForVisit, triage_priority: triagePriority, infection_risk: infectionRisk, screening: calculated } };
}

function validateAttachments(attachments) {
  if (!Array.isArray(attachments)) return { error: 'Attachments must be a list.' };
  let totalBytes = 0;
  const validated = [];
  for (const attachment of attachments) {
    const filename = String(attachment?.filename || '').trim().replace(/[\\/\r\n]/g, '_').slice(0, 255);
    const contentType = String(attachment?.content_type || '').trim().toLowerCase();
    const data = String(attachment?.data || '');
    const prefix = `data:${contentType};base64,`;
    if (!filename || !allowedTypes.has(contentType) || !data.startsWith(prefix)) return { error: 'Upload a PDF, JPG, or PNG attachment.' };
    const encoded = data.slice(prefix.length);
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return { error: 'An attachment is not valid base64 data.' };
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length || bytes.length > maxFileBytes) return { error: 'Each attachment must be 10 MB or smaller.' };
    totalBytes += bytes.length;
    if (totalBytes > maxFilesBytes) return { error: 'Attachments must total 10 MB or less.' };
    const validSignature = contentType === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
      : contentType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!validSignature) return { error: `${filename} does not match its selected file type.` };
    validated.push({ filename, contentType, data });
  }
  return { attachments: validated };
}

async function saveAttachments(client, clinicId, intakeId, submittedBy, attachments) {
  for (const attachment of attachments) {
    await client.query(
      `INSERT INTO attachments (clinic_id, owner_table, owner_id, filename, content_type, url, metadata)
       VALUES ($1, 'patient_registration_intakes', $2, $3, $4, $5, $6::jsonb)`,
      [clinicId, intakeId, attachment.filename, attachment.contentType, attachment.data, JSON.stringify({ source: 'patient_registration', uploaded_by: submittedBy })]
    );
  }
}

function screeningSummary(pet) {
  const triage = screening.triage.find(item => item.value === pet.triage_priority)?.label || 'Not assessed';
  const infection = screening.infection.find(item => item.value === pet.infection_risk)?.label || 'Not assessed';
  return ` Preliminary screening: Triage: ${triage}; Infection risk: ${infection}. Requires veterinary assessment.`;
}

async function notify(client, clinicId, recipientId, intakeId, title, text) {
  if (!recipientId) return false;
  await client.query(
    `INSERT INTO clinic_notifications (clinic_id, recipient_user_id, title, text, related_intake_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [clinicId, recipientId, title, text, intakeId]
  );
  return true;
}

async function recordIntakeEvent(client, req, intakeId, action, status, reason = '') {
  await client.query(`INSERT INTO audit_trail (user_id, action, table_name, record_id, new_data)
    VALUES ($1,$2,'patient_registration_intakes',$3,$4::jsonb)`,
  [req.user.id, action, intakeId, JSON.stringify({ status, reason, role: req.user.role })]);
}

exports.getPatientRecord = async (req, res, next) => {
  try {
    const clinicId = clinicIdFor(req, res);
    if (!clinicId) return;
    const role = normalizeRole(req.user?.role);
    if (!receptionistRoles.has(role) && !doctorRoles.has(role)) return res.status(403).json({ error: 'Clinic staff access required.' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid registration ID.' });
    const result = await db.query(`SELECT p.id, p.name, p.species, p.breed, p.sex, p.birth_date, p.color,
      p.created_at, p.metadata->>'registration_reason_for_visit' AS reason_for_visit, p.metadata->'registration_screening' AS screening, c.name AS owner, c.phone, c.email, c.address, u.name AS assigned_doctor
      FROM patient_registration_intakes i JOIN pets p ON p.id=i.pet_id AND p.clinic_id=i.clinic_id
      JOIN clients c ON c.id=p.client_id AND c.clinic_id=i.clinic_id
      LEFT JOIN users u ON u.id=i.assigned_doctor_id
      WHERE i.id=$1 AND i.clinic_id=$2 AND i.status='Approved'
        AND (($4::boolean AND i.assigned_doctor_id=$3) OR (NOT $4::boolean AND i.submitted_by=$3))`,
    [id, clinicId, Number(req.user.id), doctorRoles.has(role)]);
    if (!result.rows.length) return res.status(404).json({ error: 'Approved patient record not found.' });
    return res.json(result.rows[0]);
  } catch (error) { return next(error); }
};

exports.listDoctors = async (req, res, next) => {
  try {
    const clinicId = clinicIdFor(req, res);
    if (!clinicId) return;
    const role = normalizeRole(req.user?.role);
    if (!receptionistRoles.has(role) && !doctorRoles.has(role)) return res.status(403).json({ error: 'Clinic staff access is required.' });
    const result = await db.query(
      `SELECT u.id, u.name, u.email, r.name AS role,
              (SELECT COUNT(*) FROM patient_registration_intakes i
               WHERE i.assigned_doctor_id = u.id AND i.clinic_id = u.clinic_id AND i.status = 'Needs review') AS pending_count
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.clinic_id = $1 AND COALESCE(u.is_active, true) = true
         AND lower(regexp_replace(trim(r.name), '[[:space:]-]+', '_', 'g')) IN ('doctor', 'assistant_doctor', 'veterinarian')
       ORDER BY u.name`,
      [clinicId]
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
};

exports.listIntakes = async (req, res, next) => {
  try {
    const clinicId = clinicIdFor(req, res);
    if (!clinicId) return;
    const role = normalizeRole(req.user?.role);
    const isDoctor = doctorRoles.has(role);
    if (!isDoctor && !receptionistRoles.has(role)) return res.status(403).json({ error: 'You do not have access to registration intakes.' });
    const result = await db.query(
      `SELECT i.id, i.assigned_doctor_id, i.client_id, i.pet_id, i.status, i.owner_data, i.pet_data, i.correction_note, i.activity,
              i.created_at, i.updated_at, i.submitted_at,
              submitter.name AS submitted_by_name, doctor.name AS assigned_doctor_name,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', a.id, 'filename', a.filename, 'content_type', a.content_type, 'uploaded_at', a.uploaded_at) ORDER BY a.id)
                FROM attachments a WHERE a.owner_table = 'patient_registration_intakes' AND a.owner_id = i.id AND a.clinic_id = i.clinic_id
              ), '[]'::jsonb) AS attachments,
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'action', t.action,
                'timestamp', t.created_at, 'user', actor.name, 'status', t.new_data->>'status',
                'reason', t.new_data->>'reason') ORDER BY t.created_at DESC, t.id DESC)
                FROM audit_trail t LEFT JOIN users actor ON actor.id=t.user_id
                WHERE t.table_name='patient_registration_intakes' AND t.record_id=i.id), '[]'::jsonb) AS audit_events
       FROM patient_registration_intakes i
       LEFT JOIN users submitter ON submitter.id = i.submitted_by
       LEFT JOIN users doctor ON doctor.id = i.assigned_doctor_id
       WHERE i.clinic_id = $1 AND ($2::boolean = false OR i.assigned_doctor_id = $3)
         AND ($2::boolean = true OR i.submitted_by = $3)
       ORDER BY i.updated_at DESC, i.id DESC`,
      [clinicId, isDoctor, Number(req.user?.id)]
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
};

async function validateDoctor(client, clinicId, doctorId) {
  if (!Number.isInteger(doctorId) || doctorId < 1) return false;
  const result = await client.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND u.clinic_id = $2 AND COALESCE(u.is_active, true) = true
       AND lower(regexp_replace(trim(r.name), '[[:space:]-]+', '_', 'g')) IN ('doctor', 'assistant_doctor', 'veterinarian')`,
    [doctorId, clinicId]
  );
  return result.rows.length > 0;
}

exports.submitIntake = async (req, res, next) => {
  let client;
  try {
    const clinicId = clinicIdFor(req, res);
    if (!clinicId) return;
    if (!receptionistRoles.has(normalizeRole(req.user?.role)) || !req.user?.id) return res.status(403).json({ error: 'Reception staff access is required to submit a registration.' });
    const validated = validateSubmission(req.body);
    if (Object.keys(validated.errors).length) return res.status(422).json({ error: 'Complete the required owner and patient information.', fields: validated.errors });
    const doctorId = Number(req.body.assigned_doctor_id);
    const attachments = validateAttachments(req.body.attachments || []);
    if (attachments.error) return res.status(422).json({ error: attachments.error });

    client = await db.pool.connect();
    await client.query('BEGIN');
    if (!(await validateDoctor(client, clinicId, doctorId))) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Select an active veterinarian at this clinic.' });
    }

    const result = await client.query(
      `INSERT INTO patient_registration_intakes
         (clinic_id, submitted_by, assigned_doctor_id, owner_data, pet_data, status, activity)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'Needs review', $6::jsonb)
       RETURNING id, status, created_at, updated_at, submitted_at`,
      [clinicId, Number(req.user.id), doctorId, JSON.stringify(validated.owner), JSON.stringify(validated.pet), JSON.stringify(['Registration submitted for doctor review.'])]
    );
    const intake = result.rows[0];
    await saveAttachments(client, clinicId, intake.id, Number(req.user.id), attachments.attachments);
    if (!(await notify(client, clinicId, doctorId, intake.id, 'New patient registration', `${validated.pet.name} is awaiting your review.${validated.pet.reason_for_visit ? ` Reported symptoms / reason for visit: ${validated.pet.reason_for_visit}` : ''}` + screeningSummary(validated.pet)))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The veterinarian could not be notified. The registration was not submitted.' });
    }
    await recordIntakeEvent(client, req, intake.id, 'submitted', 'Needs review');
    await client.query('COMMIT');
    publish(clinicId, 'registration');
    return res.status(201).json({ ...intake, notification_sent: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client?.release();
  }
};

exports.resubmitIntake = async (req, res, next) => {
  let client;
  try {
    const clinicId = clinicIdFor(req, res);
    if (!clinicId) return;
    if (!receptionistRoles.has(normalizeRole(req.user?.role)) || !req.user?.id) return res.status(403).json({ error: 'Reception staff access is required to resubmit a registration.' });
    const intakeId = Number(req.params.id);
    if (!Number.isInteger(intakeId) || intakeId < 1) return res.status(400).json({ error: 'Invalid registration ID.' });
    const validated = validateSubmission(req.body);
    if (Object.keys(validated.errors).length) return res.status(422).json({ error: 'Complete the required owner and patient information.', fields: validated.errors });
    const attachments = validateAttachments(req.body.attachments || []);
    if (attachments.error) return res.status(422).json({ error: attachments.error });
    const doctorId = Number(req.body.assigned_doctor_id);

    client = await db.pool.connect();
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT id, assigned_doctor_id FROM patient_registration_intakes
       WHERE id = $1 AND clinic_id = $2 AND submitted_by = $3 AND status = 'Waiting on reception'
       FOR UPDATE`,
      [intakeId, clinicId, Number(req.user.id)]
    );
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This registration is no longer available for correction.' });
    }
    if (!(await validateDoctor(client, clinicId, doctorId))) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Select an active veterinarian at this clinic.' });
    }
    const updated = await client.query(
      `UPDATE patient_registration_intakes
       SET assigned_doctor_id = $1, owner_data = $2::jsonb, pet_data = $3::jsonb,
           status = 'Needs review', correction_note = NULL,
           activity = jsonb_build_array('Corrected registration resubmitted for doctor review.') || activity,
           submitted_at = now(), updated_at = now()
       WHERE id = $4 AND clinic_id = $5
       RETURNING id, status, created_at, updated_at, submitted_at`,
      [doctorId, JSON.stringify(validated.owner), JSON.stringify(validated.pet), intakeId, clinicId]
    );
    await saveAttachments(client, clinicId, intakeId, Number(req.user.id), attachments.attachments);
    if (!(await notify(client, clinicId, doctorId, intakeId, 'Corrected registration resubmitted', `${validated.pet.name}'s updated registration is ready for review.${validated.pet.reason_for_visit ? ` Reported symptoms / reason for visit: ${validated.pet.reason_for_visit}` : ''}` + screeningSummary(validated.pet)))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The veterinarian could not be notified. The correction was not submitted.' });
    }
    await recordIntakeEvent(client, req, intakeId, 'edited_and_resubmitted', 'Needs review');
    await client.query('COMMIT');
    publish(clinicId, 'registration');
    return res.json({ ...updated.rows[0], notification_sent: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client?.release();
  }
};

exports.returnForCorrection = async (req, res, next) => {
  let client;
  try {
    const clinicId = clinicIdFor(req, res);
    if (!clinicId) return;
    if (!doctorRoles.has(normalizeRole(req.user?.role)) || !req.user?.id) return res.status(403).json({ error: 'Only the assigned veterinarian can return this registration.' });
    const intakeId = Number(req.params.id);
    const note = String(req.body.reason || '').trim();
    if (!Number.isInteger(intakeId) || intakeId < 1) return res.status(400).json({ error: 'Invalid registration ID.' });
    if (!note || note.length > 500) return res.status(422).json({ error: 'Enter a correction reason of 1 to 500 characters.' });

    client = await db.pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE patient_registration_intakes
       SET status = 'Waiting on reception', correction_note = $1,
           activity = jsonb_build_array($2::text) || activity, updated_at = now()
       WHERE id = $3 AND clinic_id = $4 AND assigned_doctor_id = $5 AND status = 'Needs review'
       RETURNING id, submitted_by, pet_data`,
      [note, `Returned for correction: ${note}`, intakeId, clinicId, Number(req.user.id)]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This registration is no longer awaiting your review.' });
    }
    const row = result.rows[0];
    if (!(await notify(client, clinicId, row.submitted_by, intakeId, 'Registration returned for correction', `${row.pet_data.name}: ${note}`))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The receptionist could not be notified. The registration was not returned.' });
    }
    await recordIntakeEvent(client, req, intakeId, 'changes_requested', 'Waiting on reception', note);
    await client.query('COMMIT');
    publish(clinicId, 'registration');
    return res.json({ id: intakeId, status: 'Waiting on reception', notification_sent: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client?.release();
  }
};

exports.reviewIntake = async (req, res, next) => {
  let client;
  try {
    const clinicId = clinicIdFor(req, res);
    if (!clinicId) return;
    if (!doctorRoles.has(normalizeRole(req.user?.role)) || !req.user?.id) return res.status(403).json({ error: 'Only the assigned veterinarian can review this registration.' });
    const intakeId = Number(req.params.id);
    const action = String(req.body.action || '').trim();
    const reason = String(req.body.reason || '').trim();
    if (!Number.isInteger(intakeId) || intakeId < 1) return res.status(400).json({ error: 'Invalid registration ID.' });
    if (!['approve', 'reject', 'duplicate', 'reassign'].includes(action)) return res.status(422).json({ error: 'Choose a valid registration review action.' });
    if (['reject', 'duplicate', 'reassign'].includes(action) && !reason) return res.status(422).json({ error: 'Enter a reason for this review action.' });

    client = await db.pool.connect();
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT id, submitted_by, assigned_doctor_id, owner_data, pet_data, status
       FROM patient_registration_intakes
       WHERE id = $1 AND clinic_id = $2 AND assigned_doctor_id = $3
       FOR UPDATE`,
      [intakeId, clinicId, Number(req.user.id)]
    );
    if (!currentResult.rows.length || currentResult.rows[0].status !== 'Needs review') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This registration is no longer awaiting your review.' });
    }
    const current = currentResult.rows[0];
    let status = current.status;
    let clientId = null;
    let petId = null;
    let notificationTitle;
    let notificationText;
    let activity;

    if (action === 'approve') {
      const owner = current.owner_data;
      const pet = current.pet_data;
      const ownerResult = await client.query(
        `INSERT INTO clients (clinic_id, name, email, phone, address)
         VALUES ($1, $2, $3, $4, NULLIF($5, ''))
         RETURNING id`,
        [clinicId, owner.name, owner.email, owner.phone, owner.address || '']
      );
      clientId = ownerResult.rows[0].id;
      const petResult = await client.query(
        `INSERT INTO pets (clinic_id, client_id, name, species, breed, sex, birth_date, color, metadata)
         VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5, ''), 'Not specified'), $6::sex_type, $7, NULLIF($8, ''),
           jsonb_build_object('age', NULLIF($9, ''), 'registration_intake_id', $10::integer, 'registration_reason_for_visit', NULLIF($11::text, ''), 'registration_screening', $12::jsonb))
         RETURNING id`,
        [
          clinicId, clientId, pet.name, pet.species, pet.breed || '', pet.sex,
          pet.birth_date || null, pet.color || '',
          pet.age_value ? `${pet.age_value} ${pet.age_unit || 'Months'}` : '', intakeId, pet.reason_for_visit || '', JSON.stringify(pet.screening || {preliminary:true,effective:{triage_priority:'not_assessed',infection_risk:'not_assessed'}}),
        ]
      );
      petId = petResult.rows[0].id;
      status = 'Approved';
      activity = 'Registration approved; patient record created.';
      notificationTitle = 'Patient registration approved';
      notificationText = `${pet.name}’s patient record was created after review.`;
      await client.query(
        `UPDATE patient_registration_intakes
         SET status = $1, client_id = $2, pet_id = $3, correction_note = NULL,
             activity = jsonb_build_array($4::text) || activity, updated_at = now()
         WHERE id = $5`,
        [status, clientId, petId, activity, intakeId]
      );
    } else if (action === 'reassign') {
      const doctorId = Number(req.body.assigned_doctor_id);
      if (!(await validateDoctor(client, clinicId, doctorId))) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'Select an active veterinarian at this clinic.' });
      }
      if (doctorId === Number(current.assigned_doctor_id)) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'Select a different veterinarian.' });
      }
      await client.query(
        `UPDATE patient_registration_intakes
         SET assigned_doctor_id = $1, activity = jsonb_build_array($2::text) || activity, updated_at = now()
         WHERE id = $3`,
        [doctorId, `Intake reassigned to veterinarian ${doctorId}: ${reason}`, intakeId]
      );
      if (!(await notify(client, clinicId, doctorId, intakeId, 'Registration assigned for review', `${current.pet_data.name}'s registration was assigned to you.${current.pet_data.reason_for_visit ? ` Reported symptoms / reason for visit: ${current.pet_data.reason_for_visit}` : ''}` + screeningSummary(current.pet_data)))) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'The veterinarian could not be notified. The intake was not reassigned.' });
      }
      await recordIntakeEvent(client, req, intakeId, 'reassigned', status, reason);
      await client.query('COMMIT');
    publish(clinicId, 'registration');
      return res.json({ id: intakeId, status, assigned_doctor_id: doctorId, notification_sent: true });
    } else {
      status = 'Rejected';
      activity = action === 'duplicate' ? `Registration marked as duplicate: ${reason}` : `Registration rejected: ${reason}`;
      notificationTitle = action === 'duplicate' ? 'Registration marked as duplicate' : 'Registration rejected';
      notificationText = `${current.pet_data.name}: ${reason}`;
      await client.query(
        `UPDATE patient_registration_intakes
         SET status = $1, correction_note = $2,
             activity = jsonb_build_array($3::text) || activity, updated_at = now()
         WHERE id = $4`,
        [status, reason, activity, intakeId]
      );
    }

    if (!(await notify(client, clinicId, current.submitted_by, intakeId, notificationTitle, notificationText))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The receptionist could not be notified. The review action was not saved.' });
    }
    await recordIntakeEvent(client, req, intakeId, action === 'approve' ? 'approved' : action === 'duplicate' ? 'marked_duplicate' : 'rejected', status, reason);
    await client.query('COMMIT');
    publish(clinicId, 'registration');
    return res.json({ id: intakeId, status, client_id: clientId, pet_id: petId, notification_sent: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client?.release();
  }
};

exports.listNotifications = async (req, res, next) => {
  try {
    const clinicId = clinicIdFor(req, res);
    if (!clinicId) return;
    const result = await db.query(
      `SELECT id, title, text, created_at, read_at
       FROM clinic_notifications
       WHERE clinic_id = $1 AND recipient_user_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [clinicId, Number(req.user.id)]
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const clinicId = clinicIdFor(req, res);
    if (!clinicId) return;
    const result = await db.query(
      `UPDATE clinic_notifications SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND clinic_id = $2 AND recipient_user_id = $3
       RETURNING id`,
      [Number(req.params.id), clinicId, Number(req.user.id)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Notification not found.' });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};


exports.getPatientIntakeSummary = async (req, res, next) => {
  try {
    const clinic = clinicIdFor(req, res);
    if (!clinic) return;
    const role = normalizeRole(req.user?.role);
    if (!doctorRoles.has(role) && !receptionistRoles.has(role)) return res.status(403).json({ error: 'Clinic staff access required.' });
    const pet = Number(req.params.id);
    if (!Number.isInteger(pet) || pet < 1) return res.status(400).json({ error: 'Invalid patient ID.' });
    const exists = await db.query('SELECT id FROM pets WHERE id=$1 AND clinic_id=$2', [pet, clinic]);
    if (!exists.rows.length) return res.status(404).json({ error: 'Patient not found.' });
    const result = await db.query(`SELECT i.id, i.pet_id, i.status, i.submitted_at, i.created_at, i.updated_at,
        i.pet_data, i.owner_data, submitter.name AS submitted_by_name, doctor.name AS assigned_doctor_name,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'filename',a.filename,'content_type',a.content_type,'uploaded_at',a.uploaded_at) ORDER BY a.id)
          FROM attachments a WHERE a.clinic_id=i.clinic_id AND a.owner_table='patient_registration_intakes' AND a.owner_id=i.id),'[]'::jsonb) AS attachments,
        COALESCE(i.pet_data->'screening', p.metadata->'registration_screening') AS screening,
        COALESCE(NULLIF(i.pet_data->>'reason_for_visit',''), p.metadata->>'registration_reason_for_visit') AS reason_for_visit
      FROM patient_registration_intakes i JOIN pets p ON p.id=i.pet_id AND p.clinic_id=i.clinic_id
      LEFT JOIN users submitter ON submitter.id=i.submitted_by AND submitter.clinic_id=i.clinic_id
      LEFT JOIN users doctor ON doctor.id=i.assigned_doctor_id AND doctor.clinic_id=i.clinic_id
      WHERE i.pet_id=$1 AND i.clinic_id=$2 AND i.status='Approved'
      ORDER BY i.submitted_at DESC NULLS LAST,i.id DESC LIMIT 1`, [pet, clinic]);
    return res.json({ intake: result.rows[0] || null });
  } catch (error) { return next(error); }
};

exports.screeningConfig = (req,res) => {
  const clinic=clinicIdFor(req,res); if(!clinic)return;
  if(!receptionistRoles.has(normalizeRole(req.user?.role)) && !doctorRoles.has(normalizeRole(req.user?.role)))return res.status(403).json({error:'Clinic staff access required.'});
  return res.json({...screeningRules,indicators:screening});
};
exports.previewScreening = (req,res) => {
  const clinic=clinicIdFor(req,res); if(!clinic)return;
  if(!receptionistRoles.has(normalizeRole(req.user?.role)) && !doctorRoles.has(normalizeRole(req.user?.role)))return res.status(403).json({error:'Clinic staff access required.'});
  try { return res.json(evaluateScreening(req.body.screening_inputs)); }
  catch(error){return res.status(422).json({error:error.message});}
};
exports.reviewScreening = async(req,res,next) => {
  const clinic=clinicIdFor(req,res); if(!clinic)return;
  if(!doctorRoles.has(normalizeRole(req.user?.role)))return res.status(403).json({error:'Only the assigned veterinarian can review screening.'});
  const id=Number(req.params.id), triage=req.body.triage_priority, infection=req.body.infection_risk, note=req.body.note ?? '';
  if(!Number.isInteger(id)||id<1||!screening.triage.some(item=>item.value===triage)||!screening.infection.some(item=>item.value===infection)||typeof note!=='string'||note.length>1000)return res.status(422).json({error:'Select valid indicators and a review note of at most 1000 characters.'});
  let client;
  try{
    client=await db.pool.connect();await client.query('BEGIN');
    const row=(await client.query('SELECT id,pet_id,pet_data,status FROM patient_registration_intakes WHERE id=$1 AND clinic_id=$2 AND assigned_doctor_id=$3 FOR UPDATE',[id,clinic,Number(req.user.id)])).rows[0];
    if(!row||!['Needs review','Approved'].includes(row.status)){await client.query('ROLLBACK');return res.status(409).json({error:'This intake is not available for your screening review.'});}
    const old=row.pet_data.screening || evaluateScreening();
    const overridden=old.suggested.triage_priority!==triage||old.suggested.infection_risk!==infection;
    if(overridden&&!note.trim()){await client.query('ROLLBACK');return res.status(422).json({error:'Enter a reason for overriding the suggested indicators.'});}
    const result={...old,effective:{triage_priority:triage,infection_risk:infection},review:{reviewed_by:Number(req.user.id),reviewed_at:new Date().toISOString(),note:note.trim(),overridden}};
    const pet={...row.pet_data,screening:result,triage_priority:triage,infection_risk:infection};
    await client.query("UPDATE patient_registration_intakes SET pet_data=$1::jsonb,updated_at=now(),activity=jsonb_build_array('Preliminary screening reviewed by veterinarian.'::text)||activity WHERE id=$2 AND clinic_id=$3",[JSON.stringify(pet),id,clinic]);
    if(row.pet_id)await client.query("UPDATE pets SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{registration_screening}',$1::jsonb) WHERE id=$2 AND clinic_id=$3",[JSON.stringify(result),row.pet_id,clinic]);
    await client.query("INSERT INTO audit_trail(user_id,action,table_name,record_id,old_data,new_data) VALUES($1,'screening_reviewed','patient_registration_intakes',$2,$3::jsonb,$4::jsonb)",[req.user.id,id,JSON.stringify(old),JSON.stringify(result)]);
    await client.query('COMMIT');publish(clinic,'registration');return res.json({id,screening:result});
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});return next(error);}finally{client?.release();}
};
