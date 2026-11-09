// Database integration check. Fixtures and changes are rolled back.
const assert = require('node:assert/strict');
const db = require('../config/db');
const reception = require('../controllers/receptionAppointmentController');
const records = require('../controllers/clinicRecordController');
async function main() {
  const { appointmentActions } = await import('../admin/src/utils/appointmentActions.js');
  const matrix = {
    pending: ['confirm', 'reschedule', 'cancel', 'view', 'history'],
    scheduled: ['checkin', 'noshow', 'reschedule', 'cancel', 'view', 'history'],
    checked_in: ['view', 'queue', 'reschedule', 'history'],
    in_consultation: ['visit', 'view', 'history'],
    completed: ['visit', 'view', 'follow_up', 'history'],
    cancelled: ['view', 'rebook', 'history'],
    no_show: ['view', 'rebook', 'history'],
    reschedule_requested: ['request', 'view', 'history'],
    cancellation_requested: ['request', 'view', 'history'],
  };
  for (const [status, actions] of Object.entries(matrix)) assert.deepEqual(appointmentActions({ status }), actions);
  const connection = await db.pool.connect();
  const query = connection.query.bind(connection);
  const originalQuery = db.query;
  const originalConnect = db.pool.connect;
  try {
    await query('BEGIN');
    const staff = await query(`SELECT u.id, u.clinic_id, u.role_id FROM users u JOIN roles r ON r.id=u.role_id
      WHERE lower(r.name)='receptionist' AND EXISTS (SELECT 1 FROM appointments a WHERE a.clinic_id=u.clinic_id) LIMIT 1`);
    assert.ok(staff.rows[0], 'Need a receptionist with existing clinic appointments.');
    const user = { ...staff.rows[0], role: 'receptionist' };
    db.query = query;
    db.pool.connect = async () => ({ query: (sql, params) => query(sql === 'BEGIN' ? 'SAVEPOINT action_test'
      : sql === 'COMMIT' ? 'RELEASE SAVEPOINT action_test' : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT action_test' : sql, params), release() {} });
    const invoke = async (handler, id, body = {}, actor = user, filters = {}) => {
      let code = 200, data;
      await handler({ user: actor, params: { id }, body, query: filters, connection: {}, ip: '127.0.0.1' }, {
        status(value) { code = value; return this; }, json(value) { data = value; return this; },
      }, error => { throw error; });
      return { code, data };
    };
    const fixture = async (status = 'scheduled', workflow = null, past = true) => {
      const result = await query(`INSERT INTO appointments
        (clinic_id,pet_id,client_id,practitioner_id,status,start_time,end_time,reason,workflow_type)
        SELECT clinic_id,pet_id,client_id,practitioner_id,$2,
          now() + $4::interval, now() + $4::interval + interval '30 minutes','Action workflow test',$3
        FROM appointments WHERE clinic_id=$1 LIMIT 1 RETURNING id`, [user.clinic_id, status, workflow, past ? '-2 hours' : '2 days']);
      return result.rows[0].id;
    };
    const pending = await fixture('scheduled', 'pending_confirmation');
    assert.equal((await invoke(reception.act, pending, { action: 'checkin' })).code, 409);
    assert.equal((await invoke(reception.act, pending, { action: 'confirm' })).code, 200);
    assert.equal((await invoke(reception.act, pending, { action: 'checkin' })).code, 200);
    assert.equal((await invoke(reception.act, pending, { action: 'checkin' })).code, 409);
    assert.equal((await invoke(reception.act, pending, { action: 'cancel', reason: 'Test' })).code, 409);
    const context = await invoke(reception.context, pending);
    assert.equal(context.data.queue.status, 'waiting');
    assert.ok(context.data.history.some(item => item.action === 'checkin'));
    assert.ok(!('notes' in context.data.appointment));
    assert.equal((await invoke(reception.context, pending, {}, { ...user, clinic_id: -1 })).code, 400);
    assert.equal((await invoke(reception.context, pending, {}, { ...user, clinic_id: user.clinic_id + 100000 })).code, 404);
    assert.equal((await invoke(records.startConsultation, pending)).code, 403);
    const missed = await fixture();
    assert.equal((await invoke(reception.act, missed, { action: 'noshow' })).code, 422);
    assert.equal((await invoke(reception.act, missed, { action: 'noshow', attendance_verified: true })).code, 200);
    const early = await fixture('scheduled', null, false);
    assert.equal((await invoke(reception.act, early, { action: 'noshow', attendance_verified: true })).code, 422);
    assert.equal((await invoke(reception.act, early, { action: 'cancel' })).code, 422);
    assert.equal((await invoke(reception.act, early, { action: 'cancel', reason: 'Owner requested cancellation' })).code, 200);
    const requested = await fixture('scheduled', 'cancellation_requested');
    assert.equal((await invoke(reception.act, requested, { action: 'cancel', reason: 'Test' })).code, 409);
    const booking = { action: 'rebook', start_time: new Date(Date.now() + 400 * 86400000).toISOString(), reason: 'Rebook missed appointment', visit_type: 'Checkup' };
    assert.equal((await invoke(records.createRelatedAppointment, requested, { ...booking, action: 'reschedule' })).code, 409);
    const rebooked = await invoke(records.createRelatedAppointment, missed, booking);
    assert.equal(rebooked.code, 201, JSON.stringify(rebooked.data));
    assert.equal(rebooked.data.appointment.parent_appointment_id, missed);
    const move = { ...booking, action: 'reschedule' };
    assert.equal((await invoke(records.createRelatedAppointment, pending, move)).code, 409);
    move.start_time = new Date(Date.now() + 401 * 86400000).toISOString();
    assert.equal((await invoke(records.createRelatedAppointment, pending, { ...move, arrival_confirmed: true })).code, 201);
    assert.equal((await invoke(reception.context, pending)).data.queue.status, 'rescheduled');
    const queuePet = await query(`INSERT INTO pets (clinic_id,client_id,name,species,sex)
      SELECT clinic_id,client_id,'Queue Test',species,sex FROM pets WHERE clinic_id=$1 LIMIT 1 RETURNING id`, [user.clinic_id]);
    const queueDoctor = await query(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE u.clinic_id=$1
      AND COALESCE(u.is_active,true) AND lower(r.name) IN ('doctor','assistant_doctor','veterinarian') LIMIT 1`, [user.clinic_id]);
    const walkInPayload = { pet_id: queuePet.rows[0].id, practitioner_id: queueDoctor.rows[0].id, reason: 'Walk-in consultation' };
    const walkIn = await invoke(reception.addWalkIn, null, walkInPayload);
    assert.equal(walkIn.code, 201, JSON.stringify(walkIn.data));
    assert.equal((await invoke(reception.addWalkIn, null, walkInPayload)).code, 409);
    const queueRows = await invoke(records.listPatientQueue, null);
    const added = queueRows.data.find(item => item.appointment_id === walkIn.data.id);
    assert.equal(added.workflow_type, 'walk_in');
    assert.equal(added.visit_type, 'Walk-in consultation');
    assert.ok(added.species && added.practitioner && added.owner);
    assert.equal(added.status, 'waiting');
    assert.equal((await invoke(records.listPatientQueue, null, {}, user, { from:'invalid' })).code, 422);
    const futureQueue = await invoke(records.listPatientQueue, null, {}, user,
      { from:new Date(Date.now()+2*86400000).toISOString(), to:new Date(Date.now()+3*86400000).toISOString() });
    assert.ok(!futureQueue.data.some(item => item.appointment_id === walkIn.data.id));
    console.log('PASS: appointment actions, walk-in creation, duplicate prevention, enriched queue data and queue date filters.');
  } finally {
    db.query = originalQuery;
    db.pool.connect = originalConnect;
    await query('ROLLBACK');
    connection.release();
    await db.pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
