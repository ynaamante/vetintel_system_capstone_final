// Integration test against the configured database. All changes are rolled back.
const assert = require('node:assert/strict');
const db = require('../config/db');
const events = require('../utils/clinicEvents');
const originalPublish = events.publish;
events.publish = () => {};
const care = require('../controllers/ownerCareController');
const reception = require('../controllers/receptionAppointmentController');
const records = require('../controllers/clinicRecordController');
const photos = require('../controllers/ownerPetPhotoController');
const accounts = require('../controllers/petOwnerAccountController');
async function invoke(handler, user, body = {}, params = {}) {
  let status = 200, data;
  await handler({ user, body, params, query: {} }, { status(code) { status = code; return this; }, json(value) { data = value; return this; } }, e => { throw e; });
  return { status, data };
}
(async () => {
  const connection = await db.pool.connect(), query = connection.query.bind(connection);
  const originalQuery = db.query, originalConnect = db.pool.connect;
  try {
    // Apply the additive production migration; photo test data is rolled back below.
    await query('ALTER TABLE pet_owner_pets ADD COLUMN IF NOT EXISTS photo_url TEXT');
    await query('BEGIN');
    db.query = query;
    db.pool.connect = async () => ({ query: (sql, args) => query(sql === 'BEGIN' ? 'SAVEPOINT owner_care_test' : sql === 'COMMIT' ? 'RELEASE SAVEPOINT owner_care_test' : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT owner_care_test' : sql, args), release() {} });
    const fixture = (await query(`SELECT p.id,p.clinic_id,c.email,(SELECT id FROM users LIMIT 1) AS user_id
      FROM pets p JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id JOIN clinics cl ON cl.id=p.clinic_id
      WHERE trim(c.email)<>'' AND COALESCE((p.metadata->>'archived')::boolean,false)=false
        AND COALESCE(cl.archived,false)=false LIMIT 1`)).rows[0];
    assert.ok(fixture, 'Need one active clinic pet with an owner email.');
    const user = { id: fixture.user_id, email: fixture.email, role: 'user' };
    const stranger = { ...user, email: 'owner-care-isolation-test@example.invalid' };
    const overview = await invoke(care.overview, user);
    assert.equal(overview.status, 200);
    assert.ok(overview.data.clinicPets.some(p => String(p.id) === String(fixture.id)));
    const isolated = await invoke(care.overview, stranger);
    assert.equal(isolated.data.clinicPets.length, 0);
    assert.equal(isolated.data.appointments.length, 0);
    assert.equal((await invoke(care.overview, { ...user, role: 'doctor' })).status, 403);
    const originalPet = (await query('SELECT * FROM pets WHERE id=$1', [fixture.id])).rows[0];
    const petParams = { id: String(fixture.id) };
    const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
    assert.equal((await invoke(photos.clinic, stranger, { data: photo }, petParams)).status, 404);
    assert.equal((await invoke(photos.clinic, user, { data: 'data:image/jpeg;base64,aGVsbG8=' }, petParams)).status, 422);
    assert.equal((await invoke(photos.clinic, user, { data: 'data:image/jpeg;base64,' + 'A'.repeat(1400000) }, petParams)).status, 413);
    assert.equal((await invoke(photos.clinic, user, { data: photo }, petParams)).status, 201);
    assert.equal((await invoke(care.overview, user)).data.clinicPets.find(p => String(p.id) === String(fixture.id)).photo_url, photo);
    assert.equal((await query(`SELECT url FROM attachments WHERE owner_table='pets' AND owner_id=$1 AND clinic_id=$2 AND metadata->>'source'='pet_profile_photo' ORDER BY uploaded_at DESC,id DESC LIMIT 1`, [fixture.id,fixture.clinic_id])).rows[0].url, photo, 'Doctor and owner share the stored photo.');
    const personalId = (await query(`INSERT INTO pet_owner_pets(owner_id,name,species) VALUES($1,'Photo Test','dog') RETURNING id`, [user.id])).rows[0].id;
    assert.equal((await invoke(photos.personal, { ...user, id: -1 }, { data: photo }, { id: personalId })).status, 404);
    assert.equal((await invoke(photos.personal, user, { data: photo }, { id: personalId })).status, 201);
    assert.equal((await invoke(accounts.getPet, user, {}, { id: personalId })).data.photo_url, photo);
    assert.equal((await invoke(care.updatePet, stranger, { name: 'Not allowed' }, petParams)).status, 404);
    assert.equal((await invoke(care.updatePet, user, { name: '' }, petParams)).status, 422);
    assert.equal((await invoke(care.updatePet, user, { weight: -1 }, petParams)).status, 422);
    assert.equal((await invoke(care.updatePet, user, { birth_date: '2026-02-30' }, petParams)).status, 422);
    const edited = await invoke(care.updatePet, user, { name: 'Owner Edit Test', breed: 'Updated breed', weight: '8.5', color: 'Brown', client_id: -1, metadata: { allergies: 'Do not change' } }, petParams);
    assert.equal(edited.status, 200);
    assert.equal(edited.data.name, 'Owner Edit Test');
    assert.equal(Number(edited.data.weight), 8.5);
    const savedPet = (await query('SELECT * FROM pets WHERE id=$1', [fixture.id])).rows[0];
    assert.equal(savedPet.client_id, originalPet.client_id, 'Owner association is preserved.');
    assert.equal(savedPet.metadata.allergies, originalPet.metadata?.allergies, 'Medical metadata is preserved.');
    assert.equal(savedPet.sex, originalPet.sex, 'Omitted profile fields are preserved.');
    assert.equal((await invoke(care.overview, user)).data.clinicPets.find(p => String(p.id) === String(fixture.id)).name, 'Owner Edit Test');
    const body = { pet_id: String(fixture.id), clinic_id: String(fixture.clinic_id), start_time: new Date(Date.now() + 900 * 86400000).toISOString(), reason: 'Owner care integration test', notes: 'Rolled back' };
    assert.equal((await invoke(care.book, stranger, body)).status, 403);
    assert.equal((await invoke(care.book, user, { ...body, start_time: 'invalid' })).status, 422);
    assert.equal((await invoke(care.book, user, { ...body, start_time: '2020-01-01' })).status, 422);
    const booking = await invoke(care.book, user, body);
    assert.equal(booking.status, 201);
    assert.equal(booking.data.status, 'pending');
    assert.equal((await invoke(care.book, user, body)).status, 409);
    assert.ok((await invoke(care.overview, user)).data.appointments.some(a => String(a.id) === String(booking.data.id)));
    const staff = { id: fixture.user_id, clinic_id: fixture.clinic_id, role: 'receptionist' };
    const clinicList = await invoke(records.listAppointments, staff);
    assert.equal(clinicList.data.find(a => String(a.id) === String(booking.data.id)).status, 'pending', 'Doctor and reception lists show the request as pending.');
    assert.equal((await invoke(reception.act, staff, { action: 'confirm' }, { id: booking.data.id })).status, 200);
    const confirmed = (await invoke(care.overview, user)).data.appointments.find(a => String(a.id) === String(booking.data.id));
    assert.equal(confirmed.status, 'scheduled');
    console.log('PASS: clinic and personal photos persist; doctor photo linkage, invalid/oversized image rejection, owner isolation, profile edits, booking, and reception synchronization. All test data rolled back.');
  } finally {
    await query('ROLLBACK'); db.query = originalQuery; db.pool.connect = originalConnect; events.publish = originalPublish;
    connection.release(); await db.pool.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
