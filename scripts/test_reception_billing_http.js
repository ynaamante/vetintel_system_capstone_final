// Real HTTP routes + authentication + PostgreSQL. All database changes roll back.
const assert = require('node:assert/strict');
require('dotenv').config();
const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const routes = require('../routes/api');

async function main() {
  const client = await db.pool.connect();
  const query = client.query.bind(client);
  const originalQuery = db.query;
  const originalConnect = db.pool.connect;
  let server;
  let invoiceId;
  let rolledBack = false;
  try {
    await query('BEGIN');
    await query("SET LOCAL statement_timeout = '20s'");
    const receptionist = (await query(`SELECT u.id,u.clinic_id,r.name AS role
      FROM users u JOIN roles r ON r.id=u.role_id
      WHERE lower(r.name)='receptionist' AND COALESCE(u.is_active,true)
      AND EXISTS(SELECT 1 FROM clients c WHERE c.clinic_id=u.clinic_id)
      ORDER BY u.id LIMIT 1`)).rows[0];
    assert.ok(receptionist, 'An active receptionist and clinic client are needed for this integration test.');
    const fixture = (await query(`INSERT INTO invoices(clinic_id,client_id,status,currency,subtotal,tax,total,issued_at,metadata)
      SELECT $1,id,'issued','PHP',100,0,100,now(),'{"sent_to_reception":true,"test":"rollback_billing_http"}'::jsonb
      FROM clients WHERE clinic_id=$1 ORDER BY id LIMIT 1 RETURNING id`, [receptionist.clinic_id])).rows[0];
    invoiceId = fixture.id;

    // Endpoint commits become savepoints inside the outer rollback transaction.
    // This exercises the real SQL without saving test payments or accrued charges.
    db.query = query;
    db.pool.connect = async () => ({
      query: (sql, args) => query(sql === 'BEGIN' ? 'SAVEPOINT billing_http_action'
        : sql === 'COMMIT' ? 'RELEASE SAVEPOINT billing_http_action'
          : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT billing_http_action' : sql, args),
      release() {},
    });
    const app = express();
    app.use(express.json());
    app.use('/api', routes);
    app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
      res.status(500).json({ error: error.message });
    });
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const token = auth.signUserToken({ ...receptionist, exp: Date.now() + 60000 });
    const call = async (path, { method = 'GET', body, actorToken = token } = {}) => {
      const response = await fetch(base + path, {
        method,
        headers: { ...(actorToken ? { Authorization: `Bearer ${actorToken}` } : {}), 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, data: await response.json() };
    };
    const paymentPath = `/clinic-records/invoices/${invoiceId}/payments`;
    assert.equal((await call('/clinic-records/invoices', { actorToken: null })).status, 401);
    for (const endpoint of ['invoices', 'payments', 'inpatient-stays']) {
      const response = await call(`/clinic-records/${endpoint}?clinic_id=${receptionist.clinic_id}`);
      assert.equal(response.status, 200, `${endpoint}: ${JSON.stringify(response.data)}`);
      assert.ok(Array.isArray(response.data), `${endpoint} must return an array`);
    }
    const invoiceList = await call('/clinic-records/invoices?sent_to_reception=true');
    assert.ok(invoiceList.data.some(invoice => invoice.id === invoiceId), 'Test invoice must appear in the reception queue.');
    assert.equal((await call(paymentPath, { method: 'POST', body: { amount: -1, method: 'cash' } })).status, 400);
    assert.equal((await call(paymentPath, { method: 'POST', body: { amount: 101, method: 'cash' } })).status, 422);
    const doctorToken = auth.signUserToken({ ...receptionist, role: 'doctor', exp: Date.now() + 60000 });
    assert.equal((await call(paymentPath, { method: 'POST', actorToken: doctorToken, body: { amount: 10, method: 'cash' } })).status, 403);
    const otherClinicToken = auth.signUserToken({ ...receptionist, clinic_id: -1, exp: Date.now() + 60000 });
    assert.equal((await call(paymentPath, { method: 'POST', actorToken: otherClinicToken, body: { amount: 10, method: 'cash' } })).status, 404);

    const reviewPath = `/clinic-records/invoices/${invoiceId}/review`;
    assert.equal((await call(reviewPath, { method: 'POST', actorToken: doctorToken, body: { action: 'issue' } })).status, 403);
    const reviewOtherClinicToken = auth.signUserToken({ ...receptionist, clinic_id: Number(receptionist.clinic_id) + 1000000, exp: Date.now() + 60000 });
    assert.equal((await call(reviewPath, { method: 'POST', actorToken: reviewOtherClinicToken, body: { action: 'issue' } })).status, 404);
    assert.equal((await call(reviewPath, { method: 'POST', body: { action: 'return' } })).status, 400);
    const returned = await call(reviewPath, { method: 'POST', body: { action: 'return', reason: 'Rollback test: verify item quantity' } });
    assert.equal(returned.status, 200, JSON.stringify(returned.data));
    assert.equal(returned.data.status, 'draft');
    assert.equal(returned.data.metadata.billing_review_status, 'returned');
    assert.equal((await call(reviewPath, { method: 'POST', body: { action: 'issue' } })).status, 409);
    assert.equal((await call(paymentPath, { method: 'POST', body: { amount: 10, method: 'cash' } })).status, 409);
    const clinicalUser = (await query(`SELECT u.id,u.clinic_id,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id
      WHERE u.clinic_id=$1 AND lower(replace(r.name,' ','_')) IN ('doctor','assistant_doctor','veterinarian') AND COALESCE(u.is_active,true) LIMIT 1`, [receptionist.clinic_id])).rows[0];
    assert.ok(clinicalUser, 'Need an active doctor for the correction workflow.');
    const clinicalToken = auth.signUserToken({ ...clinicalUser, exp: Date.now() + 60000 });
    const doctorNotifications = await call('/notifications', { actorToken: clinicalToken });
    assert.ok(doctorNotifications.data.some(notification => notification.title === 'Billing needs correction' && notification.text.includes(String(invoiceId).padStart(4,'0'))));
    const charge = (await query("INSERT INTO invoice_items(invoice_id,description,quantity,unit_price,item_type) VALUES($1,'Rollback test consultation',1,100,'consultation') RETURNING id", [invoiceId])).rows[0];
    const correctionBody = { note: 'Corrected consultation quantity and unit price', tax: 0, items: [{ id: charge.id, description: 'Corrected consultation', quantity: 2, unit_price: 50 }] };
    const correctionPath = `/clinic-records/invoices/${invoiceId}/correct`;
    assert.equal((await call(correctionPath, { method: 'POST', body: correctionBody })).status, 403);
    const wrongClinicDoctorToken = auth.signUserToken({ ...clinicalUser, clinic_id: Number(clinicalUser.clinic_id) + 1000000, exp: Date.now() + 60000 });
    assert.equal((await call(correctionPath, { method: 'POST', actorToken: wrongClinicDoctorToken, body: correctionBody })).status, 404);
    assert.equal((await call(correctionPath, { method: 'POST', actorToken: clinicalToken, body: { ...correctionBody, items: [{ ...correctionBody.items[0], unit_price: 0.004 }] } })).status, 400);
    const corrected = await call(correctionPath, { method: 'POST', actorToken: clinicalToken, body: correctionBody });
    assert.equal(corrected.status, 200, JSON.stringify(corrected.data));
    assert.equal(Number(corrected.data.invoice.total), 100);
    assert.equal(corrected.data.invoice.metadata.billing_review_status, 'pending');
    assert.equal(corrected.data.invoice.items[0].description, 'Corrected consultation');
    assert.equal(Number(corrected.data.invoice.items[0].line_total), 100);
    assert.ok((await call('/notifications')).data.some(notification => notification.title === 'Corrected bill ready for review' && notification.text.includes(`#${invoiceId}`)));
    assert.equal((await call(correctionPath, { method: 'POST', actorToken: clinicalToken, body: correctionBody })).status, 409);
    const issued = await call(reviewPath, { method: 'POST', body: { action: 'issue' } });
    assert.equal(issued.status, 200, JSON.stringify(issued.data));
    assert.equal(issued.data.status, 'issued');
    assert.equal(issued.data.metadata.billing_activity.length, 3);
    assert.equal((await call(reviewPath, { method: 'POST', body: { action: 'issue' } })).status, 409);
    const voidFixture = (await query(`INSERT INTO invoices(clinic_id,client_id,status,currency,total,metadata)
      SELECT clinic_id,client_id,'issued','PHP',100,'{"test":"rollback_billing_review"}'::jsonb FROM invoices WHERE id=$1 RETURNING id`, [invoiceId])).rows[0];
    const voidFlags = { can_be_corrected: false, entire_invoice_invalid: true };
    assert.equal((await call(`/clinic-records/invoices/${voidFixture.id}/review`, { method: 'POST', body: { action: 'void', reason: 'Wrong charge' } })).status, 400);
    assert.equal((await call(`/clinic-records/invoices/${voidFixture.id}/review`, { method: 'POST', body: { action: 'void', reason: 'Wrong charge', reason_code: 'incorrect_billing_record', can_be_corrected: true, entire_invoice_invalid: true } })).status, 409);
    assert.equal((await call(`/clinic-records/invoices/${voidFixture.id}/review`, { method: 'POST', body: { action: 'void', reason: 'Only one item is invalid', reason_code: 'service_not_performed', can_be_corrected: false, entire_invoice_invalid: false, no_charges_owed: true } })).status, 409);
    const voided = await call(`/clinic-records/invoices/${voidFixture.id}/review`, { method: 'POST', body: { action: 'void', reason: 'Rollback test: wrong visit cannot be corrected', reason_code: 'incorrect_billing_record', ...voidFlags } });
    assert.equal(voided.status, 200, JSON.stringify(voided.data));
    assert.equal(voided.data.status, 'issued');
    assert.equal(voided.data.metadata.void_request_status, 'pending');
    assert.equal((await call('/clinic-records/invoices/'+voidFixture.id+'/payments',{method:'POST',body:{amount:1,method:'cash'}})).status,409);
    const decisionPath='/clinic-records/invoices/'+voidFixture.id+'/void-decision';
    assert.equal((await call(decisionPath,{method:'POST',actorToken:null,body:{decision:'approve'}})).status,401);
    assert.equal((await call(decisionPath,{method:'POST',body:{decision:'approve'}})).status,403);
    assert.equal((await call(decisionPath,{method:'POST',actorToken:wrongClinicDoctorToken,body:{decision:'approve'}})).status,404);
    assert.equal((await call(decisionPath,{method:'POST',actorToken:clinicalToken,body:{decision:'reject'}})).status,400);
    const rejected=await call(decisionPath,{method:'POST',actorToken:clinicalToken,body:{decision:'reject',reason:'Valid charges exist; keep this invoice.'}});
    assert.equal(rejected.status,200,JSON.stringify(rejected.data));
    assert.equal(rejected.data.status,'issued');
    assert.equal(rejected.data.metadata.void_request_status,'rejected');
    assert.ok((await call('/notifications')).data.some(notification=>notification.title==='Void request rejected' && notification.text.includes('#'+voidFixture.id)));
    assert.equal((await call(decisionPath,{method:'POST',actorToken:clinicalToken,body:{decision:'approve'}})).status,409);
    assert.equal((await call('/clinic-records/invoices/'+voidFixture.id+'/review',{method:'POST',body:{action:'void',reason:'Corrected request: invalid visit',reason_code:'incorrect_billing_record',...voidFlags}})).status,200);
    const approved=await call(decisionPath,{method:'POST',actorToken:clinicalToken,body:{decision:'approve'}});
    assert.equal(approved.status,200,JSON.stringify(approved.data));
    assert.equal(approved.data.status,'void');
    assert.equal(approved.data.metadata.void_request_status,'approved');
    assert.equal((await call(decisionPath,{method:'POST',actorToken:clinicalToken,body:{decision:'reject',reason:'Too late'}})).status,409);
    assert.ok((await call('/notifications')).data.some(notification=>notification.title==='Void request approved' && notification.text.includes('#'+voidFixture.id)));
    assert.ok((await call('/notifications', { actorToken: clinicalToken })).data.some(notification => notification.title === 'Invoice void request from reception' && notification.text.includes(String(voidFixture.id).padStart(4,'0'))));
    const voidLine = (await query("INSERT INTO invoice_items(invoice_id,description,quantity,unit_price,item_type) VALUES($1,'Voided test charge',1,100,'consultation') RETURNING id", [voidFixture.id])).rows[0];
    const targetVisit = (await query(`INSERT INTO appointments(clinic_id,pet_id,client_id,practitioner_id,start_time,status,reason)
      SELECT clinic_id,id,client_id,$2,now(),'completed','Rollback replacement visit' FROM pets WHERE clinic_id=$1 AND client_id IS NOT NULL ORDER BY id LIMIT 1 RETURNING id,pet_id,client_id`, [receptionist.clinic_id,clinicalUser.id])).rows[0];
    const replacementBody = { note: 'Replace incorrect voided charge', tax: 0, target_appointment_id: targetVisit.id, items: [{ id: voidLine.id, description: 'Corrected replacement charge', quantity: 1, unit_price: 90 }] };
    assert.equal((await call(`/clinic-records/invoices/${voidFixture.id}/correct`, { method: 'POST', actorToken: clinicalToken, body: { ...replacementBody, target_appointment_id: null } })).status, 400);
    const replacement = await call(`/clinic-records/invoices/${voidFixture.id}/correct`, { method: 'POST', actorToken: clinicalToken, body: replacementBody });
    assert.equal(replacement.status, 200, JSON.stringify(replacement.data));
    assert.equal(replacement.data.replacement, true);
    assert.notEqual(replacement.data.invoice.id, voidFixture.id);
    assert.equal(Number(replacement.data.invoice.total), 90);
    assert.equal(replacement.data.invoice.metadata.replaces_invoice_id, voidFixture.id);
    assert.equal(replacement.data.invoice.appointment_id, targetVisit.id);
    assert.equal(replacement.data.invoice.client_id, targetVisit.client_id);
    assert.equal(replacement.data.invoice.pet_id, targetVisit.pet_id);
    assert.equal(replacement.data.invoice.metadata.void_reason_code, undefined);
    assert.equal(replacement.data.invoice.metadata.void_request_status, undefined);
    assert.equal((await query('SELECT status FROM invoices WHERE id=$1', [voidFixture.id])).rows[0].status, 'void');
    assert.equal((await call(`/clinic-records/invoices/${voidFixture.id}/correct`, { method: 'POST', actorToken: clinicalToken, body: replacementBody })).status, 409);
    assert.ok((await call('/clinic-records/invoices?sent_to_reception=true')).data.some(invoice => invoice.id === replacement.data.invoice.id));
    const policies = await call('/clinic-records/billing-review-options');
    assert.equal(policies.data.void_reasons.length, 7);
    const retained = (await query(`INSERT INTO invoices(clinic_id,client_id,status,currency,total,metadata)
      SELECT clinic_id,client_id,'issued','PHP',100,'{}'::jsonb FROM invoices WHERE id=$1 RETURNING id`, [invoiceId])).rows[0];
    for (const code of ['duplicate_invoice','wrong_patient','service_not_performed','created_by_mistake','appointment_cancelled','invoice_replaced']) {
      const testInvoice = (await query(`INSERT INTO invoices(clinic_id,client_id,status,currency,total,metadata)
        SELECT clinic_id,client_id,'issued','PHP',100,$2::jsonb FROM invoices WHERE id=$1 RETURNING id`, [invoiceId,JSON.stringify({ pet_id: targetVisit.pet_id })])).rows[0];
      const body = { action:'void',reason:`Rollback policy test: ${code}`,reason_code:code,...voidFlags };
      if (['duplicate_invoice','invoice_replaced'].includes(code)) {
        assert.equal((await call(`/clinic-records/invoices/${testInvoice.id}/review`,{method:'POST',body})).status,400);
        body.related_invoice_id=retained.id;
      }
      if (['service_not_performed','appointment_cancelled'].includes(code)) {
        assert.equal((await call(`/clinic-records/invoices/${testInvoice.id}/review`,{method:'POST',body})).status,409);
        body.no_charges_owed=true;
      }
      let result=await call(`/clinic-records/invoices/${testInvoice.id}/review`,{method:'POST',body});
      assert.equal(result.status,200,JSON.stringify(result.data));
      assert.equal(result.data.metadata.void_request_status,'pending');
      result=await call(`/clinic-records/invoices/${testInvoice.id}/void-decision`,{method:'POST',actorToken:clinicalToken,body:{decision:'approve'}});
      assert.equal(result.status,200,JSON.stringify(result.data));
      assert.equal(result.data.metadata.void_reason_code,code);
      assert.equal(result.data.status,'void');
      if(code==='duplicate_invoice') {
        assert.equal(result.data.metadata.retained_invoice_id,retained.id);
        assert.equal((await query('SELECT status FROM invoices WHERE id=$1',[retained.id])).rows[0].status,'issued');
      }
      if(code==='invoice_replaced') {
        assert.equal(result.data.metadata.replacement_invoice_id,retained.id);
        assert.equal((await query('SELECT metadata FROM invoices WHERE id=$1',[retained.id])).rows[0].metadata.replaces_invoice_id,testInvoice.id);
      }
      assert.equal((await call(`/clinic-records/invoices/${testInvoice.id}/correct`,{method:'POST',actorToken:clinicalToken,body:replacementBody})).status,409);
    }
    assert.equal((await call(`/clinic-records/invoices/${voidFixture.id}/payments`, { method: 'POST', body: { amount: 1, method: 'cash' } })).status, 409);
    assert.equal((await call(paymentPath, { method: 'POST', body: { amount: 40, method: 'cash', paid_at: 'invalid' } })).status, 400);
    assert.equal((await call(paymentPath, { method: 'POST', body: { amount: 40, method: 'cash', paid_at: new Date(Date.now() + 86400000).toISOString() } })).status, 400);
    const recordedDate = new Date(Date.now() - 3600000).toISOString();
    const first = await call(paymentPath, { method: 'POST', body: { amount: 40, method: 'cash', reference: 'Rollback integration test: partial', paid_at: recordedDate, notes: 'Rollback test payment note' } });
    assert.equal(first.status, 201, JSON.stringify(first.data));
    assert.equal(Number(first.data.amount_paid), 40);
    assert.equal(new Date(first.data.payment.paid_at).toISOString(), recordedDate);
    assert.equal(first.data.payment.metadata.notes, 'Rollback test payment note');
    const savedPayment = (await query('SELECT paid_at,metadata FROM payments WHERE id=$1', [first.data.payment.id])).rows[0];
    assert.equal(savedPayment.paid_at.toISOString(), recordedDate);
    assert.equal(savedPayment.metadata.notes, 'Rollback test payment note');
    assert.equal((await call('/clinic-records/payment-qr', { actorToken: null })).status, 401);
    assert.equal((await call('/clinic-records/payment-qr', { actorToken: doctorToken })).status, 403);
    await query(`INSERT INTO settings(clinic_id,key,value) VALUES($1,'payment_qr',$2::jsonb)
      ON CONFLICT(clinic_id,key) DO UPDATE SET value=EXCLUDED.value`, [receptionist.clinic_id, JSON.stringify({ image_url: 'https://example.invalid/test-qr.png', account_name: 'Rollback Test Clinic' })]);
    const qr = await call('/clinic-records/payment-qr');
    assert.equal(qr.status, 200);
    assert.equal(qr.data.configured, true);
    assert.equal(qr.data.account_name, 'Rollback Test Clinic');
    assert.equal((await call('/clinic-records/payment-qr', { actorToken: reviewOtherClinicToken })).data.configured, false);
    assert.equal((await call(reviewPath, { method: 'POST', body: { action: 'void', reason: 'Cannot void a paid invoice', reason_code: 'created_by_mistake', ...voidFlags } })).status, 409);
    assert.equal(first.data.invoice.status, 'issued');
    const partialList = await call('/clinic-records/invoices');
    const partialInvoice = partialList.data.find(invoice => invoice.id === invoiceId);
    assert.equal(Number(partialInvoice.amount_paid), 40);
    assert.equal(Number(partialInvoice.total) - Number(partialInvoice.amount_paid), 60);

    const final = await call(paymentPath, { method: 'POST', body: { amount: 60, method: 'card', reference: 'Rollback integration test: final' } });
    assert.equal(final.status, 201, JSON.stringify(final.data));
    assert.equal(final.data.invoice.status, 'paid');
    assert.equal(Number(final.data.amount_paid), 100);
    assert.ok(final.data.invoice.paid_at);
    assert.equal((await call(paymentPath, { method: 'POST', body: { amount: 1, method: 'cash' } })).status, 409);
    const paidList = await call('/clinic-records/payments');
    const testPayments = paidList.data.filter(payment => payment.invoice_id === invoiceId);
    assert.equal(testPayments.length, 2);
    assert.equal(testPayments.reduce((sum, payment) => sum + Number(payment.amount), 0), 100);
    assert.equal((await query('SELECT status FROM invoices WHERE id=$1', [invoiceId])).rows[0].status, 'paid');
    assert.equal(Number((await query("SELECT COUNT(*) AS count FROM audit_trail WHERE action='record_invoice_payment' AND record_id=ANY($1::int[])", [testPayments.map(payment => payment.id)])).rows[0].count), 2);
    console.log('PASS: seven classified void reasons; correctable/partially invalid bills blocked from void; retained and replacement links; no-charge confirmations; correct patient/visit replacement; doctor/reception notifications and correction round trip; paid invoice protection; payment endpoints and audit history.');
  } finally {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.query = originalQuery;
    db.pool.connect = originalConnect;
    try {
      await query('ROLLBACK');
      rolledBack = true;
      if (invoiceId) {
        assert.equal((await query('SELECT id FROM invoices WHERE id=$1', [invoiceId])).rowCount, 0);
        assert.equal((await query('SELECT id FROM payments WHERE invoice_id=$1', [invoiceId])).rowCount, 0);
      }
      console.log('PASS: rollback confirmed; test invoice and payments were not saved.');
    } finally {
      client.release(!rolledBack);
      await db.pool.end();
    }
  }
}
main().catch(error => {
  console.error(error.message || error.code || error.name);
  for (const cause of error.errors || []) console.error(cause.code || cause.message);
  process.exitCode = 1;
});
