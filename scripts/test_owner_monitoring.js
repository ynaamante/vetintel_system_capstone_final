const assert = require('node:assert/strict');
const db = require('../config/db');
const monitoring = require('../controllers/ownerMonitoringController');

async function invoke(handler, req) {
  let code = 200, body;
  await handler(req, { status(value) { code = value; return this; }, json(value) { body = value; return this; } }, error => { throw error; });
  return { code, body };
}
(async () => {
  const clinics = (await db.query('SELECT id FROM clinics ORDER BY id LIMIT 2')).rows;
  assert.ok(clinics.length, 'A clinic is needed for read-only API checks.');
  const id = clinics[0].id;
  const req = { user: { role: 'owner', clinic_id: id }, query: { clinic_id: String(clinics[1]?.id || id + 1), days: '30' } };
  assert.equal((await invoke(monitoring.summary, { ...req, user: { role: 'receptionist', clinic_id: id } })).code, 403);
  assert.equal((await invoke(monitoring.summary, { ...req, user: { role: 'owner' } })).code, 400);
  const summary = await invoke(monitoring.summary, req);
  assert.equal(summary.code, 200); assert.equal(summary.body.clinic_id, id);
  for (const key of ['pets', 'clients', 'appointments', 'invoices', 'payments', 'vaccinations', 'inventory', 'activity', 'staff']) assert.ok(Array.isArray(summary.body[key]), key);
  for (const key of ['pets', 'clients', 'inventory']) for (const row of summary.body[key]) if (row.clinic_id != null) assert.equal(Number(row.clinic_id), id);
  const status = await invoke(monitoring.dataStatus, req);
  assert.equal(status.code, 200); assert.equal(status.body.mode, 'shared_database');
  assert.equal(Number(status.body.payments), summary.body.payments.length);
  const report = await invoke(monitoring.report, req);
  assert.equal(report.code, 200); assert.equal(report.body.clinic_id, id); assert.ok(Array.isArray(report.body.diseases));
  const { financialData, clinicDay } = await import('../admin/src/utils/ownerMonitoring.js');
  const fake = { invoices: [{ id: 1, total: 200, amount_paid: 75, items: [{ item_type: 'vaccination', line_total: 100 }, { item_type: 'consultation', line_total: 100 }] }, { id: 2, status: 'void', total: 500 }], payments: [{ id: 7, invoice_id: 1, amount: 75, paid_at: '2026-11-04T16:30:00Z' }] };
  const financial = financialData(fake, 'Monthly', new Date('2026-11-05T01:00:00Z'));
  assert.equal(clinicDay('2026-11-04T16:30:00Z'), '2026-11-05');
  assert.equal(financial.today, 75); assert.equal(financial.outstanding, 125);
  assert.equal(financial.services.reduce((sum, row) => sum + row.revenue, 0), 75);
  assert.equal(financialData(fake, 'Quarterly', new Date('2027-02-01T00:00:00Z')).transactions.length, 0);
  console.log('Owner monitoring passed: live endpoint shapes, shared payment totals, clinic isolation, role access, report data, Manila dates, partial payments, void balances, service allocation, and period filters.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.pool.end());
