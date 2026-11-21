const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('../config/db');
const sharing = require('../controllers/petSharingController');
async function call(handler,user,body={},params={}) {
  let status=200,data;
  await handler({user,body,params},{status(code){status=code;return this;},json(value){data=value;return this;}},e=>{throw e;});
  return {status,data};
}
(async()=>{
  await sharing.ensureSchema();
  const connection=await db.pool.connect(),query=connection.query.bind(connection);
  const originalQuery=db.query, originalConnect=db.pool.connect;
  try{
    await query('BEGIN');db.query=query;
    db.pool.connect=async()=>({query:(sql,args)=>query(sql==='BEGIN'?'SAVEPOINT sharing_test':sql==='COMMIT'?'RELEASE SAVEPOINT sharing_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT sharing_test':sql,args),release(){}});
    const pet=(await query(`SELECT p.id,p.clinic_id,p.client_id FROM pets p JOIN clinics cl ON cl.id=p.clinic_id
      WHERE COALESCE((p.metadata->>'archived')::boolean,false)=false AND COALESCE(cl.archived,false)=false LIMIT 1`)).rows[0];
    const vet=(await query(`SELECT u.id,u.clinic_id FROM users u JOIN roles r ON r.id=u.role_id
      WHERE lower(replace(r.name,' ','_')) IN ('doctor','veterinarian','assistant_doctor') AND u.clinic_id IS NOT NULL AND u.is_active=true LIMIT 1`)).rows[0];
    assert.ok(pet && vet,'Need a clinic pet and veterinarian fixture.');
    const email=`qr-test-${crypto.randomBytes(8).toString('hex')}@example.invalid`;
    const userId=(await query(`INSERT INTO users(name,email,is_active) VALUES('QR Owner Test',$1,false) RETURNING id`,[email])).rows[0].id;
    await query('UPDATE clients SET email=$1 WHERE id=$2 AND clinic_id=$3',[email,pet.client_id,pet.clinic_id]);
    const owner={id:userId,email,role:'user'}, doctor={...vet,role:'doctor'}, stranger={...owner,id:-1,email:'stranger@example.invalid'};
    assert.equal((await call(sharing.issue,stranger,{}, {id:pet.id})).status,404);
    assert.equal((await call(sharing.issue,doctor,{}, {id:pet.id})).status,403);
    const issued=await call(sharing.issue,owner,{}, {id:pet.id});assert.equal(issued.status,200);
    assert.match(issued.data.value,/^vetintel:pet-share:[a-f0-9]{64}$/);
    const body={token:issued.data.value};
    assert.equal((await call(sharing.request,{...doctor,role:'receptionist'},body)).status,403);
    const requested=await call(sharing.request,doctor,body);assert.equal(requested.status,201);
    const id=requested.data.id,params={id};
    assert.equal((await call(sharing.request,doctor,body)).data.id,id,'Rescanning does not duplicate the owner prompt.');
    assert.equal((await call(sharing.view,doctor,{},params)).data.history,undefined,'No history before consent.');
    assert.ok((await call(sharing.ownerRequests,owner)).data.some(n=>n.accessRequestId===id && n.requestStatus==='pending'));
    assert.equal((await call(sharing.ownerRequests,stranger)).data.length,0);
    assert.equal((await call(sharing.decide,stranger,{action:'approve'},params)).status,404);
    await query(`INSERT INTO patient_diagnoses(clinic_id,pet_id,diagnosis,case_classification,clinical_status,record_status)
      VALUES($1,$2,'QR finalized test','suspected','ongoing','finalized'),($1,$2,'QR draft test','suspected','ongoing','draft')`,[pet.clinic_id,pet.id]);
    assert.equal((await call(sharing.decide,owner,{action:'approve'},params)).data.status,'approved');
    const history=await call(sharing.view,doctor,{},params);assert.equal(history.status,200);assert.ok(history.data.history.pet.name);
    assert.ok(history.data.history.diagnoses.some(d=>d.diagnosis==='QR finalized test'));
    assert.ok(!history.data.history.diagnoses.some(d=>d.diagnosis==='QR draft test'));
    assert.ok(history.data.history.consultations.every(c=>!('internalNotes' in c)));
    assert.equal((await call(sharing.view,{...doctor,id:-1},{},params)).status,404,'Another doctor cannot use this grant.');
    assert.equal((await call(sharing.decide,owner,{action:'revoke'},params)).data.status,'revoked');
    assert.equal((await call(sharing.view,doctor,{},params)).data.history,undefined);
    const second=await call(sharing.issue,owner,{}, {id:pet.id});
    const pending=await call(sharing.request,doctor,{token:second.data.value});
    assert.equal((await call(sharing.decide,owner,{action:'deny'},{id:pending.data.id})).data.status,'denied');
    assert.equal((await call(sharing.view,doctor,{}, {id:pending.data.id})).data.history,undefined);
    const third=await call(sharing.issue,owner,{}, {id:pet.id});
    const expiring=await call(sharing.request,doctor,{token:third.data.value});
    await query(`UPDATE pet_sharing_requests SET request_expires_at=now()-interval '1 second' WHERE id=$1`,[expiring.data.id]);
    assert.equal((await call(sharing.decide,owner,{action:'approve'},{id:expiring.data.id})).status,409);
    await query(`UPDATE pet_sharing_qr SET expires_at=now()-interval '1 second' WHERE owner_id=$1`,[owner.id]);
    assert.equal((await call(sharing.request,doctor,{token:third.data.value})).status,410);
    const fourth=await call(sharing.issue,owner,{}, {id:pet.id});
    const granted=await call(sharing.request,doctor,{token:fourth.data.value});
    await call(sharing.decide,owner,{action:'approve'},{id:granted.data.id});
    await query(`UPDATE pet_sharing_requests SET access_expires_at=now()-interval '1 second' WHERE id=$1`,[granted.data.id]);
    const expired=await call(sharing.view,doctor,{}, {id:granted.data.id});
    assert.equal(expired.data.status,'expired'); assert.equal(expired.data.history,undefined);
    assert.equal((await call(sharing.read,owner,{}, {id:granted.data.id})).data.ids[0],`share-${granted.data.id}`);
    console.log('PASS: opaque expiring QR; owner notification; no history before approval; read-only finalized medical history after approval; doctor isolation; deny, revoke, and expiry enforcement. All fixture data rolled back.');
  }finally{await query('ROLLBACK');db.query=originalQuery;db.pool.connect=originalConnect;connection.release();await db.pool.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
