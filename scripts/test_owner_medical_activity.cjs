const assert=require('node:assert/strict'),crypto=require('node:crypto');
const db=require('../config/db'),medical=require('../controllers/ownerMedicalActivityController');
async function call(user,id){let status=200,data;await medical.list({user,params:{id}},{status(code){status=code;return this;},json(value){data=value;return this;}},e=>{throw e;});return{status,data};}
(async()=>{
  const connection=await db.pool.connect(),query=connection.query.bind(connection),original=db.query;
  try {
    await query('BEGIN');db.query=query;
    const pet=(await query(`SELECT p.id,p.clinic_id,p.client_id FROM pets p JOIN clinics cl ON cl.id=p.clinic_id
      WHERE COALESCE((p.metadata->>'archived')::boolean,false)=false AND COALESCE(cl.archived,false)=false LIMIT 1`)).rows[0];
    assert.ok(pet,'Need an active clinic patient.');
    const email=`medical-${crypto.randomBytes(8).toString('hex')}@example.invalid`;
    await query('UPDATE clients SET email=$1 WHERE id=$2 AND clinic_id=$3',[email,pet.client_id,pet.clinic_id]);
    const owner={id:1,email,role:'user'};
    assert.equal((await call({...owner,email:'stranger@example.invalid'},pet.id)).status,404);
    assert.equal((await call({...owner,role:'doctor'},pet.id)).status,403);
    assert.equal((await call(owner,'invalid')).status,400);
    const appointment=(await query(`INSERT INTO appointments(clinic_id,pet_id,client_id,status,start_time,end_time,reason)
      VALUES($1,$2,$3,'completed',now(),now()+interval '30 minutes','Live owner visit test') RETURNING id`,[pet.clinic_id,pet.id,pet.client_id])).rows[0];
    await query(`INSERT INTO consultations(clinic_id,appointment_id,pet_id,status,completed_at,notes)
      VALUES($1,$2,$3,'completed',now(),$4::jsonb)`,[pet.clinic_id,appointment.id,pet.id,JSON.stringify({chiefComplaint:'Published clinical reason',diagnosis:'Clinical diagnosis',internalNotes:'PRIVATE NOTE DO NOT RETURN',billingItems:[{cost:99999}]})]);
    await query(`INSERT INTO patient_diagnoses(clinic_id,pet_id,diagnosis,case_classification,clinical_status,record_status)
      VALUES($1,$2,'Live finalized diagnosis','suspected','ongoing','finalized'),($1,$2,'Hidden draft diagnosis','suspected','ongoing','draft')`,[pet.clinic_id,pet.id]);
    await query(`INSERT INTO treatment_plans(clinic_id,pet_id,title,diagnosis,status)
      VALUES($1,$2,'Live owner treatment plan','Test diagnosis','active'),($1,$2,'Hidden draft plan','Test diagnosis','draft')`,[pet.clinic_id,pet.id]);
    await query(`INSERT INTO treatment_records(clinic_id,pet_id,diagnosis,procedure,status) VALUES($1,$2,'Test diagnosis','Live owner procedure','completed')`,[pet.clinic_id,pet.id]);
    await query(`INSERT INTO lab_results(clinic_id,pet_id,test_name,results,metadata)
      VALUES($1,$2,'Verified owner lab',$3::jsonb,'{"verified":true}'),($1,$2,'Hidden unverified lab','{}','{"verified":false}')`,[pet.clinic_id,pet.id,JSON.stringify({summary:'Verified lab summary',interpretation:'Recorded interpretation'})]);
    const result=await call(owner,pet.id);assert.equal(result.status,200);
    const rows=result.data.records;
    assert.ok(rows.some(r=>r.title==='Live owner visit test'&&r.detail.includes('Published clinical reason')));
    assert.ok(rows.some(r=>r.title==='Live finalized diagnosis'&&r.detail.includes('Suspected')));
    assert.ok(rows.some(r=>r.title==='Live owner treatment plan'));
    assert.ok(rows.some(r=>r.title==='Live owner procedure'));
    assert.ok(rows.some(r=>r.title==='Verified owner lab'&&r.detail.includes('Verified lab summary')));
    assert.ok(!rows.some(r=>/Hidden/.test(r.title)));
    assert.ok(!JSON.stringify(result.data).includes('PRIVATE NOTE DO NOT RETURN'));
    assert.ok(!JSON.stringify(result.data).includes('billingItems'));
    await query('UPDATE appointments SET reason=$1 WHERE id=$2',['Updated doctor visit',appointment.id]);
    const refreshed=await call(owner,pet.id);
    assert.ok(refreshed.data.records.some(r=>r.title==='Updated doctor visit'),'Doctor edits appear without manually sharing a snapshot.');
    console.log('PASS: live doctor visits, diagnoses, plans, treatments and verified labs; doctor edits refresh; owner isolation; drafts, unverified labs, internal notes and billing excluded. All fixture data rolled back.');
  }finally{await query('ROLLBACK');db.query=original;connection.release();await db.pool.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
