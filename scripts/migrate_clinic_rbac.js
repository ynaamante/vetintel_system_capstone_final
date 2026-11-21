const db=require('../config/db');
(async()=>{
 try{
  await require('../services/clinicPermissions').ensureSchema();
  console.log('Clinic RBAC schema installed. Existing shared roles and users were preserved.');
 }finally{await db.pool.end();}
})().catch(error=>{console.error('Clinic RBAC migration failed:',error.code||'UNKNOWN');process.exitCode=1;});
