// Runs against the configured database; all fixture records are rolled back.
const assert = require('node:assert/strict');
const db = require('../config/db');
const controller = require('../controllers/patientRegistrationController');

async function main() {
  const { registrationActions } = await import('../admin/src/utils/registrationActions.js');
  assert.deepEqual(registrationActions('Draft'), ['continue', 'details', 'delete']);
  assert.deepEqual(registrationActions('Needs review'), ['details', 'attachments', 'review', 'history']);
  assert.deepEqual(registrationActions('Waiting on reception'), ['edit', 'feedback', 'details', 'history']);
  assert.deepEqual(registrationActions('Approved'), ['patient', 'details', 'attachments', 'history']);
  assert.deepEqual(registrationActions('Rejected'), ['rejection', 'details', 'history']);
  assert.deepEqual(registrationActions('Withdrawn'), ['details', 'history']);
  const connection = await db.pool.connect();
  const query = connection.query.bind(connection);
  const originalQuery = db.query;
  const originalConnect = db.pool.connect;
  try {
    await query('BEGIN');
    const staff = await query(`SELECT u.id, u.clinic_id,
      lower(regexp_replace(trim(r.name), '[[:space:]-]+', '_', 'g')) AS role
      FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.clinic_id IS NOT NULL AND COALESCE(u.is_active, true)`);
    const reception = staff.rows.find(r => r.role === 'receptionist'
      && staff.rows.some(d => d.clinic_id === r.clinic_id && ['doctor', 'assistant_doctor', 'veterinarian'].includes(d.role)));
    assert.ok(reception, 'A receptionist and active doctor in the same clinic are required.');
    const doctor = staff.rows.find(d => d.clinic_id === reception.clinic_id && ['doctor', 'assistant_doctor', 'veterinarian'].includes(d.role));
    db.query = query;
    db.pool.connect = async () => ({
      query: (sql, params) => query(sql === 'BEGIN' ? 'SAVEPOINT registration_action'
        : sql === 'COMMIT' ? 'RELEASE SAVEPOINT registration_action'
          : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT registration_action' : sql, params),
      release() {},
    });
    const invoke = async (method, user, body = {}, id) => {
      let status = 200;
      let result;
      await controller[method]({ user, body, params: { id } }, {
        status(code) { status = code; return this; },
        json(value) { result = value; return this; },
      }, error => { throw error; });
      assert.ok(status < 400, `${method}: ${status} ${JSON.stringify(result)}`);
      return result;
    };
    const payload = {
      assigned_doctor_id: doctor.id,
      owner: { name: 'Workflow Test', phone: '09123456789', email: 'workflow-test@example.com', address: 'Test address' },
      pet: { name: 'Workflow Pet', species: 'Dog', sex: 'male', age_value: '2', age_unit: 'Years', reason_for_visit: 'Vomiting since yesterday; reduced appetite.', screening_inputs: {symptoms:['vomiting','bloody_stool'],exposures:['unknown']}, triage_priority:'routine' },
      attachments: [],
    };
    const intake = await invoke('submitIntake', reception, payload);
    assert.equal(intake.notification_sent, true);
    const stored = (await query('SELECT pet_data FROM patient_registration_intakes WHERE id=$1',[intake.id])).rows[0];
    assert.equal(stored.pet_data.reason_for_visit,payload.pet.reason_for_visit);
    assert.equal(stored.pet_data.triage_priority,'urgent');
    assert.equal(stored.pet_data.infection_risk,'possible_infection');
    const notification = (await query('SELECT text,recipient_user_id FROM clinic_notifications WHERE related_intake_id=$1 ORDER BY id DESC LIMIT 1',[intake.id])).rows[0];
    assert.equal(notification.recipient_user_id,doctor.id);
    assert.ok(notification.text.includes(payload.pet.reason_for_visit));
    assert.ok(notification.text.includes('Urgent') && notification.text.includes('Possible infection') && notification.text.includes('Preliminary'));
    assert.ok((await invoke('listIntakes', doctor)).some(i => i.id === intake.id));
    const unrelated = { ...doctor, id: -1 };
    assert.ok(!(await invoke('listIntakes', unrelated)).some(i => i.id === intake.id));
    await invoke('returnForCorrection', doctor, { reason: 'Please confirm the address.' }, intake.id);
    assert.equal((await invoke('listIntakes', reception)).find(i => i.id === intake.id).status, 'Waiting on reception');
    await invoke('resubmitIntake', reception, payload, intake.id);
    const approved = await invoke('reviewIntake', doctor, { action: 'approve' }, intake.id);
    assert.equal(approved.status, 'Approved');
    assert.ok(approved.client_id && approved.pet_id);
    assert.equal((await invoke('listIntakes', reception)).find(i => i.id === intake.id).status, 'Approved');
    const reviewed = (await invoke('listIntakes', reception)).find(i => i.id === intake.id);
    assert.deepEqual(reviewed.audit_events.map(event => event.action), ['approved', 'edited_and_resubmitted', 'changes_requested', 'submitted']);
    assert.ok(reviewed.audit_events.every(event => event.timestamp && event.user));
    const patientRecord = await invoke('getPatientRecord', reception, {}, intake.id);
    assert.equal(patientRecord.id, approved.pet_id);
    assert.equal(patientRecord.name, payload.pet.name);
    assert.equal(patientRecord.reason_for_visit,payload.pet.reason_for_visit);
    assert.equal(patientRecord.screening.effective.triage_priority,'urgent');
    assert.equal(patientRecord.screening.suggested.infection_risk,'possible_infection');
    assert.equal(patientRecord.screening.rule_version,'intake-screening-v1');
    const summary=(await invoke('getPatientIntakeSummary',doctor,{},approved.pet_id)).intake;
    assert.equal(summary.id,intake.id);
    assert.equal(summary.status,'Approved');
    assert.equal(summary.owner_data.name,payload.owner.name);
    assert.equal(summary.pet_data.name,payload.pet.name);
    assert.ok(Array.isArray(summary.attachments));
    assert.equal(summary.attachments.length,0);
    assert.equal(summary.reason_for_visit,payload.pet.reason_for_visit);
    assert.deepEqual(summary.screening.inputs.symptoms,payload.pet.screening_inputs.symptoms);
    await query("UPDATE patient_registration_intakes SET status='Needs review' WHERE id=$1",[intake.id]);
    assert.equal((await invoke('getPatientIntakeSummary',doctor,{},approved.pet_id)).intake,null);
    await query("UPDATE patient_registration_intakes SET status='Approved' WHERE id=$1",[intake.id]);
    assert.ok(!('notes' in patientRecord));
    const pet = await query('SELECT id FROM pets WHERE id = $1 AND clinic_id = $2', [approved.pet_id, doctor.clinic_id]);
    assert.equal(pet.rows.length, 1);
    const review = await invoke('reviewScreening',doctor,{triage_priority:'priority',infection_risk:'needs_assessment',note:'Veterinarian reviewed the reported symptoms.'},intake.id);
    assert.equal(review.screening.review.overridden,true);
    assert.equal(review.screening.suggested.triage_priority,'urgent');
    assert.equal(review.screening.effective.triage_priority,'priority');
    const afterReview=await invoke('getPatientRecord',reception,{},intake.id);
    assert.equal(afterReview.screening.effective.triage_priority,'priority');
    const updatedSummary=(await invoke('getPatientIntakeSummary',doctor,{},approved.pet_id)).intake;
    assert.equal(updatedSummary.screening.effective.triage_priority,'priority');
    assert.equal(updatedSummary.screening.review.reviewed_by,doctor.id);
    let foreignStatus;
    await controller.getPatientIntakeSummary({user:{...doctor,clinic_id:2147483647},params:{id:approved.pet_id}},{status(code){foreignStatus=code;return this},json(){}},error=>{throw error});
    assert.equal(foreignStatus,404);
    const intakeAfterReview=(await invoke('listIntakes',doctor)).find(row=>row.id===intake.id);
    assert.equal(intakeAfterReview.pet_data.screening.review.reviewed_by,doctor.id);
    assert.ok(intakeAfterReview.audit_events.some(event=>event.action==='screening_reviewed'));
    let forbiddenStatus;
    await controller.reviewScreening({user:{...doctor,id:-1},params:{id:intake.id},body:{triage_priority:'routine',infection_risk:'not_indicated',note:'Not assigned'}},{status(code){forbiddenStatus=code;return this},json(){}},error=>{throw error});
    assert.equal(forbiddenStatus,409);
    console.log('PASS: status actions, submission, visibility, correction, resubmission, approval, audit timestamps/users, and reception patient-record access.');
  } finally {
    db.query = originalQuery;
    db.pool.connect = originalConnect;
    await query('ROLLBACK');
    connection.release();
    await db.pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
