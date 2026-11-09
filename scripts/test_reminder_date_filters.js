const assert = require('node:assert/strict');
const db = require('../config/db');
const reminders = require('../controllers/reminderController');
const records = require('../controllers/clinicRecordController');
const { dateFilters } = require('../utils/dateFilters');

async function call(handler, req) {
  let code = 200, body;
  await handler(req, { status(value) { code = value; return this; }, json(value) { body = value; return this; } }, error => { throw error; });
  return { code, body };
}
(async () => {
  assert.deepEqual(dateFilters({ from: '2026-11-05', to: '2026-11-05' }), { from: '2026-11-05T00:00:00+08:00', to: '2026-11-05T23:59:59.999+08:00' });
  assert.throws(() => dateFilters({ from: '2026-02-30' }));
  assert.throws(() => dateFilters({ from: '2026-11-06', to: '2026-11-05' }));
  const { dateFilterValue, dateInRange } = await import('../admin/src/utils/dateFilters.js');
  const { getDateRangePreset } = await import('../admin/src/utils/dateRangePresets.js');
  assert.equal(dateFilterValue('2026-11-04T16:15:00Z'), '2026-11-05');
  assert.equal(dateFilterValue('2026-11-05'), '2026-11-05');
  assert.equal(dateInRange('2026-11-05T15:59:59Z','2026-11-05','2026-11-05'), true);
  assert.equal(dateInRange('2026-11-05T16:00:00Z','2026-11-05','2026-11-05'), false);
  assert.equal(dateInRange(null,'','2026-11-05'), false);
  assert.deepEqual(getDateRangePreset('Today',new Date('2026-11-04T16:15:00Z')), ['2026-11-05','2026-11-05']);
  assert.deepEqual(getDateRangePreset('This Week',new Date('2026-11-04T16:15:00Z')), ['2026-11-02','2026-11-08']);
  assert.deepEqual(getDateRangePreset('This Month',new Date('2026-02-28T16:15:00Z')), ['2026-03-01','2026-03-31']);
  const client = await db.pool.connect(); const original = db.query;
  try {
    await client.query('BEGIN'); db.query = (sql, values) => client.query(sql, values);
    const pet = (await db.query(`SELECT p.id,p.clinic_id,p.client_id,u.id AS doctor_id,u.name AS doctor FROM pets p
      JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id
      JOIN users u ON u.clinic_id=p.clinic_id JOIN roles r ON r.id=u.role_id
      WHERE LOWER(r.name)='doctor' ORDER BY p.id,u.id LIMIT 1`)).rows[0];
    assert.ok(pet, 'A registered patient and doctor are required.');
    const appointment = (await db.query(`INSERT INTO appointments(clinic_id,pet_id,client_id,practitioner_id,status,start_time,end_time,reason,notes)
      VALUES($1,$2,$3,$4,'scheduled','2026-11-05T23:30:00+08:00','2026-11-06T00:00:00+08:00','Date filter rollback test','{"service_category":"Vaccination"}') RETURNING id`, [pet.clinic_id,pet.id,pet.client_id,pet.doctor_id])).rows[0];
    const fixture = (await db.query(`INSERT INTO reminders(clinic_id,pet_id,client_id,appointment_id,type,channel,message,scheduled_at)
      VALUES($1,$2,$3,$4,'vaccination','email','Date filter rollback test','2026-11-05T23:30:00+08:00') RETURNING id`, [pet.clinic_id,pet.id,pet.client_id,appointment.id])).rows[0];
    const req = { user: { role:'doctor',clinic_id:pet.clinic_id }, query: { include_filters:'true',from:'2026-11-05',to:'2026-11-05',doctor:pet.doctor,appointment_type:'Vaccination' } };
    const filtered = await call(reminders.list,req); assert.equal(filtered.code,200);
    assert.ok(filtered.body.reminders.some(row => row.id === fixture.id), 'End date includes the evening reminder and preserves stored reminder IDs.');
    assert.equal(filtered.body.reminders.filter(row => row.appointment_id === appointment.id).length,1,'Stored reminders suppress duplicate appointment reminders.');
    assert.ok(filtered.body.filters.doctors.includes(pet.doctor));
    assert.ok(filtered.body.filters.appointment_types.includes('Vaccination'));
    assert.ok(filtered.body.reminders.every(row => row.doctor===pet.doctor && row.appointment_type==='Vaccination'));
    const noMatches = await call(reminders.list,{...req,query:{...req.query,search:'unmatched_filter_581529'}});
    assert.equal(noMatches.body.reminders.length,0); assert.ok(noMatches.body.filters.doctors.includes(pet.doctor));
    const appointments = await call(records.listAppointments,{...req,query:{date_from:'2026-11-05',date_to:'2026-11-05'}});
    assert.equal(appointments.code,200); assert.ok(appointments.body.some(row=>row.id===appointment.id));
    assert.ok(appointments.body.every(row=>dateInRange(row.start_time,'2026-11-05','2026-11-05')));
    assert.equal((await call(reminders.list,{...req,query:{from:'2026-02-30'}})).code,400);
    assert.equal((await call(records.listAppointments,{...req,query:{from:'2026-02-30'}})).code,400);
    assert.equal((await call(reminders.list,{...req,user:{role:'pet_owner',clinic_id:pet.clinic_id}})).code,403);
    const all = await call(reminders.list,{...req,query:{clinic_id:String(pet.clinic_id+100000)}});
    assert.ok(Array.isArray(all.body)); assert.ok(all.body.some(row=>row.id===fixture.id), 'An explicit foreign clinic cannot override the signed-in clinic.');
    await db.query('UPDATE reminders SET delivered=true WHERE id=$1',[fixture.id]);
    const completed = await call(reminders.list,{...req,query:{...req.query,status:'completed'}});
    assert.ok(completed.body.reminders.some(row=>row.id===fixture.id));
    assert.ok(completed.body.reminders.every(row=>row.status==='completed'));
    await db.query('DELETE FROM reminders WHERE id=$1',[fixture.id]);
    const vaccine = (await db.query(`INSERT INTO vaccinations(clinic_id,pet_id,vaccine_name,date_given,next_due,administered_by,status)
      VALUES($1,$2,'Rollback filter vaccine','2026-11-01','2026-11-05',$3,'administered') RETURNING id`,[pet.clinic_id,pet.id,pet.doctor_id])).rows[0];
    const vaccineRows = await call(reminders.list,req);
    assert.ok(vaccineRows.body.reminders.some(row=>row.id===`vaccination:${vaccine.id}`));
    await db.query("UPDATE vaccinations SET status='scheduled' WHERE id=$1",[vaccine.id]);
    assert.ok(!(await call(reminders.list,req)).body.reminders.some(row=>row.id===`vaccination:${vaccine.id}`),'Draft administration does not create a next-dose reminder.');
    const plan = (await db.query(`INSERT INTO treatment_plans(clinic_id,pet_id,title,diagnosis,follow_up,issued_by)
      VALUES($1,$2,'Rollback filter plan','Rollback verification','2026-11-05',$3) RETURNING id`,[pet.clinic_id,pet.id,pet.doctor_id])).rows[0];
    const followups = await call(reminders.list,{...req,query:{...req.query,appointment_type:'Follow-up'}});
    assert.ok(followups.body.reminders.some(row=>row.id===`plan:${plan.id}`));
    await db.query("UPDATE treatment_plans SET status='completed' WHERE id=$1",[plan.id]);
    assert.ok(!(await call(reminders.list,{...req,query:{...req.query,appointment_type:'Follow-up'}})).body.reminders.some(row=>row.id===`plan:${plan.id}`));
    await db.query('DELETE FROM reminders WHERE id=$1',[fixture.id]);
    const derived = await call(reminders.list,req);
    assert.ok(derived.body.reminders.some(row=>row.id===`appointment:${appointment.id}`), 'Appointments remain visible without a separate stored reminder.');
    console.log('PASS: live reminder options, doctor/type/search/status data, empty selections, source deduplication, clinic isolation, full-day appointment/reminder ranges, invalid dates, Manila boundaries, and presets.');
  } finally { await client.query('ROLLBACK'); db.query=original; client.release(); }
  console.log('PASS: all test records rolled back.');
})().catch(error=>{ console.error(error.message || error.code); process.exitCode=1; }).finally(()=>db.pool.end());
