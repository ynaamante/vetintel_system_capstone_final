const db=require('../config/db'),auth=require('../middleware/auth'),policy=require('../utils/rolePermissions');
(async()=>{
 try{
  const rows=(await db.query(`SELECT u.id,u.clinic_id,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id
    WHERE COALESCE(u.is_active,true) AND u.clinic_id IS NOT NULL ORDER BY u.id`)).rows;
  const actors=['owner','doctor','receptionist'].map(profile=>rows.find(row=>policy.profile(row.role)===profile)).filter(Boolean);
  for(const actor of actors){
   const headers={Authorization:`Bearer ${auth.signUserToken({...actor,exp:Date.now()+60000})}`,'Content-Type':'application/json'};
   const response=await fetch('http://localhost:3000/api/me',{headers,signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error(`Current-user check returned HTTP ${response.status}.`);
   const data=await response.json();
   if(!data.permissions)throw new Error('Running backend has not loaded clinic RBAC.');
   if(!Object.hasOwn(data.permissions['Disease Intelligence']||{},'Generate Reports'))throw new Error('Running backend has not loaded separate Disease Intelligence action permissions.');
   if(policy.profile(data.role)==='receptionist'&&Object.values(data.permissions['Disease Intelligence']).some(Boolean))throw new Error('Receptionist has a restricted Disease Intelligence capability.');
   if(policy.profile(data.role)!=='owner'){
    const denied=await fetch('http://localhost:3000/api/roles/1',{method:'PUT',headers,body:JSON.stringify({permissions:{}}),signal:AbortSignal.timeout(10000)});
    if(denied.status!==403)throw new Error('Staff role modification was not rejected.');
   }else{
    const roles=await fetch('http://localhost:3000/api/roles',{headers,signal:AbortSignal.timeout(10000)});
    if(!roles.ok)throw new Error('Owner cannot load the role configuration.');
   }
   console.log('Verified running API:',{profile:policy.profile(data.role),permission_groups:Object.keys(data.permissions).length,role_management:policy.profile(data.role)==='owner'?'allowed':'denied'});
  }
 }finally{await db.pool.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
