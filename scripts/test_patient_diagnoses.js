const assert=require('node:assert/strict');
const db=require('../config/db'),controller=require('../controllers/patientDiagnosisController');
async function main(){const client=await db.pool.connect(),query=client.query.bind(client),originalQuery=db.query,originalConnect=db.pool.connect;
try{await query('BEGIN');
const pet=(await query("SELECT p.id,p.clinic_id,u.id AS vet_id FROM pets p JOIN users u ON u.clinic_id=p.clinic_id JOIN roles r ON r.id=u.role_id WHERE COALESCE(u.is_active,true) AND lower(regexp_replace(trim(r.name),'[[:space:]-]+','_','g')) IN ('doctor','assistant_doctor','veterinarian') ORDER BY p.id LIMIT 1")).rows[0];assert.ok(pet,'A clinic patient and veterinarian are required.');
db.query=query;db.pool.connect=async()=>({release(){},query:(sql,args)=>query(sql==='BEGIN'?'SAVEPOINT diagnosis_test':sql==='COMMIT'?'RELEASE SAVEPOINT diagnosis_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT diagnosis_test':sql,args)});
async function invoke(method,body={},options={}){let status=200,result;await controller[method]({user:{id:pet.vet_id,role:options.role||'doctor',clinic_id:options.clinic||pet.clinic_id},query:{},params:{id:options.pet||pet.id,diagnosisId:options.id},body},{status(value){status=value;return this;},json(value){result=value;return this;}},error=>{throw error;});return {status,result};}
const before=await invoke('list');assert.equal(before.status,200);assert.ok(Array.isArray(before.result));
const payload={diagnosis:'Diagnosis workflow test',case_classification:'suspected',clinical_status:'ongoing',veterinarian_id:pet.vet_id,recorded_at:new Date().toISOString(),notes:'Temporary transaction-only test record.'};
const created=await invoke('save',payload);assert.equal(created.status,201);assert.equal(created.result.case_classification,'suspected');
const listed=(await invoke('list')).result;assert.equal(listed.length,before.result.length+1);const item=listed.find(row=>row.database_id===created.result.id);assert.equal(item.clinical_status,'ongoing');assert.ok(item.veterinarian);
const updated=await invoke('save',{...payload,case_classification:'confirmed',clinical_status:'under_treatment'},{id:created.result.id});assert.equal(updated.status,200);assert.equal(updated.result.clinical_status,'under_treatment');
assert.equal((await invoke('save',payload,{role:'owner'})).status,403);assert.equal((await invoke('save',{...payload,case_classification:'made_up'})).status,422);assert.equal((await invoke('save',{...payload,veterinarian_id:2147483647})).status,422);
assert.equal((await invoke('save',payload,{clinic:2147483647})).status,404);assert.equal((await invoke('list',{}, {clinic:2147483647})).status,404);assert.equal((await invoke('save',payload,{id:2147483647})).status,404);assert.equal((await invoke('list',{}, {role:'pet_owner'})).status,403);
const audit=(await query("SELECT action,old_data FROM audit_trail WHERE table_name='patient_diagnoses' AND record_id=$1 ORDER BY id",[created.result.id])).rows;assert.deepEqual(audit.map(row=>row.action),['create_diagnosis','update_diagnosis']);assert.equal(audit[1].old_data.case_classification,'suspected');
console.log('PASS: diagnosis creation, classification/status persistence, updates, attending vet, existing history, clinic isolation, invalid values, veterinary permissions and audit history. Test records rolled back.');
}finally{db.query=originalQuery;db.pool.connect=originalConnect;await query('ROLLBACK');client.release();await db.pool.end();}}
main().catch(error=>{console.error(error.message||error.code);process.exitCode=1;});
