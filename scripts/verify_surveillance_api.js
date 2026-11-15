const db=require('../config/db');
const auth=require('../middleware/auth');
(async()=>{
  try {
    const actor=(await db.query(`SELECT u.id,u.clinic_id FROM users u JOIN roles r ON r.id=u.role_id
      WHERE COALESCE(u.is_active,true) AND lower(regexp_replace(trim(r.name),'[[:space:]-]+','_','g')) IN ('doctor','veterinarian','assistant_doctor')
      AND EXISTS(SELECT 1 FROM patient_diagnoses d WHERE d.clinic_id=u.clinic_id) LIMIT 1`)).rows[0];
    if(!actor) throw new Error('No existing clinical user is available for the API check.');
    const token=auth.signUserToken({...actor,role:'doctor',exp:Date.now()+60000});
    const response=await fetch('http://localhost:3000/api/disease-intelligence/summary?days=30',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw new Error(`Local API returned HTTP ${response.status}.`);
    const data=await response.json();
    console.log('Running API:',{connected_clinics:data.active_clinics,reported_cases:data.total_cases,own_clinic_cases:data.own_clinic_cases,scope:data.privacy?.visibility_scope});
  } finally {await db.pool.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
