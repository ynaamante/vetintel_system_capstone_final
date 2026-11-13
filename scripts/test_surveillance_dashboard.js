const assert = require('node:assert/strict');
const db = require('../config/db');
const controller = require('../controllers/clinicRecordController');
async function main() {
  const client = await db.pool.connect(), originalQuery = db.query;
  try {
    await client.query('BEGIN');
    db.query = client.query.bind(client);
    const patient = (await db.query('SELECT id,clinic_id FROM pets ORDER BY id LIMIT 1')).rows[0];
    assert.ok(patient);
    const disease = `Dashboard persistence test ${Date.now()}`;
    await db.query(`INSERT INTO patient_diagnoses(clinic_id,pet_id,diagnosis,case_classification,clinical_status,clinical_assessment)
      VALUES($1,$2,$3,'suspected','ongoing','{"severity":"High"}'),($1,$2,$3,'confirmed','ongoing','{}'),($1,$2,$4,'ruled_out','ongoing','{}')`, [patient.clinic_id, patient.id, disease, disease + ' excluded']);
    await db.query("INSERT INTO patient_diagnoses(clinic_id,pet_id,diagnosis,case_classification,clinical_status,record_status) VALUES($1,$2,$3,'suspected','ongoing','draft'),($1,$2,'Needs assessment','suspected','ongoing','finalized')", [patient.clinic_id,patient.id,disease + ' draft']);
    async function get(query = {}, clinic = patient.clinic_id) {
      let status = 200, data;
      await controller.getDiseaseIntelligenceSummary({ user: { role: 'doctor', clinic_id: clinic }, query }, { status(value) { status = value; return this; }, json(value) { data = value; return this; } }, error => { throw error; });
      return { status, data };
    }
    for (const days of [30, 60, 90]) {
      const result = await get({ days });
      assert.equal(result.status, 200);
      assert.ok(!result.data.diseases.some(row => [disease.toLowerCase() + ' draft', 'needs assessment'].includes(row.disease.toLowerCase())));
      const item = result.data.diseases.find(item => item.disease.toLowerCase() === disease.toLowerCase());
      assert.equal(item.cases, 1, 'Same patient/day/disease is deduplicated');
      assert.equal(item.reporting_clinics, 1);
      assert.ok(item.last_reported);
      assert.ok(result.data.monthly_disease_trend.some(row => row.disease.toLowerCase() === disease.toLowerCase() && row.cases === 1));
      assert.ok(!result.data.diseases.some(row => row.disease.toLowerCase() === (disease + ' excluded').toLowerCase()));
      assert.ok(result.data.clinic_options.every(row => row.id === patient.clinic_id));
      assert.equal(result.data.total_cases, result.data.diseases.reduce((sum, row) => sum + row.cases, 0));
    }
    assert.equal((await get({ days: 7 })).status, 400);
    const isolated = await get({ days: 30, clinic_id: 2147483647 });
    assert.equal(isolated.data.total_cases, 0);
    console.log('PASS: dashboard includes saved diagnoses, deduplicates cases, excludes ruled-out diagnoses, returns monthly disease trends and reporting metadata, validates periods and preserves clinic isolation. Test data rolled back.');
  } finally { db.query = originalQuery; await client.query('ROLLBACK'); client.release(); await db.pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
