const db = require('../config/db');
const { publish } = require('../utils/clinicEvents');
const fs = require('fs');
const path = require('path');
exports.ensureSchema = () => db.query(fs.readFileSync(path.join(__dirname, '../scripts/patient_diagnoses_schema.sql'), 'utf8'));
const roles = new Set(['doctor', 'assistant_doctor', 'veterinarian', 'owner', 'clinic_owner', 'super_admin']);
exports.list = async (req, res, next) => {
  try {
    const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!roles.has(role)) return res.status(403).json({ error: 'Clinical staff access required.' });
    const clinic = Number(role === 'super_admin' ? req.query.clinic_id : req.user?.clinic_id);
    const pet = Number(req.params.id);
    if (!Number.isInteger(clinic) || clinic < 1 || !Number.isInteger(pet) || pet < 1) return res.status(400).json({ error: 'A valid clinic and patient are required.' });
    const exists = await db.query('SELECT id FROM pets WHERE id=$1 AND clinic_id=$2', [pet, clinic]);
    if (!exists.rows.length) return res.status(404).json({ error: 'Patient not found.' });
    const result = await db.query(`SELECT d.*,u.name AS veterinarian FROM (
      SELECT 'consultation-'||co.id AS id,co.notes->>'diagnosis' AS diagnosis,
        'Consultation'::text AS source,'Recorded'::text AS assessment,co.status,
        COALESCE(co.completed_at,co.started_at,co.created_at) AS recorded_at,co.doctor_id AS veterinarian_id
      FROM consultations co WHERE co.clinic_id=$1 AND co.pet_id=$2 AND NULLIF(BTRIM(co.notes->>'diagnosis'),'') IS NOT NULL
      UNION ALL
      SELECT 'plan-'||tp.id,tp.diagnosis,'Treatment plan','Recorded',tp.status,tp.created_at,COALESCE(tp.attending_veterinarian_id,tp.issued_by)
      FROM treatment_plans tp WHERE tp.clinic_id=$1 AND tp.pet_id=$2 AND COALESCE(tp.archived,false)=false AND NULLIF(BTRIM(tp.diagnosis),'') IS NOT NULL
      UNION ALL
      SELECT 'treatment-'||tr.id,tr.diagnosis,'Treatment record','Recorded',tr.status,COALESCE(tr.performed_at,tr.created_at),tr.performed_by
      FROM treatment_records tr WHERE tr.clinic_id=$1 AND tr.pet_id=$2 AND COALESCE(tr.archived,false)=false AND NULLIF(BTRIM(tr.diagnosis),'') IS NOT NULL
      UNION ALL
      SELECT 'admission-'||s.id,s.provisional_diagnosis,'Admission','Provisional',s.status,COALESCE(s.admitted_at,s.admitted_on::timestamptz),s.attending_veterinarian_id
      FROM clinic_inpatient_stays s WHERE s.clinic_id=$1 AND s.pet_id=$2 AND NULLIF(BTRIM(s.provisional_diagnosis),'') IS NOT NULL
    ) d LEFT JOIN users u ON u.id=d.veterinarian_id AND u.clinic_id=$1 ORDER BY d.recorded_at DESC NULLS LAST,d.id`, [clinic, pet]);
    const saved = await db.query(`SELECT 'diagnosis-'||d.id AS id,d.id AS database_id,d.diagnosis,
      'Diagnosis'::text AS source,'Recorded'::text AS assessment,d.case_classification,d.clinical_status,
      d.clinical_status AS status,d.recorded_at,d.veterinarian_id,u.name AS veterinarian,d.notes,d.clinical_assessment,d.updated_at
      FROM patient_diagnoses d LEFT JOIN users u ON u.id=d.veterinarian_id AND u.clinic_id=d.clinic_id
      WHERE d.clinic_id=$1 AND d.pet_id=$2`, [clinic,pet]);
    return res.json([...saved.rows, ...result.rows].sort((a,b) => new Date(b.recorded_at)-new Date(a.recorded_at) || a.id.localeCompare(b.id)));
  } catch (error) { return next(error); }
};

exports.save = async (req,res,next) => {
  const role=String(req.user?.role||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
  if(!['doctor','assistant_doctor','veterinarian'].includes(role))return res.status(403).json({error:'Only veterinarians can record a diagnosis.'});
  const clinic=Number(req.user?.clinic_id),pet=Number(req.params.id),id=req.params.diagnosisId?Number(req.params.diagnosisId):null;
  const {diagnosis,case_classification,clinical_status,veterinarian_id,recorded_at,notes=''}=req.body;
  const rawAssessment = req.body.clinical_assessment;
  if (rawAssessment != null && (typeof rawAssessment !== 'object' || Array.isArray(rawAssessment))) return res.status(422).json({error:'Invalid clinical assessment.'});
  const assessmentKeys = ['temperature','heart_rate','respiratory_rate','weight','body_condition','severity','subjective','objective','assessment','plan','secondary_diagnosis','final_diagnosis','follow_up','follow_up_date','discharge_instructions','consultation_type','symptom_onset','laboratory_result','reported_symptoms','possible_exposure','diagnosis_remarks'];
  const clinicalAssessment = Object.fromEntries(assessmentKeys.filter(key => rawAssessment && Object.hasOwn(rawAssessment, key)).map(key => [key, rawAssessment[key]]));
  if (Object.values(clinicalAssessment).some(value => typeof value !== 'string' || value.length > 1000)) return res.status(422).json({error:'Clinical assessment fields must be text of at most 1000 characters.'});
  const assessmentJson = JSON.stringify(clinicalAssessment);
  const vet=Number(veterinarian_id),date=new Date(recorded_at);
  if(!Number.isInteger(clinic)||clinic<1||!Number.isInteger(pet)||pet<1||(id!==null&&(!Number.isInteger(id)||id<1))||typeof diagnosis!=='string'||!diagnosis.trim()||diagnosis.length>300||typeof notes!=='string'||notes.length>5000||!['suspected','probable','confirmed','ruled_out'].includes(case_classification)||!['ongoing','under_treatment','resolved'].includes(clinical_status)||!Number.isInteger(vet)||vet<1||typeof recorded_at!=='string'||Number.isNaN(date.getTime())||date.getTime()>Date.now()+60000)return res.status(422).json({error:'Enter a diagnosis, valid classification, status, veterinarian, and a date that is not in the future.'});
  let client;
  try{
    client=await db.pool.connect();await client.query('BEGIN');
    if(!(await client.query('SELECT id FROM pets WHERE id=$1 AND clinic_id=$2 FOR SHARE',[pet,clinic])).rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Patient not found.'});}
    const veterinarian=await client.query(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND u.clinic_id=$2 AND COALESCE(u.is_active,true) AND lower(regexp_replace(trim(r.name),'[[:space:]-]+','_','g')) IN ('doctor','assistant_doctor','veterinarian')`,[vet,clinic]);
    if(!veterinarian.rows.length){await client.query('ROLLBACK');return res.status(422).json({error:'Select an active veterinarian at this clinic.'});}
    let previous=null;
    if(id){previous=(await client.query('SELECT * FROM patient_diagnoses WHERE id=$1 AND clinic_id=$2 AND pet_id=$3 FOR UPDATE',[id,clinic,pet])).rows[0];if(!previous){await client.query('ROLLBACK');return res.status(404).json({error:'Diagnosis not found.'});}}
    const fields=[diagnosis.trim(),case_classification,clinical_status,vet,date.toISOString(),notes.trim()];
    const result=id?await client.query(`UPDATE patient_diagnoses SET diagnosis=$1,case_classification=$2,clinical_status=$3,veterinarian_id=$4,recorded_at=$5,notes=$6,clinical_assessment=$10::jsonb,updated_at=now() WHERE id=$7 AND clinic_id=$8 AND pet_id=$9 RETURNING *`,[...fields,id,clinic,pet,assessmentJson]):await client.query(`INSERT INTO patient_diagnoses(diagnosis,case_classification,clinical_status,veterinarian_id,recorded_at,notes,clinic_id,pet_id,recorded_by,clinical_assessment) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,[...fields,clinic,pet,req.user.id,assessmentJson]);
    const row=result.rows[0];
    await client.query("INSERT INTO audit_trail(user_id,action,table_name,record_id,old_data,new_data) VALUES($1,$2,'patient_diagnoses',$3,$4::jsonb,$5::jsonb)",[req.user.id,id?'update_diagnosis':'create_diagnosis',row.id,previous?JSON.stringify(previous):null,JSON.stringify(row)]);
    await client.query('COMMIT');publish(clinic,'diagnosis');return res.status(id?200:201).json(row);
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});return next(error);}finally{client?.release();}
};
