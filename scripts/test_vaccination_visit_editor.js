const assert=require('node:assert/strict');
const db=require('../config/db');
const inventory=require('../controllers/vaccineInventoryController');
const workflow=require('../controllers/visitWorkflowController');
const records=require('../controllers/clinicRecordController');
async function main(){
  const {matchStickerBatch}=await import('../admin/src/utils/vaccineStickerReader.js');
  const stock=[{id:1,batch_number:'LOT-765432'},{id:2,batch_number:'LOT-999888'}];
  assert.equal(matchStickerBatch('Vaccine label Lot: LOT-765432 Exp: 2028-06-30',stock).batch.id,1);
  assert.equal(matchStickerBatch('No legible lot number',stock).batch,null);
  assert.equal(matchStickerBatch('LOT765432 LOT999888',stock).ambiguous,true);
  const connection=await db.pool.connect(),query=connection.query.bind(connection);
  const originalQuery=db.query,originalConnect=db.pool.connect;
  try{
    await query('BEGIN');db.query=query;
    await inventory.ensureSchema();
    const user=(await query(`SELECT u.id,u.clinic_id,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id
      WHERE lower(r.name) IN ('doctor','assistant_doctor','veterinarian') AND EXISTS(SELECT 1 FROM pets p WHERE p.clinic_id=u.clinic_id AND p.client_id IS NOT NULL) LIMIT 1`)).rows[0];assert.ok(user);
    db.pool.connect=async()=>({query:(sql,params)=>query(sql==='BEGIN'?'SAVEPOINT vaccination_action':sql==='COMMIT'?'RELEASE SAVEPOINT vaccination_action':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT vaccination_action':sql,params),release(){}});
    const invoke=async(handler,id,body={},actor=user)=>{let code=200,data;await handler({user:actor,params:{id},body,query:{},connection:{},ip:'127.0.0.1'},{status(n){code=n;return this;},json(v){data=v;return this;}},e=>{throw e;});return{code,data};};
    const batch=await invoke(inventory.create,null,{product_name:'Workflow Vaccine',manufacturer:'Inventory Manufacturer',batch_number:`TEST-${Date.now()}`,expiry_date:'2050-06-30',quantity:2,default_dose:'1 mL',default_route:'Subcutaneous'});assert.equal(batch.code,201,JSON.stringify(batch.data));
    const appointment=(await query(`INSERT INTO appointments(clinic_id,pet_id,client_id,practitioner_id,start_time,status,reason,notes)
      SELECT clinic_id,id,client_id,$2,now(),'scheduled','Vaccination - Workflow Vaccine','{}'::jsonb FROM pets WHERE clinic_id=$1 AND client_id IS NOT NULL LIMIT 1 RETURNING id`,[user.clinic_id,user.id])).rows[0];
    const proof={filename:'proof.png',content_type:'image/png',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII='};
    const payload={inventory_batch_id:batch.data.id,dose:'1 mL',route:'Subcutaneous',next_due:'2027-11-03',details_confirmed:true,proof_confirmed:true,proof};
    assert.equal((await invoke(workflow.act,appointment.id,{...payload,action:'save_vaccination_draft'},{...user,role:'receptionist'})).code,403);
    assert.equal((await invoke(workflow.act,appointment.id,{...payload,proof:{...proof,data:'data:image/png;base64,YWJj'},action:'save_vaccination_draft'})).code,422);
    const draft=await invoke(workflow.act,appointment.id,{...payload,action:'save_vaccination_draft'});assert.equal(draft.code,200,JSON.stringify(draft.data));
    let vaccine=(await query('SELECT * FROM vaccinations WHERE id=$1',[draft.data.id])).rows[0];
    assert.equal(vaccine.status,'scheduled');assert.equal(vaccine.verified,false);assert.ok(vaccine.sticker_attachment_id);
    assert.equal((await query('SELECT quantity FROM clinic_vaccine_batches WHERE id=$1',[batch.data.id])).rows[0].quantity,2);
    assert.equal((await invoke(workflow.act,appointment.id,{...payload,action:'record_vaccination'})).code,409);
    assert.equal((await invoke(workflow.act,appointment.id,{action:'start'})).code,200);
    assert.equal((await invoke(workflow.act,appointment.id,{...payload,details_confirmed:false,action:'record_vaccination'})).code,422);
    await query("UPDATE clinic_vaccine_batches SET expiry_date='2000-01-01' WHERE id=$1",[batch.data.id]);
    assert.equal((await invoke(workflow.act,appointment.id,{...payload,action:'record_vaccination'})).code,409);
    await query("UPDATE clinic_vaccine_batches SET expiry_date='2050-06-30',quantity=0 WHERE id=$1",[batch.data.id]);
    assert.equal((await invoke(workflow.act,appointment.id,{...payload,action:'record_vaccination'})).code,409);
    await query('UPDATE clinic_vaccine_batches SET quantity=2 WHERE id=$1',[batch.data.id]);
    const administered=await invoke(workflow.act,appointment.id,{...payload,proof:undefined,manufacturer:'Ignored supplied value',action:'record_vaccination'});assert.equal(administered.code,200,JSON.stringify(administered.data));
    vaccine=(await query('SELECT * FROM vaccinations WHERE id=$1',[draft.data.id])).rows[0];assert.equal(vaccine.status,'administered');assert.equal(vaccine.manufacturer,'Inventory Manufacturer');assert.equal(vaccine.verified,false);
    assert.equal((await query('SELECT quantity FROM clinic_vaccine_batches WHERE id=$1',[batch.data.id])).rows[0].quantity,1);
    assert.equal((await invoke(workflow.act,appointment.id,{...payload,action:'record_vaccination'})).code,409);
    assert.equal((await query('SELECT quantity FROM clinic_vaccine_batches WHERE id=$1',[batch.data.id])).rows[0].quantity,1);
    assert.equal((await invoke(workflow.act,appointment.id,{action:'end'})).code,409);
    assert.equal((await invoke(records.updateVaccinationVerification,vaccine.id,{verified:true,attestation_confirmed:true})).code,200);
    assert.equal((await invoke(workflow.act,appointment.id,{action:'end'})).code,200);
    const context=await invoke(workflow.get,appointment.id);assert.ok(context.data.history.length);assert.equal(context.data.visit.notes.vaccination_draft.route,'Subcutaneous');
    console.log('PASS: sticker batch matching, draft persistence, image validation, inventory prefilling, expired/empty batch guards, stock decrement once, verification and consultation completion.');
  }finally{db.query=originalQuery;db.pool.connect=originalConnect;await query('ROLLBACK');connection.release();await db.pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
