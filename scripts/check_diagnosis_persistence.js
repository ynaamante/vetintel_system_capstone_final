// Read-only check of stored diagnoses against the running HTTP API.
const assert = require('node:assert/strict');
const db = require('../config/db');
const auth = require('../middleware/auth');
(async () => {
  const saved = await db.query(`SELECT d.id,d.pet_id,d.clinic_id,u.id AS user_id,r.name AS role
    FROM patient_diagnoses d JOIN users u ON u.clinic_id=d.clinic_id
    JOIN roles r ON r.id=u.role_id WHERE lower(r.name) IN ('doctor','veterinarian','assistant_doctor')
    ORDER BY d.created_at DESC LIMIT 1`);
  if (!saved.rows.length) {
    console.log('No persisted diagnoses available for an HTTP retrieval check.');
    return;
  }
  const row = saved.rows[0];
  const token = auth.signUserToken({ id: row.user_id, role: row.role, clinic_id: row.clinic_id });
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`http://localhost:3000/api/clinic-records/pets/${row.pet_id}/diagnoses`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.some(item => item.database_id === row.id), 'Stored diagnosis missing from live endpoint');
  }
  console.log('PASS: latest stored diagnosis returned by two independent HTTP requests. No data changed.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.pool.end());
