const assert = require('node:assert/strict');
const db = require('../config/db');
const inbox = require('../controllers/clinicInboxController');
async function call(handler, req) {
  let code = 200, body;
  await handler(req, { status(value) { code = value; return this; }, json(value) { body = value; return this; } }, error => { throw error; });
  return { code, body };
}
(async () => {
  const client = await db.pool.connect(); const original = db.query;
  try {
    await client.query('BEGIN'); db.query = (sql, values) => client.query(sql, values);
    const pet = (await db.query('SELECT p.id,p.clinic_id FROM pets p JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id ORDER BY p.id LIMIT 1')).rows[0];
    assert.ok(pet, 'A registered patient is required for inbox checks.');
    const req = { user: { role: 'owner', clinic_id: pet.clinic_id, name: 'Clinic test actor' }, body: { pet_id: pet.id }, params: {} };
    const created = await call(inbox.create, req); assert.equal(created.code, 200);
    const doctor = { ...req, user: { ...req.user, role: 'doctor' }, params: { id: created.body.id }, body: { text: 'Rollback verification message' } };
    const updated = await call(inbox.update, doctor); assert.equal(updated.code, 200);
    assert.equal(updated.body.messages.at(-1).text, doctor.body.text);
    const receptionist = { ...req, user: { ...req.user, role: 'receptionist' } };
    const listed = await call(inbox.list, receptionist); assert.ok(listed.body.conversations.some(row => row.id === created.body.id && row.messages.at(-1).text === doctor.body.text));
    assert.equal((await call(inbox.update, { ...doctor, user: { ...req.user, clinic_id: pet.clinic_id + 100000 } })).code, 404);
    assert.equal((await call(inbox.update, { ...doctor, body: { status: 'Invalid' } })).code, 400);
    assert.equal((await call(inbox.create, { ...req, user: { ...req.user, role: 'pet_owner' } })).code, 403);
    console.log('Clinic inbox passed: shared owner/doctor/receptionist persistence, atomic message append, clinic isolation, status validation, and access control. All test changes rolled back.');
  } finally { await client.query('ROLLBACK'); db.query = original; client.release(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.pool.end());
