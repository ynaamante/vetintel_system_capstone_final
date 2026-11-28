const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function load(file, imports) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file,'utf8'), { module,exports:module.exports,require:name => {
    if (name in imports) return imports[name];
    throw Error('Unexpected import: ' + name);
  },Date,Set,Number,String,Array,Error });
  return module.exports;
}
const availability = load('services/appointmentAvailability.js', {});
const at = (time) => new Date('2030-05-20T' + time + ':00+08:00').toISOString();
async function main() {
  assert.equal(availability.validDate('2030-02-30'),false);
  assert.equal(availability.validDate('2030-05-20'),true);
  let doctors = [{id:1},{id:2}], appointments = [];
  const db = { query: async (sql) => {
    if (sql.includes('SELECT u.id')) return {rows:doctors};
    assert.match(sql,/COALESCE\(archived,false\)=false/);
    assert.match(sql,/cancelled/);
    return {rows:appointments};
  }};
  let slots = await availability.loadAvailability(db,5,'2030-05-20',0);
  assert.equal(slots.length,24);
  assert.equal(slots[0].label,'8:00 AM');
  assert.equal(slots.at(-1).label,'7:30 PM');
  appointments = [{practitioner_id:1,start_time:at('09:00'),end_time:at('10:00')}];
  slots = await availability.loadAvailability(db,5,'2030-05-20',0);
  assert.equal(slots.find(s=>s.label==='9:00 AM').doctor_id,2);
  appointments.push({practitioner_id:2,start_time:at('09:15'),end_time:at('09:45')});
  slots = await availability.loadAvailability(db,5,'2030-05-20',0);
  assert.equal(slots.some(s=>s.label==='9:00 AM'),false);
  assert.equal(slots.some(s=>s.label==='9:30 AM'),false);
  appointments = [{practitioner_id:null,start_time:at('08:00'),end_time:null}];
  slots = await availability.loadAvailability(db,5,'2030-05-20',new Date(at('07:00')).getTime());
  assert.equal(slots.some(s=>s.label==='8:00 AM'),false);
  slots = await availability.loadAvailability(db,5,'2030-05-20',new Date(at('10:00')).getTime());
  assert.equal(slots.some(s=>s.label==='10:00 AM'),false);
  doctors=[];
  assert.equal((await availability.loadAvailability(db,5,'2030-05-20',0)).length,0);
  await assert.rejects(()=>availability.loadAvailability(db,5,'2030-02-30',0));

  const calls=[];
  let available=true, overlap=false;
  const client = { release(){}, async query(sql,params) {
    calls.push([sql,params]);
    if (sql.includes('SELECT p.id,p.client_id')) return {rows:[{id:10,client_id:20}]};
    if (sql.includes('SELECT id FROM appointments WHERE pet_id')) return {rows:[]};
    if (sql.includes('INSERT INTO appointments')) return {rows:[{id:30,start_time:at('09:00')}]};
    if (sql.includes('SELECT * FROM appointments')) return {rows:[{id:30,practitioner_id:7,status:'scheduled',workflow_type:'pending_confirmation',start_time:at('09:00'),end_time:at('09:30'),notes:{source:'pet_owner_mobile'}}]};
    if (sql.includes('SELECT id FROM appointments WHERE clinic_id')) return {rows:overlap?[{id:31}]:[]};
    return {rows:[]};
  }};
  const controller=load('controllers/ownerCareController.js',{
    '../config/db':{pool:{connect:async()=>client}},
    '../utils/clinicEvents':{publish(){}},
    '../services/appointmentAvailability':{...availability,loadAvailability:async()=>available?[{start_time:at('09:00'),end_time:at('09:30'),doctor_id:7}]:[]},
  });
  let status=200,body;
  const res={status(code){status=code;return this;},json(value){body=value;return this;}};
  const next=error=>{throw error;};
  const request={user:{id:99,email:'owner@example.test',role:''},body:{pet_id:10,clinic_id:5,start_time:at('09:00'),reason:'Checkup',reason_for_visit:'Annual check',notes:'Bring records'}};
  await controller.book(request,res,next);
  assert.equal(status,201);
  const insert=calls.find(([sql])=>sql.includes('INSERT INTO appointments'));
  assert.equal(insert[1][7],7,'Booking is assigned to the available doctor');
  assert.equal(JSON.parse(insert[1][6]).reason_for_visit,'Annual check');
  assert.ok(calls.some(([sql])=>sql.includes('INSERT INTO clinic_notifications')));
  assert.ok(calls.findIndex(([sql])=>sql.includes('pg_advisory_xact_lock')) < calls.findIndex(([sql])=>sql.includes('INSERT INTO appointments')));
  available=false;calls.length=0;
  await controller.book(request,res,next);
  assert.equal(status,409);
  assert.ok(calls.some(([sql])=>sql==='ROLLBACK'));
  assert.ok(!calls.some(([sql])=>sql.includes('INSERT INTO appointments')));
  await controller.book({...request,user:{...request.user,role:'doctor'}},res,next);
  assert.equal(status,403);

  const review=load('controllers/ownerAppointmentRequestController.js',{
    'node:crypto':{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
    '../config/db':{pool:{connect:async()=>client}},
    '../utils/clinicEvents':{publish(){}},
    '../services/appointmentAvailability':availability,
  });
  const doctorReq={user:{id:7,clinic_id:5,role:'doctor'},params:{id:30},body:{action:'approve'}};
  calls.length=0;status=200;
  await review.review(doctorReq,res,next);
  assert.equal(status,200);
  const update=calls.find(([sql])=>sql.includes('UPDATE appointments'));
  assert.equal(update[1][1],'confirmed');
  const scoped=calls.find(([sql])=>sql.includes('SELECT * FROM appointments'));
  assert.equal(scoped[1][1],5);assert.equal(scoped[1][2],7);
  overlap=true;calls.length=0;
  await review.review(doctorReq,res,next);
  assert.equal(status,409);assert.ok(!calls.some(([sql])=>sql.includes('UPDATE appointments')));
  calls.length=0;
  await review.review({...doctorReq,body:{action:'reject'}},res,next);
  assert.equal(calls.find(([sql])=>sql.includes('UPDATE appointments'))[1][0],'cancelled');
  await review.review({...doctorReq,user:{id:99,role:'user'}},res,next);
  assert.equal(status,403);
  console.log('Availability, overlap, booking assignment, stale-slot rejection, and doctor-review checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
