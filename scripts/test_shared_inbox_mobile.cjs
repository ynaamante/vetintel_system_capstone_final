const assert = require('node:assert/strict');
const db = require('../config/db');
const staff = require('../controllers/clinicInboxController');
const owner = require('../controllers/ownerInboxController');
async function call(handler, req) {
  let code = 200, body;
  await handler(req, { status(value) { code = value; return this; }, json(value) { body = value; return this; } }, error => { throw error; });
  return { code, body };
}
(async () => {
  const client = await db.pool.connect();
  const original = db.query;
  try {
    await client.query('BEGIN'); db.query = (sql, values) => client.query(sql, values);
    const pet = (await db.query(`SELECT p.id,p.clinic_id,c.email FROM pets p JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id
      JOIN clinics cl ON cl.id=p.clinic_id WHERE trim(COALESCE(c.email,''))<>'' AND COALESCE((p.metadata->>'archived')::boolean,false)=false
      AND COALESCE(cl.archived,false)=false ORDER BY p.id LIMIT 1`)).rows[0];
    assert.ok(pet, 'A linked patient with an owner email is needed for this rollback test.');
    const clinic = { user: { role: 'owner', clinic_id: pet.clinic_id, name: 'Inbox verification staff' }, params: { id: `pet-${pet.id}` }, body: { pet_id: pet.id } };
    const mobile = { user: { role: 'pet_owner', email: pet.email, name: 'Inbox verification owner' }, params: { id: `pet-${pet.id}` }, body: { pet_id: pet.id } };
    const created = await call(staff.create, clinic); assert.equal(created.code, 200);
    assert.equal((await call(owner.create, mobile)).body.id, created.body.id, 'Both clients must use the same conversation.');
    const sent = await call(staff.update, { ...clinic, body: { text: 'Public verification reply' } });
    assert.equal(sent.code, 200); assert.equal(sent.body.ownerUnread, true);
    const note = await call(staff.update, { ...clinic, body: { text: 'Private verification note', kind: 'internal_note' } });
    assert.equal(note.body.preview, 'Public verification reply', 'A private note must not replace the owner-facing preview.');
    const log = await call(staff.update, { ...clinic, body: { text: 'Private phone communication log', kind: 'communication_log' } });
    assert.equal(log.body.messages.length, note.body.messages.length, 'Logging must not send a message.');
    const mobileList = await call(owner.list, mobile);
    const thread = mobileList.body.find(row => row.id === created.body.id);
    assert.equal(thread.unread, true); assert.equal(thread.preview, 'Public verification reply');
    assert.ok(thread.messages.some(message => message.text === 'Public verification reply'));
    assert.ok(!JSON.stringify(thread).includes('Private verification note'));
    assert.ok(!JSON.stringify(thread).includes('Private phone communication log'));
    assert.equal(thread.history, undefined); assert.equal(thread.assignedTo, undefined);
    assert.equal((await call(owner.update, { ...mobile, body: { read: true } })).body.unread, false);
    const ownerReply = await call(owner.update, { ...mobile, body: { text: 'Owner verification reply' } });
    assert.equal(ownerReply.code, 200); assert.equal(ownerReply.body.messages.at(-1).source, 'Owner');
    const clinicList = await call(staff.list, clinic);
    const received = clinicList.body.conversations.find(row => row.id === created.body.id);
    assert.equal(received.unread, true); assert.equal(received.messages.at(-1).text, 'Owner verification reply');
    await call(staff.update, { ...clinic, body: { unread: false } });
    const answered = await call(staff.update, { ...clinic, body: { text: 'Clinic answers owner' } });
    assert.equal(answered.body.unread, false); assert.equal(answered.body.ownerUnread, true);
    const stranger = { ...mobile, user: { ...mobile.user, email: 'unlinked-inbox-test@example.invalid' } };
    assert.deepEqual((await call(owner.list, stranger)).body, []);
    assert.equal((await call(owner.update, { ...stranger, body: { text: 'Unauthorized' } })).code, 404);
    assert.equal((await call(owner.create, stranger)).code, 404);
    assert.equal((await call(owner.update, { ...mobile, body: { text: 'Hidden note attempt', kind: 'internal_note' } })).code, 400);
    assert.equal((await call(owner.update, { ...mobile, body: { status: 'Resolved' } })).code, 400);
    assert.equal((await call(owner.update, { ...mobile, body: { text: ' ' } })).code, 400);
    assert.equal((await call(owner.update, { ...mobile, body: { text: 'a'.repeat(4001) } })).code, 400);
    assert.equal((await call(staff.update, { ...clinic, user: { ...clinic.user, clinic_id: pet.clinic_id + 100000 }, body: { text: 'Wrong clinic' } })).code, 404);
    assert.equal((await call(owner.list, clinic)).code, 403);
    const share = { id: 'inbox-attachment-rollback-test', createdAt: new Date().toISOString(), records: [{ id: 'lab:rollback-test', type: 'lab', title: 'Verified shared lab result', detail: 'Owner-visible record snapshot.' }] };
    await db.query(`UPDATE pets SET metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('owner_shared_records',
      COALESCE(metadata->'owner_shared_records','[]'::jsonb) || jsonb_build_array($2::jsonb)) WHERE id=$1`, [pet.id, JSON.stringify(share)]);
    const attached = await call(owner.update, { ...mobile, body: { text: '', sharedRecord: { shareId: share.id, recordId: 'lab:rollback-test' } } });
    assert.equal(attached.code, 200);
    assert.equal(attached.body.messages.at(-1).sharedRecord.title, 'Verified shared lab result');
    const staffAttachment = (await call(staff.list, clinic)).body.conversations.find(row => row.id === created.body.id).messages.at(-1);
    assert.equal(staffAttachment.sharedRecord.detail, 'Owner-visible record snapshot.');
    assert.equal((await call(owner.update, { ...mobile, body: { sharedRecord: { shareId: 'another-patient-share', recordId: 'lab:rollback-test' } } })).code, 404);
    assert.equal((await call(owner.update, { ...mobile, body: { sharedRecord: { shareId: share.id, recordId: 'lab:rollback-test', title: 'Forged title' } } })).code, 400);
    const policy = require('../middleware/clinicRbac');
    const catalog = require('../data/permissionCatalog.json');
    const permitted = async (actions, body) => {
      const permissions = Object.fromEntries(catalog.groups.map(([group, items]) => [group, Object.fromEntries(items.map(item => [item, actions.includes(item)]))]));
      let passed = false;
      await policy.guard({ path: '/clinic-records/inbox/pet-1', method: 'PATCH', body, user: { role: 'doctor', clinic_id: pet.clinic_id, permissions } },
        { status() { return this; }, json() {} }, error => { if (error) throw error; passed = true; });
      return passed;
    };
    assert.equal(await permitted(['Manage Conversations'], { text: 'Unauthorized send' }), false);
    assert.equal(await permitted(['Send Pet Owner Messages'], { text: 'Authorized reply' }), true);
    assert.equal(await permitted(['Send Pet Owner Messages'], { text: 'Private note', kind: 'internal_note' }), false);
    assert.equal(await permitted(['Manage Conversations'], { text: 'Private note', kind: 'internal_note' }), true);
    console.log('Shared Inbox passed: clinic/mobile two-way messages, separate read flags, private note/log isolation, linked-patient ownership, clinic isolation, and validation. All database changes rolled back.');
  } finally { await client.query('ROLLBACK'); db.query = original; client.release(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.pool.end());
