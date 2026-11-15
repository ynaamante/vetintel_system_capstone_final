const db = require('../config/db');
(async()=>{
 try {
  console.log('Clinic inventory:',(await db.query(`SELECT c.id,
    COALESCE(c.metadata->>'status','active') AS status,COALESCE(c.archived,false) AS archived,
    (SELECT count(*)::int FROM users u WHERE u.clinic_id=c.id AND COALESCE(u.is_active,true)) AS active_staff,
    (SELECT count(*)::int FROM pets p WHERE p.clinic_id=c.id) AS patients,
    (SELECT count(*)::int FROM patient_diagnoses d WHERE d.clinic_id=c.id) AS diagnoses
    FROM clinics c ORDER BY c.id`)).rows);
  console.log('Diagnosis eligibility:',(await db.query(`SELECT d.clinic_id,d.record_status,d.case_classification,
    d.monitored_disease_id,COUNT(*)::int AS records,
    COUNT(*) FILTER(WHERE d.recorded_at >= now()-interval '30 days')::int AS last_30_days,
    COUNT(*) FILTER(WHERE d.recorded_at > now())::int AS future_dated
    FROM patient_diagnoses d GROUP BY d.clinic_id,d.record_status,d.case_classification,d.monitored_disease_id ORDER BY d.clinic_id`)).rows);
  console.log('Unmapped finalized diagnosis labels:',(await db.query("SELECT DISTINCT diagnosis FROM patient_diagnoses WHERE record_status='finalized' AND case_classification='confirmed' AND monitored_disease_id IS NULL")).rows);
  console.log('Clinical source inventory:',(await db.query(`SELECT 'treatment_plans' AS source,count(*)::int AS records FROM treatment_plans WHERE NULLIF(trim(diagnosis),'') IS NOT NULL
    UNION ALL SELECT 'treatment_records',count(*)::int FROM treatment_records WHERE NULLIF(trim(diagnosis),'') IS NOT NULL
    UNION ALL SELECT 'consultations',count(*)::int FROM consultations WHERE NULLIF(trim(notes->>'diagnosis'),'') IS NOT NULL`)).rows);
  const fs=require('fs'),path=require('path');
  const sql=fs.readFileSync(path.join(__dirname,'confirmed_surveillance_summary.sql'),'utf8');
  const prefix=sql.slice(0,sql.indexOf('), released AS ('));
  console.log('Eligible privacy cells:',(await db.query(prefix+`) SELECT disease_key,current_period,cases,patients FROM cells ORDER BY disease_key`,[30,null,null])).rows);
  const clinic=(await db.query('SELECT clinic_id FROM patient_diagnoses GROUP BY clinic_id ORDER BY count(*) DESC LIMIT 1')).rows[0];
  if(clinic) await require('../controllers/diseaseIntelligenceController').summary(
    {user:{role:'doctor',clinic_id:clinic.clinic_id},query:{days:'30'}},
    {json(data){console.log('Dashboard summary for originating clinic:',{connected_clinics:data.active_clinics,reported_cases:data.total_cases,own_clinic_cases:data.own_clinic_cases,diseases:data.diseases.map(row=>({disease:row.disease,cases:row.cases}))});},status(){return this;}},error=>{throw error;});
 } finally {await db.pool.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
