const { test } = require('node:test');
const assert = require('node:assert/strict');

let calls;
let paid;
let visit;
const original = { id: 7, clinic_id: 2, appointment_id: 10, status: 'draft', metadata: { billing_review_status: 'returned' } };
const existing = [{ id: 21, item_type: 'lab_test' }, { id: 22, item_type: 'consultation' }];
const client = {
  async query(sql, args) {
    calls.push({ sql, args });
    if (sql.startsWith('SELECT * FROM invoices')) return { rows: [structuredClone(original)] };
    if (sql.startsWith('SELECT COALESCE(SUM')) return { rows: [{ paid }] };
    if (sql.startsWith('SELECT * FROM invoice_items')) return { rows: existing };
    if (sql.startsWith('SELECT a.id,a.pet_id')) return { rows: visit ? [visit] : [] };
    if (sql.startsWith('SELECT i.*,p.name')) return { rows: [{ id: 7, metadata: {}, items: [] }] };
    return { rows: [], rowCount: 1 };
  },
  release() {},
};
for (const [name, exports] of [
  ['../config/db', { pool: { connect: async () => client } }],
  ['../utils/clinicEvents', { publish() {} }],
]) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const { correct } = require('../controllers/invoiceReviewController');
const charge = (id, description = 'CBC') => ({ id, description, item_type: 'lab_test', quantity: 1, unit_price: 1000 });
async function submit(body) {
  calls = [];
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  let failure;
  await correct({ user: { id: 3, clinic_id: 2, role: 'doctor' }, params: { id: '7' }, body, ip: 'test' }, res, error => { failure = error; });
  if (failure) throw failure;
  return res;
}
test('returned summary saves added/removed charges and recalculates total with optional notes', async () => {
  paid = 0;
  const res = await submit({ items: [charge(21), { ...charge(-1, 'Treatment'), quantity: 2, unit_price: 250 }], tax: 25 });
  assert.equal(res.statusCode, 200);
  const update = calls.find(call => call.sql.startsWith('UPDATE invoices SET subtotal'));
  assert.deepEqual(update.args.slice(1, 4), [1500, 25, 1525]);
  const metadata = JSON.parse(update.args[4]);
  assert.equal(metadata.billing_review_status, 'pending');
  assert.equal(metadata.sent_to_reception, true);
  assert.equal(metadata.billing_activity[0].reason, 'Billing summary updated.');
  assert.deepEqual(calls.find(call => call.sql.startsWith('DELETE FROM invoice_items')).args, [7, [21]]);
  assert.ok(calls.some(call => call.sql.startsWith('INSERT INTO invoice_items') && call.args[2] === 'Treatment'));
  assert.ok(calls.some(call => call.sql === 'COMMIT'));
});
test('foreign invoice charge IDs are rejected before changes', async () => {
  paid = 0;
  const res = await submit({ items: [charge(999)] });
  assert.equal(res.statusCode, 400);
  assert.ok(calls.some(call => call.sql === 'ROLLBACK'));
  assert.ok(!calls.some(call => /^(UPDATE|DELETE|INSERT)/.test(call.sql)));
});
test('paid invoices cannot be corrected', async () => {
  paid = 100;
  const res = await submit({ items: [charge(21)] });
  assert.equal(res.statusCode, 409);
  assert.ok(!calls.some(call => /^(UPDATE|DELETE|INSERT)/.test(call.sql)));
});
test('invalid patient visit is rejected and rolled back', async () => {
  paid = 0; visit = null;
  const res = await submit({ items: [charge(21)], target_appointment_id: 99 });
  assert.equal(res.statusCode, 400);
  assert.ok(calls.some(call => call.sql.includes('a.clinic_id=$2') && call.args[0] === 99));
  assert.ok(calls.some(call => call.sql === 'ROLLBACK'));
});
test('attachment format is checked before opening a transaction', async () => {
  const res = await submit({ items: [charge(21)], attachments: [{ filename: 'bad.pdf', content_type: 'application/pdf', data: 'data:application/pdf;base64,aW52YWxpZA==' }] });
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});
test('clinical summary, visit snapshot and attachment changes save in one transaction', async () => {
  paid = 0;
  const summary = { chiefComplaint: 'Follow up', diagnosis: 'Healthy', clinicalFindings: 'Normal', plan: 'Monitor' };
  const details = { doctor: 'Dr. Example', appointment_type: 'Laboratory', visit_date: '2026-11-04', appointment_status: 'Finalized' };
  const res = await submit({ items: [charge(21)], clinical_summary: summary, visit_details: details, removed_attachment_ids: [30], attachments: [{ filename: 'report.pdf', content_type: 'application/pdf', data: 'data:application/pdf;base64,' + Buffer.from('%PDF-test').toString('base64') }] });
  assert.equal(res.statusCode, 200);
  const metadata = JSON.parse(calls.find(call => call.sql.startsWith('UPDATE invoices SET subtotal')).args[4]);
  assert.deepEqual(metadata.invoice_clinical_summary, summary);
  assert.deepEqual(metadata.billing_visit_details, details);
  assert.deepEqual(metadata.hidden_invoice_attachment_ids, [30]);
  assert.ok(calls.some(call => call.sql.startsWith('INSERT INTO attachments') && call.args[1] === 7));
  assert.ok(calls.some(call => call.sql === 'COMMIT'));
});
