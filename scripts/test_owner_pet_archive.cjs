const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const db=require('../config/db');
const archive=require('../controllers/ownerPetArchiveController');
const care=require('../controllers/ownerCareController');
const accounts=require('../controllers/petOwnerAccountController');
async function call(handler,user,body={}){let status=200,data;await handler({user,body},{status(code){status=code;return this;},json(value){data=value;return this;}},e=>{throw e;});return{status,data};}
(async()=>{
  await archive.ensureSchema();
  const connection=await db.pool.connect(),query=connection.query.bind(connection),originalQuery=db.query,originalConnect=db.pool.connect;
  try{
    await query('BEGIN');db.query=query;
    db.pool.connect=async()=>({query:(sql,args)=>query(sql==='BEGIN'?'SAVEPOINT archive_test':sql==='COMMIT'?'RELEASE SAVEPOINT archive_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT archive_test':sql,args),release(){}});
    const email=`archive-${crypto.randomBytes(8).toString('hex')}@example.invalid`;
    const id=(await query(`INSERT INTO users(name,email,is_active) VALUES('Archive Test',$1,false) RETURNING id`,[email])).rows[0].id;
    const owner={id,email,role:'user'},stranger={id:-1,email:'other@example.invalid',role:'user'};
    const pet=(await query(`SELECT p.id,p.clinic_id,p.client_id FROM pets p JOIN clinics cl ON cl.id=p.clinic_id
      WHERE COALESCE((p.metadata->>'archived')::boolean,false)=false AND COALESCE(cl.archived,false)=false LIMIT 1`)).rows[0];
    assert.ok(pet,'Need an active clinic pet.');
    await query('UPDATE clients SET email=$1 WHERE id=$2 AND clinic_id=$3',[email,pet.client_id,pet.clinic_id]);
    const before=(await query('SELECT metadata FROM pets WHERE id=$1',[pet.id])).rows[0];
    const personal=(await call(accounts.addPet,owner,{name:'Archive Personal Test',species:'dog'})).data;
    for(const item of [{id:pet.id,source:'clinic'},{id:personal.id,source:'account'}]){
      const body={pet_id:String(item.id),source:item.source,archived:true};
      assert.equal((await call(archive.set,stranger,body)).status,404);
      assert.equal((await call(archive.set,owner,{...body,archived:'true'})).status,422);
      assert.equal((await call(archive.set,owner,body)).status,200);
      assert.equal((await call(archive.set,owner,body)).status,200,'Repeated archive is safe.');
      assert.ok((await call(archive.list,owner)).data.some(p=>p.source===item.source&&String(p.id)===String(item.id)));
      const active=item.source==='account'?(await call(accounts.pets,owner)).data:(await call(care.overview,owner)).data.clinicPets;
      assert.ok(!active.some(p=>String(p.id)===String(item.id)),'Archived pets are hidden from Home.');
      assert.equal((await call(archive.set,owner,{...body,archived:false})).status,200);
      const restored=item.source==='account'?(await call(accounts.pets,owner)).data:(await call(care.overview,owner)).data.clinicPets;
      assert.ok(restored.some(p=>String(p.id)===String(item.id)),'Restored pets appear on Home.');
      assert.ok(!(await call(archive.list,owner)).data.some(p=>p.source===item.source&&String(p.id)===String(item.id)));
    }
    assert.deepEqual((await query('SELECT metadata FROM pets WHERE id=$1',[pet.id])).rows[0].metadata,before.metadata,'Clinic medical data and archive status remain intact.');
    assert.equal((await call(archive.list,stranger)).data.length,0);
    assert.equal((await call(archive.set,{...owner,role:'doctor'},{pet_id:pet.id,source:'clinic',archived:true})).status,403);
    console.log('PASS: clinic and personal archive/restore; Home visibility; duplicate archive; validation; owner isolation; original clinic data preserved. All fixture data rolled back.');
  }finally{await query('ROLLBACK');db.query=originalQuery;db.pool.connect=originalConnect;connection.release();await db.pool.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
