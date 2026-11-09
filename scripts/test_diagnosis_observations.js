const assert = require('node:assert/strict');
const db = require('../config/db');
const observations = require('../controllers/diagnosisObservationController');
async function main() {
  await observations.ensureSchema();
  const client = await db.pool.connect(), query = client.query.bind(client);
  const originalQuery = db.query, originalConnect = db.pool.connect;
  try {
    await query('BEGIN');
    const pet = (await query(`SELECT p.id,p.clinic_id,u.id AS vet_id FROM pets p JOIN users u ON u.clinic_id=p.clinic_id JOIN roles r ON r.id=u.role_id
      WHERE COALESCE(u.is_active,true) AND lower(r.name) IN ('doctor','veterinarian','assistant_doctor') ORDER BY p.id LIMIT 1`)).rows[0];
    assert.ok(pet);
    const diagnosis = (await query(`INSERT INTO patient_diagnoses(clinic_id,pet_id,diagnosis,case_classification,clinical_status,veterinarian_id)
      VALUES($1,$2,'Observation persistence test','suspected','ongoing',$3) RETURNING id`, [pet.clinic_id, pet.id, pet.vet_id])).rows[0];
    db.query = query;
    db.pool.connect = async () => ({ release() {}, query: (sql, args) => query(sql === 'BEGIN' ? 'SAVEPOINT observation_test' : sql === 'COMMIT' ? 'RELEASE SAVEPOINT observation_test' : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT observation_test' : sql, args) });
    async function invoke(method, body = {}, options = {}) {
      let status = 200, data;
      await observations[method]({ user: { id: pet.vet_id, name: 'Test veterinarian', role: options.role || 'doctor', clinic_id: options.clinic || pet.clinic_id }, params: { id: options.pet || pet.id, diagnosisId: diagnosis.id }, query: {}, body }, { setHeader() {}, status(value) { status = value; return this; }, json(value) { data = value; return this; } }, error => { throw error; });
      return { status, data };
    }
    const body = { notes: 'Observation saved in temporary test transaction.', observed_at: new Date().toISOString(), vitals: { temperature: '38.9', weight: '10' } };
    const saved = await invoke('create', body);
    assert.equal(saved.status, 201);
    const reloaded = await invoke('list');
    assert.equal(reloaded.status, 200);
    assert.ok(reloaded.data.some(item => item.id === saved.data.id && item.notes === body.notes && item.vitals.temperature === '38.9'));
    assert.equal((await invoke('create', body, { role: 'owner' })).status, 403);
    assert.equal((await invoke('list', {}, { role: 'receptionist' })).status, 403);
    assert.equal((await invoke('list', {}, { clinic: 2147483647 })).status, 404);
    assert.equal((await invoke('list', {}, { pet: 2147483647 })).status, 404);
    assert.equal((await invoke('create', { ...body, notes: '' })).status, 422);
    assert.equal((await invoke('create', { ...body, vitals: { weight: '-1' } })).status, 422);
    assert.equal((await invoke('create', { ...body, observed_at: '2099-01-01' })).status, 422);
    const audit = await query("SELECT id FROM audit_trail WHERE table_name='diagnosis_observations' AND record_id=$1 AND action='create_observation'", [saved.data.id]);
    assert.equal(audit.rows.length, 1);
    console.log('PASS: observation creation, reload persistence, vitals, audit, permissions, patient/clinic isolation, invalid dates and values. Test records rolled back.');
  } finally { db.query = originalQuery; db.pool.connect = originalConnect; await query('ROLLBACK'); client.release(); await db.pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
