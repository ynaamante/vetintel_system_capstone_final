const db=require('../config/db');
const auth=require('../middleware/auth');
const assert=require('node:assert/strict');
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
    const monitoringResponse=await fetch('http://localhost:3000/api/disease-intelligence/monitoring?days=30',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000),cache:'no-store'});
    if(!monitoringResponse.ok)throw new Error(`Monitoring API returned HTTP ${monitoringResponse.status}.`);
    const monitoring=await monitoringResponse.json();
    assert.ok(Array.isArray(monitoring.case_summaries)&&Number.isInteger(monitoring.active_clinics),'The running backend is serving an older monitoring response. Restart the backend to load the updated service.');
    assert.equal(monitoring.case_summaries.reduce((n,row)=>n+(row.cases??0),0),monitoring.total_cases,'Table rows must match the case total');
    assert.equal(monitoring.total_cases,data.total_cases,'Dashboard and monitoring must match');
    assert.equal(monitoring.active_clinics,data.active_clinics,'Participating-clinic counts must match');
    assert.ok(monitoring.active_clinics>=monitoring.affected_clinics,'Reporting clinics cannot exceed participating clinics');
    const barangays=require('../config/santaMariaBarangays');
    assert.ok(barangays.every(area=>monitoring.area_options.includes(area)&&data.area_options.includes(area)),'All 24 barangays must be served by the running API');
    assert.ok(Array.isArray(data.clinic_participation),'The updated report participation data must be available');
    const {buildSurveillanceReport}=await import('../admin/src/utils/surveillanceReports.js');
    for(const type of ['disease','signals','clinics'])assert.ok(buildSurveillanceReport(data,{days:'30'},type).sections.length,'All three report types must build from the live monitoring snapshot');
    const historyResponse=await fetch('http://localhost:3000/api/disease-intelligence/alerts/2147483647/history',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000),cache:'no-store'});
    assert.equal(historyResponse.status,404,'Unknown signal history must be unavailable');
    assert.equal((await historyResponse.json()).error,'Signal is no longer visible in your clinic.','The updated history endpoint must be active');
    console.log('PASS: running Dashboard and monitoring APIs expose matching totals and case-summary rows; all three report models build from the live snapshot; private signal-history route is active.');
  } finally {await db.pool.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
