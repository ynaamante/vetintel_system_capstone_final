const assert=require('node:assert/strict');
const db=require('../config/db');
const controller=require('../controllers/clinicRecordController');
async function main(){
 const original=db.query;
 try{
  let mode='success',writes=0,audits=0;
  db.query=async(sql,args)=>{
   if(sql.startsWith('SELECT * FROM clients')){assert.deepEqual(args,[8,11]);return{rows:mode==='missing'?[]:[{id:8,clinic_id:11,name:'Previous Owner'}]};}
   if(sql.startsWith('SELECT id FROM clients'))return{rows:mode==='duplicate'?[{id:9}]:[]};
   if(sql.startsWith('UPDATE clients')){writes++;assert.equal(args[4],8);assert.equal(args[5],11);return{rows:[{id:8,name:args[0],email:args[1],phone:args[2],address:args[3]}]};}
   if(sql.includes('INSERT INTO audit_trail')){audits++;assert.equal(JSON.parse(args[4]).name,'Previous Owner');return{rows:[]};}
   throw new Error('Unexpected query');
  };
  const run=async(body)=>{let status=200,payload;await controller.updateClient({user:{id:18,clinic_id:11,role:'doctor'},params:{id:'8'},query:{clinic_id:'11'},body,ip:'127.0.0.1'},{status(n){status=n;return this;},json(b){payload=b;}},e=>{throw e;});return{status,payload};};
  const input={name:'Updated Owner',email:'owner@example.com',phone:'09123456789',address:'Updated address'};
  assert.equal((await run(input)).status,200);assert.equal(writes,1);assert.equal(audits,1);
  assert.equal((await run({...input,email:'bad'})).status,422);assert.equal(writes,1);
  mode='duplicate';assert.equal((await run(input)).status,409);assert.equal(writes,1);
  mode='missing';assert.equal((await run(input)).status,404);assert.equal(writes,1);
  console.log('PASS: owner update, validation, duplicate rejection, clinic-scoped missing record, and audit history. No database writes.');
 }finally{db.query=original;await db.pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
