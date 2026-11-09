const assert = require('node:assert/strict');
const db = require('../config/db');
const { signUserToken } = require('../middleware/auth');
(async () => {
  const actors = (await db.query(`SELECT u.id,u.clinic_id,u.email,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id
    WHERE u.clinic_id=11 AND COALESCE(u.is_active,true) AND LOWER(r.name) IN ('owner','doctor') ORDER BY u.id`)).rows;
  const owner = actors.find(row => row.role.toLowerCase()==='owner');
  const doctor = actors.find(row => row.role.toLowerCase()==='doctor');
  assert.ok(owner && doctor, 'Owner and doctor accounts are required to verify clinic 11.');
  async function get(path, actor) {
    console.log('Checking '+path);
    const started = Date.now();
    const response = await fetch('http://localhost:3000/api'+path, { headers: {Authorization:'Bearer '+signUserToken({...actor,exp:Date.now()+60000})}, signal:AbortSignal.timeout(15000) });
    assert.ok(response.headers.get('content-type')?.includes('application/json'), `${path} must return JSON.`);
    const body=await response.json(); assert.equal(response.status,200,body.error || path);
    console.log('PASS: '+path+' ('+(Date.now()-started)+'ms)'); return body;
  }
  await get('/owner-monitoring/data-status',owner);
  const summary=await get('/owner-monitoring/summary',owner);
  assert.equal(summary.clinic_id,11); assert.ok(Array.isArray(summary.pets)); assert.ok(Array.isArray(summary.payments));
  assert.ok(summary.activity.length<=8);
  assert.ok(summary.activity.every(row=>!Object.hasOwn(row,'old_data') && !Object.hasOwn(row,'new_data')));
  await get('/owner-monitoring/report?days=30',owner);
  assert.ok(Array.isArray(await get('/clinic-records/appointments',doctor)));
  const reminders=await get('/clinic-records/reminders?include_filters=true',doctor);
  assert.ok(Array.isArray(reminders.reminders)); assert.ok(reminders.filters.doctors.length>=2); assert.ok(reminders.filters.appointment_types.length>0);
  if(reminders.reminders.length){
    const row=reminders.reminders[0];
    const detail=await get('/clinic-records/reminders/'+encodeURIComponent(row.id),doctor);
    assert.equal(detail.patient.id,row.pet_id);assert.ok(Array.isArray(detail.history));assert.ok(Array.isArray(detail.channels));
    assert.deepEqual(detail.channels.map(channel=>channel.id),['email','in_app']);
  }
  assert.ok(Array.isArray(await get('/owner/notifications',owner)));
  const options=await get('/clinic-records/appointments/filters',doctor); assert.ok(options.doctors.length>=2);
  console.log('PASS: the running backend returns authenticated JSON for owner overview/financial data, reports, data status, doctor appointments, reminders, and dropdown options. Clinic 11 has both doctors and appointment types available.');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.pool.end());
