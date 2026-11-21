const db = require('../config/db');
const lines = values => values.filter(value => value != null && String(value).trim()).join('\n');
const label = value => String(value || '').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());

exports.list = async(req,res,next) => {
  if(!req.user?.id || !req.user.email || !['','user','pet_owner'].includes(req.user.role || '')) return res.status(403).json({error:'Pet-owner account required.'});
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid clinic pet ID.'});
  try {
    const pet=(await db.query(`SELECT p.id,p.clinic_id,p.name,cl.name AS clinic_name,p.metadata->'owner_shared_records' AS shares
      FROM pets p JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id JOIN clinics cl ON cl.id=p.clinic_id
      WHERE p.id=$1 AND lower(trim(c.email))=lower(trim($2)) AND COALESCE((p.metadata->>'archived')::boolean,false)=false
        AND COALESCE(cl.archived,false)=false`,[id,req.user.email])).rows[0];
    if(!pet)return res.status(404).json({error:'Clinic patient not found in your account.'});
    const args=[id,pet.clinic_id];
    const [visits,diagnoses,plans,treatments,labs,vaccines,medications]=await Promise.all([
      db.query(`SELECT a.id,a.reason,a.start_time,a.status,co.notes FROM appointments a
        LEFT JOIN consultations co ON co.appointment_id=a.id AND co.clinic_id=a.clinic_id AND co.status='completed'
        WHERE a.pet_id=$1 AND a.clinic_id=$2 AND a.status::text='completed' AND COALESCE(a.archived,false)=false`,args),
      db.query(`SELECT id,diagnosis,case_classification,clinical_status,recorded_at FROM patient_diagnoses
        WHERE pet_id=$1 AND clinic_id=$2 AND record_status='finalized'`,args),
      db.query(`SELECT id,title,diagnosis,status,follow_up,steps,created_at FROM treatment_plans
        WHERE pet_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false AND lower(status)<>'draft'`,args),
      db.query(`SELECT id,diagnosis,procedure,outcome,status,performed_at,follow_up_instructions FROM treatment_records
        WHERE pet_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false AND lower(status)<>'draft'`,args),
      db.query(`SELECT id,test_name,results,collected_at,reported_at,metadata FROM lab_results
        WHERE pet_id=$1 AND clinic_id=$2 AND COALESCE((metadata->>'archived')::boolean,false)=false
          AND metadata->>'verified'='true'`,args),
      db.query(`SELECT id,vaccine_name,date_given,next_due,dose,manufacturer,verified,verified_at,status FROM vaccinations
        WHERE pet_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false AND verified=true`,args),
      db.query(`SELECT pr.id,pr.medication,pr.dosage,pr.route,pr.frequency,pr.start_date,pr.end_date,pr.instructions,pr.issued_at,
        CASE WHEN lower(COALESCE(tp.status,''))='completed' AND lower(COALESCE(pr.status,'active'))='active' THEN 'completed' ELSE pr.status END AS status
        FROM prescriptions pr LEFT JOIN treatment_plans tp ON tp.id=pr.treatment_plan_id AND tp.clinic_id=pr.clinic_id
        WHERE pr.pet_id=$1 AND pr.clinic_id=$2 AND COALESCE(pr.archived,false)=false AND lower(COALESCE(pr.status,'active'))<>'draft'`,args),
    ]);
    const records=[
      ...visits.rows.map(r=>({id:`visit:${r.id}`,type:'visit',category:'Visit',title:r.reason||'Clinic visit',date:r.start_time,status:'Completed',detail:lines([
        r.notes?.chiefComplaint&&`Reason: ${r.notes.chiefComplaint}`,r.notes?.clinicalFindings&&`Clinical findings: ${r.notes.clinicalFindings}`,
        r.notes?.diagnosis&&`Diagnosis: ${r.notes.diagnosis}`,r.notes?.diagnosisStatus&&`Diagnosis classification: ${r.notes.diagnosisStatus}`,
        r.notes?.treatment&&`Treatment: ${r.notes.treatment}`,r.notes?.outcome&&`Outcome: ${r.notes.outcome}`,
        r.notes?.followUpInstructions&&`Follow-up: ${r.notes.followUpInstructions}`])||'Completed clinic visit.'})),
      ...diagnoses.rows.map(r=>({id:`diagnosis:${r.id}`,type:'diagnosis',category:'Diagnosis',title:r.diagnosis,date:r.recorded_at,status:label(r.clinical_status),detail:lines([`Classification: ${label(r.case_classification)}`,`Clinical status: ${label(r.clinical_status)}`])})),
      ...plans.rows.map(r=>({id:`treatment-plan:${r.id}`,type:'treatment',category:'Treatment plan',title:r.title,date:r.created_at,status:label(r.status),detail:lines([r.diagnosis&&`Diagnosis: ${r.diagnosis}`,
        ...(Array.isArray(r.steps)?r.steps.map(step=>typeof step==='string'?step:step?.title||step?.description||step?.text||''):[]),r.follow_up&&`Follow-up: ${new Date(r.follow_up).toISOString().slice(0,10)}`])})),
      ...treatments.rows.map(r=>({id:`treatment:${r.id}`,type:'treatment',category:'Treatment',title:r.procedure,date:r.performed_at,status:label(r.status),detail:lines([r.diagnosis&&`Diagnosis: ${r.diagnosis}`,r.outcome&&`Outcome: ${r.outcome}`,r.follow_up_instructions&&`Follow-up: ${r.follow_up_instructions}`])})),
      ...labs.rows.map(r=>({id:`lab:${r.id}`,type:'lab',category:'Lab result',title:r.test_name,date:r.reported_at||r.collected_at,status:'Verified',clinicVerified:true,detail:lines([r.results?.summary,r.results?.interpretation,
        ...(Array.isArray(r.results?.measurements)?r.results.measurements.map(m=>lines([m.name||m.test||m.parameter,m.value!=null?`${m.value} ${m.unit||''}`:'',m.referenceRange?`Reference: ${m.referenceRange}`:'']).replace(/\n/g,' · ')):[])])||'Verified laboratory result.'})),
      ...vaccines.rows.map(r=>({id:`vaccine:${r.id}`,type:'vaccine',category:'Vaccine',title:r.vaccine_name,date:r.date_given,status:label(r.status)||'Verified',clinicVerified:true,detail:lines([r.dose&&`Dose: ${r.dose}`,r.manufacturer&&`Manufacturer: ${r.manufacturer}`,r.next_due&&`Next due: ${new Date(r.next_due).toISOString().slice(0,10)}`])||'Clinic-verified vaccination record.'})),
      ...medications.rows.map(r=>({id:`medication:${r.id}`,type:'medication',category:'Medication',title:r.medication,date:r.issued_at,status:label(r.status)||'Recorded',detail:lines([r.dosage&&`Dosage: ${r.dosage}`,r.route&&`Route: ${r.route}`,r.frequency&&`Frequency: ${r.frequency}`,r.instructions])})),
    ];
    // Keep explicit doctor updates, but prefer current canonical rows over stale shared snapshots.
    const updates=new Map();
    for(const share of [...(Array.isArray(pet.shares)?pet.shares:[])].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))) {
      for(const record of share.records||[]) if(String(record.id).startsWith('doctor-update:')&&!updates.has(record.id)) updates.set(record.id,{...record,date:record.date||share.createdAt,sharedAt:share.createdAt,sharedBy:share.sharedBy,status:record.status||'Shared'});
    }
    records.push(...updates.values());
    res.json({petId:pet.id,petName:pet.name,clinicName:pet.clinic_name,records:records.map(r=>({...r,clinicName:pet.clinic_name,key:r.id,origin:String(r.id).startsWith('doctor-update:')?'shared':'clinic'})).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0))});
  }catch(error){next(error);}
};
