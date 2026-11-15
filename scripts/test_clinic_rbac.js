const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const db=require('../config/db');
const policy=require('../utils/rolePermissions');
const auth=require('../middleware/auth');
const express=require('express');
async function main(){
 const client=await db.pool.connect(),query=client.query.bind(client),oldQuery=db.query,oldConnect=db.pool.connect;
 let server;
 try{
  await query('BEGIN');
  await query(fs.readFileSync(path.join(__dirname,'clinic_role_permissions_schema.sql'),'utf8'));
  db.query=query;
  db.pool.connect=async()=>({release(){},query:(sql,args)=>query(sql==='BEGIN'?'SAVEPOINT permission_save':sql==='COMMIT'?'RELEASE SAVEPOINT permission_save':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT permission_save':sql,args)});
  const clinics=(await query("SELECT id FROM clinics WHERE NOT COALESCE(archived,false) AND lower(COALESCE(metadata->>'status','active'))='active' ORDER BY id LIMIT 2")).rows;
  assert.equal(clinics.length,2);
  const roles=(await query('SELECT id,name,permissions FROM roles')).rows;
  const roleFor=key=>roles.find(role=>policy.profile(role.name)===key);
  assert.ok(roleFor('owner')&&roleFor('doctor')&&roleFor('receptionist'));
  const makeUser=async(role,clinic)=>{
   const row=(await query(`INSERT INTO users(name,email,password_hash,clinic_id,role_id,is_active)
    VALUES('RBAC rollback fixture',$1,'not-a-login-password',$2,$3,true) RETURNING id`,[`rbac-${role}-${clinic}-${Date.now()}@example.invalid`,clinic,roleFor(role).id])).rows[0];
   return {...row,clinic_id:clinic,role:roleFor(role).name};
  };
  const owner=await makeUser('owner',clinics[0].id),doctor=await makeUser('doctor',clinics[0].id),reception=await makeUser('receptionist',clinics[0].id),otherOwner=await makeUser('owner',clinics[1].id),otherDoctor=await makeUser('doctor',clinics[1].id);
  const app=express();app.use(express.json());app.use('/api',require('../routes/api'));
  app.use((error,req,res,next)=>res.status(error.status||500).json({error:error.message}));
  server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  const url=`http://127.0.0.1:${server.address().port}/api`;
  async function call(actor,endpoint,method='GET',body){
   const headers={'Content-Type':'application/json'};
   if(actor) headers.Authorization=`Bearer ${auth.signUserToken({...actor,exp:Date.now()+60000})}`;
   const response=await fetch(url+endpoint,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
   return {status:response.status,data:await response.json()};
  }
  const doctorConfig=policy.resolve('doctor',{}),receptionConfig=policy.resolve('receptionist',{});
  const target=roleFor('doctor');
  assert.equal((await call(null,`/roles/${target.id}`,'PUT',{permissions:doctorConfig})).status,401);
  assert.equal((await call(doctor,`/roles/${target.id}`,'PUT',{permissions:doctorConfig})).status,403);
  assert.equal((await call(reception,`/roles/${target.id}`,'PUT',{permissions:doctorConfig})).status,403);
  assert.equal((await call(owner,`/roles/${target.id}`,'PUT',{permissions:doctorConfig})).status,200);
  assert.equal((await call(otherOwner,`/roles/${target.id}`,'PUT',{permissions:doctorConfig})).status,200);
  assert.equal((await call(owner,`/roles/${roleFor('receptionist').id}`,'PUT',{permissions:receptionConfig})).status,200);
  let me=(await call(doctor,'/me')).data;
  assert.equal(me.permissions['Appointments']['View Own Schedule'],true);
  doctorConfig.Appointments['View Own Schedule']=false;
  doctorConfig['Disease Intelligence']['View Intelligence Dashboard']=false;
  doctorConfig['Medical Workflow']['Create Diagnosis']=false;
  assert.equal((await call(owner,`/roles/${target.id}`,'PUT',{permissions:doctorConfig})).status,200);
  me=(await call(doctor,'/me')).data;
  assert.equal(me.permissions.Appointments['View Own Schedule'],false,'Existing session sees revocation');
  assert.equal((await call(otherDoctor,'/me')).data.permissions.Appointments['View Own Schedule'],true,'Other clinic unchanged');
  assert.equal((await call(doctor,'/clinic-records/pets/1/diagnoses','POST',{record_status:'draft'})).status,403,'Direct API mutation denied');
  assert.equal((await call(reception,'/clinic-records/pets/1/diagnoses','POST',{})).status,403,'Reception cannot diagnose');
  assert.equal((await call(owner,'/clinic-records/pets/1/diagnoses','POST',{})).status,403,'Administrative ownership does not confer veterinary authority');
  const forgedClaims={...doctor,role:'super_admin',clinic_id:clinics[1].id};
  const actual=(await call(forgedClaims,'/me')).data;
  assert.equal(actual.clinic_id,doctor.clinic_id,'Clinic identity comes from the database');
  assert.equal(policy.profile(actual.role),'doctor','Role identity comes from the database');
  assert.equal((await call(owner,`/roles/${target.id}`,'PUT',{name:'super_admin',permissions:doctorConfig})).status,403);
  const invalid=structuredClone(receptionConfig);invalid['Medical Workflow']['Confirm Diagnosis']=true;
  assert.equal((await call(owner,`/roles/${roleFor('receptionist').id}`,'PUT',{permissions:invalid})).status,422);
  assert.equal((await call(owner,`/users/${otherDoctor.id}`,'PUT',{name:'Cross-clinic change'})).status,403);
  assert.equal((await call(owner,'/users','POST',{clinic_id:clinics[1].id})).status,403);
  assert.equal((await call(reception,'/users','POST',{})).status,403);
  receptionConfig.Appointments['Create Appointment']=false;
  assert.equal((await call(owner,`/roles/${roleFor('receptionist').id}`,'PUT',{permissions:receptionConfig})).status,200);
  assert.equal((await call(reception,'/clinic-records/appointments','POST',{})).status,403);
  assert.equal((await call(reception,'/clinic-records/appointments')).status,200,'Viewing remains independently enabled');
  const before=JSON.stringify(target.permissions),after=(await query('SELECT permissions FROM roles WHERE id=$1',[target.id])).rows[0];
  assert.equal(JSON.stringify(after.permissions),before,'Shared platform role is unchanged');
  const audits=(await query("SELECT count(*)::int AS count FROM audit_trail WHERE action='configure_clinic_role' AND user_id=$1",[owner.id])).rows[0];assert.ok(audits.count>=4);
  doctorConfig['Disease Intelligence']['View Reports']=true;
  doctorConfig['Disease Intelligence']['Generate Reports']=false;
  doctorConfig['Disease Intelligence']['Export Reports']=true;
  assert.equal((await call(owner,`/roles/${target.id}`,'PUT',{permissions:doctorConfig})).status,200);
  assert.equal((await call(doctor,'/disease-intelligence/summary')).status,200,'View access remains independent of actions');
  assert.equal((await call(doctor,'/disease-intelligence/report-data')).status,403,'Export does not grant report generation');
  assert.equal((await call(doctor,'/disease-intelligence/export-data')).status,200);
  doctorConfig['Disease Intelligence']['Generate Reports']=true;
  doctorConfig['Disease Intelligence']['Export Reports']=false;
  assert.equal((await call(owner,`/roles/${target.id}`,'PUT',{permissions:doctorConfig})).status,200);
  assert.equal((await call(doctor,'/disease-intelligence/report-data')).status,200);
  assert.equal((await call(doctor,'/disease-intelligence/export-data')).status,403,'Generating does not grant export');
  assert.equal((await call(doctor,'/disease-intelligence/clinic-alerts','POST',{})).status,403,'Viewing or generating does not grant clinic alerts');
  assert.equal((await call(doctor,'/disease-intelligence/follow-up-flags','POST',{})).status,403,'Viewing or generating does not grant follow-up flags');
  assert.equal((await call(reception,'/disease-intelligence/summary')).status,403,'Disease Intelligence is restricted to owners and doctors');
  assert.equal((await call(null,'/disease-intelligence/alerts/2147483647/history')).status,401,'Review history requires authentication');
  assert.equal((await call(reception,'/disease-intelligence/alerts/2147483647/history')).status,403,'Reception cannot access review history');
  assert.equal((await call(owner,'/disease-intelligence/alerts/2147483647/history')).status,404,'Authorized history requests still require a visible clinic signal');
  const invalidIntelligence=structuredClone(receptionConfig);
  invalidIntelligence['Disease Intelligence']['View Reports']=true;
  assert.equal((await call(owner,`/roles/${roleFor('receptionist').id}`,'PUT',{permissions:invalidIntelligence})).status,422,'Owner cannot give receptionist a restricted capability');
  for(const action of ['Generate Reports','Export Reports','Alert Clinics','Flag for Follow-up']) {
    assert.equal(policy.allowed('doctor',action),true);
    assert.equal(policy.allowed('owner',action),true);
    assert.equal(policy.allowed('receptionist',action),false);
  }
  await query('UPDATE users SET is_active=false WHERE id=$1',[doctor.id]);
  assert.equal((await call(doctor,'/me')).status,401,'Inactive users lose existing sessions');
  assert.equal((await call(null,'/roles')).status,401);
  console.log('PASS: real HTTP authentication; clinic-isolated role saves; doctor/receptionist capabilities; immediate revocation; direct API denial; privilege escalation denial; cross-clinic user protection; independent view/create; audit; shared roles preserved. All test data rolled back.');
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  db.query=oldQuery;db.pool.connect=oldConnect;await query('ROLLBACK');client.release();await db.pool.end();
 }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
