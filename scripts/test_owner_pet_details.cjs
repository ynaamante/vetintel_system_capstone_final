const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('../config/db');
const controller = require('../controllers/petOwnerAccountController');
async function call(handler, user, params = {}, body = {}) {
  const result = { status: 200 };
  const response = { status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; } };
  await handler({ user, params, body }, response, error => { throw error; });
  return result;
}
(async () => {
  const email = `pet-details-test-${crypto.randomBytes(8).toString('hex')}@example.test`;
  let id;
  try {
    id = (await db.query('INSERT INTO users(name,email,is_active) VALUES($1,$2,false) RETURNING id', ['Pet Details Test', email])).rows[0].id;
    const owner = { id, role: 'user' };
    const created = await call(controller.addPet, owner, {}, { name: 'Pearl Test', species: 'dog', breed: 'Shih Tzu', age: '3', weight: '5', color: 'White' });
    assert.equal(created.status, 201);
    const params = { id: String(created.body.id) };
    const found = await call(controller.getPet, owner, params);
    assert.equal(found.body.name, 'Pearl Test');
    assert.equal((await call(controller.getPet, { id: -1, role: 'user' }, params)).status, 404, 'Other accounts cannot read the pet.');
    assert.equal((await call(controller.updatePet, { id: -1, role: 'user' }, params, { name: 'Wrong Owner' })).status, 404, 'Other accounts cannot edit the pet.');
    assert.equal((await call(controller.updatePet, owner, params, { weight: -1 })).status, 400);
    const updated = await call(controller.updatePet, owner, params, { name: 'Pearl Updated', weight: '', owner_id: -1 });
    assert.equal(updated.body.name, 'Pearl Updated');
    assert.equal(updated.body.weight, null);
    assert.equal(updated.body.species, 'dog', 'Omitted fields are preserved.');
    assert.equal((await call(controller.getPet, owner, params)).body.name, 'Pearl Updated', 'Edits persist in the database.');
    assert.equal((await call(controller.getPet, owner, { id: 'not-an-id' })).status, 400);
    console.log('PASS: saved pet lookup, string IDs, persisted edits, omitted fields, validation, and owner isolation. Temporary data removed.');
  } finally {
    if (id) await db.query('DELETE FROM users WHERE id=$1 AND email=$2', [id, email]);
    await db.pool.end();
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
