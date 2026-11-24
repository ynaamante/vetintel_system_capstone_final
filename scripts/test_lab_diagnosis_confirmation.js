const assert = require('node:assert/strict');
const db = require('../config/db');
const controller = require('../controllers/clinicRecordController');

async function main() {
  const client = await db.pool.connect();
  const originalQuery = db.query;
  try {
    await client.query('BEGIN');
    db.query = client.query.bind(client);
    const patient = (await db.query(`SELECT p.id,p.clinic_id,u.id AS vet_id FROM pets p
      JOIN users u ON u.clinic_id=p.clinic_id JOIN roles r ON r.id=u.role_id
      WHERE lower(r.name) IN ('doctor','veterinarian') LIMIT 1`)).rows[0];
    assert.ok(patient, 'A clinic patient and veterinarian are required.');
    for (const [result, verified, classification, expected] of [
      ['Positive', true, 'suspected', 'confirmed'],
      ['Positive', true, 'probable', 'confirmed'],
      ['Negative', true, 'suspected', 'suspected'],
      ['Positive', false, 'suspected', 'suspected'],
      ['Positive', true, 'ruled_out', 'ruled_out'],
    ]) {
      const diagnosis = (await db.query(`INSERT INTO patient_diagnoses
        (clinic_id,pet_id,diagnosis,case_classification,clinical_status,veterinarian_id,recorded_by,recorded_at,record_status)
        VALUES($1,$2,'Canine Parvovirus',$3,'ongoing',$4,$4,now(),'finalized') RETURNING id`,
      [patient.clinic_id, patient.id, classification, patient.vet_id])).rows[0];
      const lab = (await db.query(`INSERT INTO lab_results(pet_id,clinic_id,test_name,results,metadata)
        VALUES($1,$2,'Canine Parvovirus Antigen Test','{}', $3::jsonb) RETURNING id`,
      [patient.id, patient.clinic_id, JSON.stringify({ diagnosis_id: diagnosis.id })])).rows[0];
      let saved;
      await controller.updateLabTest({ user: { id: patient.vet_id, clinic_id: patient.clinic_id, role: 'doctor' },
        params: { id: lab.id }, query: {}, body: { status: 'finalized', testResult: result,
          summary: 'Laboratory findings recorded', resultDate: '2026-01-01', resultTime: '10:00', verifyResults: verified } },
      { status(code) { throw Error(`Unexpected HTTP ${code}`); }, json(value) { saved = value; } }, error => { throw error; });
      assert.ok(saved);
      const current = (await db.query('SELECT * FROM patient_diagnoses WHERE id=$1', [diagnosis.id])).rows[0];
      assert.equal(current.case_classification, expected, `${result}, verified=${verified}, ${classification}`);
      assert.equal(current.clinical_status, 'ongoing');
      const audit = (await db.query("SELECT * FROM audit_trail WHERE table_name='patient_diagnoses' AND record_id=$1 AND action='confirm_diagnosis_from_lab'", [diagnosis.id])).rows;
      assert.equal(audit.length, expected === 'confirmed' ? 1 : 0);
    }
    console.log('PASS: verified positive confirms linked diagnosis; negative, unverified and ruled-out cases stay unchanged; clinical status and audit verified.');
  } finally {
    db.query = originalQuery;
    await client.query('ROLLBACK');
    client.release();
    await db.pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
