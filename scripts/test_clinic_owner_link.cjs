const assert=require('node:assert/strict'),crypto=require('node:crypto');
const db=require('../config/db'),mailer=require('../utils/mailer');
const accounts=require('../controllers/petOwnerAccountController'),users=require('../controllers/userController');
const care=require('../controllers/ownerCareController'),records=require('../controllers/clinicRecordController');
async function call(handler,body={},user,params={}){let status=200,data;await handler({body,user,params,query:{},ip:'127.0.0.1',connection:{}},{status(code){status=code;return this;},json(value){data=value;return this;}},e=>{throw e;});return{status,data};}
(async()=>{
  const client=await db.pool.connect(),query=client.query.bind(client),originalQuery=db.query,originalConnect=db.pool.connect,originalMailer=mailer.sendVerificationCode;
  let code;
  try {
    await query('BEGIN');db.query=query;
    let sequence=0;
    // Nested verification and record-sharing transactions use unique savepoints.
    const stack=[];
    db.pool.connect=async()=>({query:async(sql,args)=>{
      if(sql==='BEGIN'){const name=`link_test_${++sequence}`;stack.push(name);return query(`SAVEPOINT ${name}`);}
      if(sql==='COMMIT')return query(`RELEASE SAVEPOINT ${stack.pop()}`);
      if(sql==='ROLLBACK')return query(`ROLLBACK TO SAVEPOINT ${stack.pop()}`);
      return query(sql,args);
    },release(){}});
    mailer.sendVerificationCode=async data=>{code=data.code;return{sent:true};};
    const pet=(await query(`SELECT p.id,p.clinic_id,p.client_id FROM pets p JOIN clinics cl ON cl.id=p.clinic_id
      WHERE COALESCE((p.metadata->>'archived')::boolean,false)=false AND COALESCE(cl.archived,false)=false LIMIT 1`)).rows[0];
    assert.ok(pet,'Need an active clinic patient.');
    const email=`clinic-link-${crypto.randomBytes(8).toString('hex')}@example.invalid`;
    const registration={name:'Clinic Owner Link Test',email,password:'Link-Flow-Test-Only-123',accepted_terms:true};
    const unmatched=await call(accounts.register,registration);assert.equal(unmatched.status,422);assert.equal(unmatched.data.code,'CLINIC_EMAIL_REQUIRED');
    // The clinic records the email supplied by the owner before mobile signup.
    await query('UPDATE clients SET email=$1 WHERE id=$2 AND clinic_id=$3',[` ${email.toUpperCase()} `,pet.client_id,pet.clinic_id]);
    const pending=await call(accounts.register,{...registration,email:` ${email.toUpperCase()} `});
    assert.equal(pending.status,201);assert.equal(pending.data.token,undefined);assert.ok(code);
    assert.equal((await call(users.login,{email,password:registration.password})).data.code,'EMAIL_VERIFICATION_REQUIRED');
    const verified=await call(accounts.verify,{email,code});assert.equal(verified.status,200);assert.ok(verified.data.token);
    const owner=verified.data;
    assert.ok((await call(care.overview,{},owner)).data.clinicPets.some(p=>String(p.id)===String(pet.id)),'Existing clinic pets appear without creating a duplicate personal pet.');
    const actor=(await query('SELECT id FROM users WHERE id<>$1 LIMIT 1',[owner.id])).rows[0];
    const shared=await call(records.sharePetRecordsWithOwner,{pet_id:pet.id,records:[{id:'doctor-update:link-test',title:'Doctor owner-link update',category:'Visit update',detail:'Shared by the clinic through the matched owner email.'}]},{id:actor.id,role:'doctor',clinic_id:pet.clinic_id});
    assert.equal(shared.status,201);
    const visible=await call(records.listOwnerSharedRecords,{},owner);
    assert.ok(visible.data.some(b=>String(b.petId)===String(pet.id)&&b.records.some(r=>r.title==='Doctor owner-link update')));
    assert.equal((await call(records.listOwnerSharedRecords,{}, {...owner,email:'different@example.invalid'})).data.length,0);
    assert.equal((await call(accounts.pets,{},owner)).data.length,0,'No duplicate personal pet is created during account linking.');
    console.log('PASS: clinic-first email registration; case/space normalization; verification before login; automatic existing-pet linkage; doctor-shared records reach only the matching owner. All fixtures rolled back; no emails sent.');
  }finally{await query('ROLLBACK');db.query=originalQuery;db.pool.connect=originalConnect;mailer.sendVerificationCode=originalMailer;client.release();await db.pool.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
