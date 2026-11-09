// End-to-end database integration test; all test records are rolled back.
const assert=require('node:assert/strict');
const db=require('../config/db');
const workflow=require('../controllers/visitWorkflowController');
const records=require('../controllers/clinicRecordController');
const live=require('../utils/clinicEvents');
async function main(){
  const connection=await db.pool.connect(),query=connection.query.bind(connection);
  const originalQuery=db.query,originalConnect=db.pool.connect;
  let closeStream;
  try{
    await query('BEGIN');
    const doctors=await query(`SELECT u.id,u.clinic_id,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id
      WHERE lower(r.name) IN ('doctor','assistant_doctor','veterinarian') AND COALESCE(u.is_active,true)
      AND EXISTS(SELECT 1 FROM clinic_billing_catalog cat WHERE cat.clinic_id=u.clinic_id AND cat.active=true AND cat.item_type='vaccination')
      AND EXISTS(SELECT 1 FROM pets p WHERE p.clinic_id=u.clinic_id AND p.client_id IS NOT NULL) LIMIT 1`);
    const user=doctors.rows[0];assert.ok(user,'Need a veterinarian, registered pet, and vaccination price catalog.');
    const cat=(await query(`SELECT id,unit_price FROM clinic_billing_catalog WHERE clinic_id=$1 AND item_type='vaccination' AND active=true LIMIT 1`,[user.clinic_id])).rows[0];
    const appointment=(await query(`INSERT INTO appointments(clinic_id,pet_id,client_id,practitioner_id,start_time,status,reason,notes)
      SELECT clinic_id,id,client_id,$2,now(),'scheduled','Vaccination workflow test',$3::jsonb FROM pets WHERE clinic_id=$1 AND client_id IS NOT NULL LIMIT 1 RETURNING id`,[user.clinic_id,user.id,JSON.stringify({service_catalog_item_id:cat.id})])).rows[0];
    const vaccine=(await query(`INSERT INTO vaccinations(clinic_id,pet_id,appointment_id,vaccine_name,date_given,status)
      SELECT clinic_id,pet_id,id,'Workflow Test Vaccine',CURRENT_DATE,'scheduled' FROM appointments WHERE id=$1 RETURNING id`,[appointment.id])).rows[0];
    db.query=query;db.pool.connect=async()=>({query:(sql,params)=>query(sql==='BEGIN'?'SAVEPOINT visit_action':sql==='COMMIT'?'RELEASE SAVEPOINT visit_action':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT visit_action':sql,params),release(){}});
    const invoke=async(handler,id,body={},actor=user,filters={})=>{let code=200,data;await handler({user:actor,params:{id},body,query:filters,ip:'127.0.0.1',connection:{}},{status(n){code=n;return this;},json(v){data=v;return this;}},e=>{throw e;});return{code,data};};
    const packets=[];
    live.stream({user,on(event,fn){if(event==='close')closeStream=fn;}},{setHeader(){},flushHeaders(){},write(value){packets.push(value);}});
    assert.equal((await invoke(workflow.act,appointment.id,{action:'start'},{...user,role:'receptionist'})).code,403);
    assert.equal((await invoke(workflow.act,appointment.id,{action:'start'},{...user,id:-1})).code,403);
    assert.equal((await invoke(workflow.act,appointment.id,{action:'administer'})).code,409);
    const started=await invoke(workflow.act,appointment.id,{action:'start'});assert.equal(started.code,200,JSON.stringify(started.data));
    assert.equal((await query('SELECT status FROM patient_queue WHERE appointment_id=$1',[appointment.id])).rows[0].status,'in_consultation');
    assert.equal((await invoke(workflow.act,appointment.id,{action:'complete_service',catalog_item_id:cat.id})).code,409);
    assert.equal((await invoke(records.updateVaccinationVerification,vaccine.id,{verified:true,attestation_confirmed:true})).code,409);
    const administered=await invoke(workflow.act,appointment.id,{action:'administer',vaccination_id:vaccine.id});assert.equal(administered.code,200,JSON.stringify(administered.data));
    const context=await invoke(workflow.get,appointment.id);assert.equal(context.data.vaccinations[0].status,'administered');assert.equal(context.data.vaccinations[0].verified,false);
    const visits=await invoke(records.listVisits,null);assert.ok(visits.data.some(v=>v.appointment_id===appointment.id&&v.consultation_status==='in_progress'));
    assert.equal((await invoke(workflow.act,appointment.id,{action:'end'})).code,409);
    assert.equal((await invoke(workflow.act,appointment.id,{action:'complete_service',catalog_item_id:cat.id})).code,409);
    const verified=await invoke(records.updateVaccinationVerification,vaccine.id,{verified:true,attestation_confirmed:true,reason:'Verified test administration'});assert.equal(verified.code,200,JSON.stringify(verified.data));
    assert.equal((await invoke(workflow.act,appointment.id,{action:'end'})).code,200);
    assert.equal((await query('SELECT status FROM patient_queue WHERE appointment_id=$1',[appointment.id])).rows[0].status,'completed');
    const billed=await invoke(workflow.act,appointment.id,{action:'complete_service',catalog_item_id:cat.id});assert.equal(billed.code,200,JSON.stringify(billed.data));
    const repeated=await invoke(workflow.act,appointment.id,{action:'complete_service',catalog_item_id:cat.id});assert.equal(repeated.data.invoice_id,billed.data.invoice_id);
    const invoices=await invoke(records.listInvoices,null,{},user,{sent_to_reception:'true'});const invoice=invoices.data.find(i=>i.id===billed.data.invoice_id);assert.ok(invoice,'Invoice must appear in reception billing');assert.equal(Number(invoice.total),Number(cat.unit_price));
    assert.equal((await query('SELECT COUNT(*) AS count FROM invoice_items WHERE invoice_id=$1',[billed.data.invoice_id])).rows[0].count,'1');
    const reception=(await query(`SELECT u.id,u.clinic_id,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.clinic_id=$1 AND lower(r.name)='receptionist' LIMIT 1`,[user.clinic_id])).rows[0];
    assert.ok(reception,'Need a receptionist in the clinic to verify payment processing.');
    const paid=await invoke(records.createInvoicePayment,billed.data.invoice_id,{amount:Number(cat.unit_price),method:'cash',reference:'Rollback workflow test'},reception);
    assert.equal(paid.code,201,JSON.stringify(paid.data));assert.equal(paid.data.invoice.status,'paid');
    assert.equal((await invoke(records.createInvoicePayment,billed.data.invoice_id,{amount:1,method:'cash'},reception)).code,409);
    assert.ok(packets.some(packet=>packet.includes('"start"')));assert.ok(packets.some(packet=>packet.includes('"end"')));assert.ok(packets.some(packet=>packet.includes('"billing"')));
    console.log('PASS: doctor authorization, consultation/queue sync, live events, vaccination administration/verification, visit records, reception invoice handoff, payment, and duplicate charge/payment protection.');
  }finally{closeStream?.();db.query=originalQuery;db.pool.connect=originalConnect;await query('ROLLBACK');connection.release();await db.pool.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
