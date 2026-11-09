const assert=require('node:assert/strict'),db=require('../config/db'),rules=require('../utils/productValidation'),workflow=require('../controllers/visitWorkflowController');
async function main(){
  assert.ok(rules.speciesError('5-in-1 Canine Vaccination','Cat'));assert.ok(rules.speciesError('Feline 4-in-1','Dog'));assert.equal(rules.speciesError('Puppy/Kitten Checkup','Cat'),null);
  const connection=await db.pool.connect(),query=connection.query.bind(connection),original=db.query,originalConnect=db.pool.connect;
  try{
    await query('BEGIN');db.query=query;db.pool.connect=async()=>({query:(sql,args)=>query(sql==='BEGIN'?'SAVEPOINT product_action':sql==='COMMIT'?'RELEASE SAVEPOINT product_action':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT product_action':sql,args),release(){}});
    const clinic=11,user={id:18,role:'Doctor',clinic_id:clinic};
    const pet=(await query('SELECT id,client_id FROM pets WHERE clinic_id=$1 AND client_id IS NOT NULL LIMIT 1',[clinic])).rows[0];assert.ok(pet);
    const service=(await query("SELECT * FROM clinic_billing_catalog WHERE clinic_id=$1 AND source_sku='VS-0011' AND active",[clinic])).rows[0];
    const batches=(await query("SELECT *,TO_CHAR(expiry_date,'YYYY-MM-DD') AS expiry FROM clinic_vaccine_batches WHERE clinic_id=$1 AND product_name IN('Nobivac DHPPi','Nobivac Rabies') AND active",[clinic])).rows;
    const correct=batches.find(row=>row.product_name==='Nobivac DHPPi'),wrong=batches.find(row=>row.product_name==='Nobivac Rabies');assert.ok(correct&&wrong);
    const notes={service_catalog_item_id:service.id,service_category:'Vaccination',service_name:service.name};
    const appointment=(await query("INSERT INTO appointments(clinic_id,pet_id,client_id,practitioner_id,start_time,status,reason,notes) VALUES($1,$2,$3,$4,now(),'scheduled',$5,$6::jsonb) RETURNING id",[clinic,pet.id,pet.client_id,user.id,'Vaccination - '+service.name,JSON.stringify(notes)])).rows[0];
    const invoke=async body=>{let code=200,data;await workflow.act({user,params:{id:appointment.id},body,query:{}},{status(n){code=n;return this;},json(v){data=v;return this;}},e=>{throw e;});return{code,data};};
    await query("UPDATE pets SET species='Cat' WHERE id=$1",[pet.id]);
    const species=await invoke({action:'start'});assert.equal(species.code,422);assert.match(species.data.error,/canine/i);
    await query("UPDATE pets SET species='Dog' WHERE id=$1",[pet.id]);assert.equal((await invoke({action:'start'})).code,200);
    const proof={filename:'test.png',content_type:'image/png',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=',ocr_text:`${correct.product_name} Lot: ${correct.batch_number} Exp: ${correct.expiry}`};
    const payload={action:'record_vaccination',inventory_batch_id:correct.id,dose:'1 mL',route:'Subcutaneous',next_due:'2027-11-03',details_confirmed:true,proof_confirmed:true,proof};
    const mismatch=await invoke({...payload,inventory_batch_id:wrong.id});assert.equal(mismatch.code,422);assert.match(mismatch.data.error,/Wrong vaccine/);
    const expiry=await invoke({...payload,proof:{...proof,ocr_text:proof.ocr_text.replace(correct.expiry,'2028-02-24')}});assert.equal(expiry.code,422);assert.match(expiry.data.error,/expiry/i);
    assert.equal((await invoke({...payload,proof:{...proof,ocr_text:''}})).code,422);
    const success=await invoke(payload);assert.equal(success.code,200,JSON.stringify(success.data));
    const record=(await query('SELECT * FROM vaccinations WHERE id=$1',[success.data.id])).rows[0];assert.equal(await rules.savedVaccination({query},record,clinic),null);
    assert.equal((await query('SELECT quantity FROM clinic_vaccine_batches WHERE id=$1',[correct.id])).rows[0].quantity,correct.quantity-1);
    assert.equal((await query('SELECT quantity FROM clinic_vaccine_batches WHERE id=$1',[wrong.id])).rows[0].quantity,wrong.quantity);
    assert.equal((await invoke(payload)).code,409);
    for(const category of ['Treatment','Laboratory','Surgery','Dental','Check-up','Follow-up','Confinement','Grooming','General'])assert.match((await rules.service({query},{pet_id:pet.id,notes:{...notes,service_category:category}},clinic)).error,/appointment type/);
    console.log('PASS: species mismatch, wrong service category, wrong vaccine batch, conflicting expiry and unreadable sticker rejected; correct linked batch accepted; proof revalidated; stock decremented once. All fixtures rolled back.');
  }finally{db.query=original;db.pool.connect=originalConnect;await query('ROLLBACK');connection.release();await db.pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
