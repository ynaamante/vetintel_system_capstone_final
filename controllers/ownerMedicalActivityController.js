const db = require('../config/db');
const { schemaFor } = require('../utils/labResultSchema');
const lines = values => values.filter(value => value != null && String(value).trim()).join('\n');
const label = value => String(value || '').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());

function dateText(value) {
  const date = value instanceof Date ? value.toISOString() : value;
  return typeof date === 'string' ? date.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : undefined;
}

function section(title, entries) {
  const fields = entries.flatMap(([label, value]) => {
    if (typeof label !== 'string' || (typeof value !== 'string' && typeof value !== 'number')) return [];
    const text = String(value).trim();
    return text ? [{ label, value: text }] : [];
  });
  return { title, fields };
}

function medicationSections(row) {
  const start = dateText(row.start_date);
  const end = dateText(row.end_date);
  const courseLength = start && end ? (Date.parse(end) - Date.parse(start)) / 86400000 : -1;
  const days = courseLength >= 0 ? Math.max(courseLength, 1) : 0;
  return [
    section('Prescription', [
      ['Prescribing veterinarian', row.issued_by_name], ['Treatment plan', row.plan_title],
      ['Reason or diagnosis', row.plan_diagnosis], ['Prescribed on', dateText(row.issued_at)],
    ]),
    section('Dosing and schedule', [
      ['Dosage', row.dosage], ['Route', row.route], ['Frequency', row.frequency], ['Quantity', row.quantity],
      ['Start date', start], ['End date', end], ['Duration', days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : null],
    ]),
    section('Instructions', [['Owner instructions', row.instructions]]),
    section('Prescription history', [
      ['Prescription created', dateText(row.issued_at)], ['Course started', start],
      ...(row.administrations || []).map(item => ['Administered', [dateText(item.date), item.veterinarian, item.procedure].filter(Boolean).join(' · ')]),
      ['Current status', label(row.status) || 'Recorded'],
    ]),
  ];
}

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
      db.query(`SELECT a.id,a.reason,a.start_time,a.status,co.notes,co.completed_at,u.name AS veterinarian FROM appointments a
        LEFT JOIN consultations co ON co.appointment_id=a.id AND co.clinic_id=a.clinic_id AND co.pet_id=a.pet_id AND co.status='completed'
        LEFT JOIN users u ON u.id=co.doctor_id AND u.clinic_id=a.clinic_id
        WHERE a.pet_id=$1 AND a.clinic_id=$2 AND a.status::text='completed' AND COALESCE(a.archived,false)=false`,args),
      db.query(`SELECT d.id,d.diagnosis,d.case_classification,d.clinical_status,d.recorded_at,d.clinical_assessment,u.name AS veterinarian
        FROM patient_diagnoses d LEFT JOIN users u ON u.id=d.veterinarian_id AND u.clinic_id=d.clinic_id
        WHERE d.pet_id=$1 AND d.clinic_id=$2 AND d.record_status='finalized'`,args),
      db.query(`SELECT tp.id,tp.title,tp.diagnosis,tp.status,tp.follow_up,tp.steps,tp.created_at,tp.severity,u.name AS veterinarian
        FROM treatment_plans tp LEFT JOIN users u ON u.id=COALESCE(tp.attending_veterinarian_id,tp.issued_by) AND u.clinic_id=tp.clinic_id
        WHERE tp.pet_id=$1 AND tp.clinic_id=$2 AND COALESCE(tp.archived,false)=false AND lower(tp.status)<>'draft'`,args),
      db.query(`SELECT tr.id,tr.diagnosis,tr.procedure,tr.outcome,tr.status,tr.performed_at,tr.follow_up_instructions,tp.title AS plan_title,u.name AS veterinarian
        FROM treatment_records tr LEFT JOIN users u ON u.id=tr.performed_by AND u.clinic_id=tr.clinic_id
        LEFT JOIN treatment_plans tp ON tp.id=tr.treatment_plan_id AND tp.clinic_id=tr.clinic_id AND tp.pet_id=tr.pet_id
          AND COALESCE(tp.archived,false)=false AND lower(tp.status)<>'draft'
        WHERE tr.pet_id=$1 AND tr.clinic_id=$2 AND COALESCE(tr.archived,false)=false AND lower(tr.status)<>'draft'`,args),
      db.query(`SELECT id,test_name,results,collected_at,reported_at,metadata FROM lab_results
        WHERE pet_id=$1 AND clinic_id=$2 AND COALESCE((metadata->>'archived')::boolean,false)=false
          AND metadata->>'verified'='true'`,args),
      db.query(`SELECT v.id,v.vaccine_name,v.date_given,v.next_due,v.dose,v.manufacturer,v.batch_number,v.expiry_date,v.verified_at,v.status,
          u.name AS administered_by_name,verifier.name AS verified_by_name
        FROM vaccinations v LEFT JOIN users u ON u.id=v.administered_by AND u.clinic_id=v.clinic_id
        LEFT JOIN users verifier ON verifier.id=v.verified_by AND verifier.clinic_id=v.clinic_id
        WHERE v.pet_id=$1 AND v.clinic_id=$2 AND COALESCE(v.archived,false)=false AND v.verified=true`,args),
      db.query(`SELECT pr.id,pr.medication,pr.dosage,pr.route,pr.frequency,pr.start_date,pr.end_date,pr.instructions,pr.issued_at,pr.quantity,
        u.name AS issued_by_name,tp.id AS plan_id,tp.title AS plan_title,tp.diagnosis AS plan_diagnosis,
        CASE WHEN lower(COALESCE(tp.status,''))='completed' AND lower(COALESCE(pr.status,'active'))='active' THEN 'completed' ELSE pr.status END AS status,
        COALESCE(history.administrations,'[]'::json) AS administrations
        FROM prescriptions pr LEFT JOIN users u ON u.id=pr.issued_by AND u.clinic_id=pr.clinic_id
        LEFT JOIN treatment_plans tp ON tp.id=pr.treatment_plan_id AND tp.clinic_id=pr.clinic_id AND tp.pet_id=pr.pet_id
          AND COALESCE(tp.archived,false)=false AND lower(tp.status)<>'draft'
        LEFT JOIN LATERAL (
          SELECT json_agg(json_build_object('date',tr.performed_at,'procedure',tr.procedure,'veterinarian',vet.name)
            ORDER BY tr.performed_at DESC) AS administrations
          FROM treatment_record_prescriptions trp
          JOIN treatment_records tr ON tr.id=trp.treatment_record_id AND tr.clinic_id=pr.clinic_id AND tr.pet_id=pr.pet_id
          LEFT JOIN users vet ON vet.id=tr.performed_by AND vet.clinic_id=tr.clinic_id
          WHERE trp.prescription_id=pr.id AND trp.administered=true
            AND COALESCE(tr.archived,false)=false AND lower(tr.status)<>'draft'
        ) history ON true
        WHERE pr.pet_id=$1 AND pr.clinic_id=$2 AND COALESCE(pr.archived,false)=false AND lower(COALESCE(pr.status,'active'))<>'draft'`,args),
    ]);
    const records=[
      ...visits.rows.map(r=>({id:`visit:${r.id}`,type:'visit',category:'Visit',title:r.reason||'Clinic visit',date:r.start_time,status:'Completed',detail:lines([
        r.notes?.chiefComplaint&&`Reason: ${r.notes.chiefComplaint}`,r.notes?.clinicalFindings&&`Clinical findings: ${r.notes.clinicalFindings}`,
        r.notes?.diagnosis&&`Diagnosis: ${r.notes.diagnosis}`,r.notes?.diagnosisStatus&&`Diagnosis classification: ${r.notes.diagnosisStatus}`,
        r.notes?.treatment&&`Treatment: ${r.notes.treatment}`,r.notes?.outcome&&`Outcome: ${r.notes.outcome}`,
        r.notes?.followUpInstructions&&`Follow-up: ${r.notes.followUpInstructions}`])||'Completed clinic visit.',
        sections: [
          section('Visit summary', [
            ['Veterinarian', r.veterinarian], ['Completed on', dateText(r.completed_at)],
            ['Reason for visit', r.notes?.chiefComplaint], ['Summary for owner', r.notes?.ownerSummary],
            ['Clinical findings', r.notes?.clinicalFindings], ['Diagnosis', r.notes?.diagnosis],
            ['Diagnosis classification', label(r.notes?.diagnosisStatus)], ['Severity', r.notes?.severity],
          ]),
          section('Vital signs', [
            ['Weight (kg)', r.notes?.weight], ['Temperature (°C)', r.notes?.temperature],
            ['Heart rate (bpm)', r.notes?.heartRate], ['Respiratory rate (/min)', r.notes?.respiratoryRate],
            ['Hydration', r.notes?.hydration], ['Other vital signs', r.notes?.vitalSigns],
          ]),
          section('Treatment and follow-up', [
            ['Treatment', r.notes?.treatment], ['Outcome', r.notes?.outcome], ['Medication instructions', r.notes?.medications],
            ['Vaccination and deworming', r.notes?.vaccinations], ['Laboratory tests', r.notes?.labTests],
            ['Follow-up date', dateText(r.notes?.followUpDate)], ['Follow-up time', r.notes?.followUpTime],
            ['Follow-up instructions', r.notes?.followUpInstructions],
          ]),
        ],
      })),
      ...diagnoses.rows.map(r => {
        const assessment = r.clinical_assessment || {};
        return { id:`diagnosis:${r.id}`,type:'diagnosis',category:'Diagnosis',title:r.diagnosis,date:r.recorded_at,status:label(r.clinical_status),
          detail:lines([`Classification: ${label(r.case_classification)}`,`Clinical status: ${label(r.clinical_status)}`]),
          sections: [
            section('Diagnosis', [['Veterinarian', r.veterinarian], ['Classification', label(r.case_classification)], ['Clinical status', label(r.clinical_status)], ['Final diagnosis', assessment.final_diagnosis], ['Secondary diagnosis', assessment.secondary_diagnosis], ['Severity', assessment.severity]]),
            section('Clinical findings', [['Reported symptoms', assessment.reported_symptoms], ['Symptom onset', assessment.symptom_onset], ['Temperature', assessment.temperature], ['Heart rate', assessment.heart_rate], ['Respiratory rate', assessment.respiratory_rate], ['Weight', assessment.weight], ['Body condition', assessment.body_condition], ['Assessment', assessment.assessment]]),
            section('Care and follow-up', [['Treatment plan', assessment.plan], ['Follow-up date', dateText(assessment.follow_up_date)], ['Follow-up', assessment.follow_up], ['Discharge instructions', assessment.discharge_instructions]]),
          ],
        };
      }),
      ...plans.rows.map(r=>({id:`treatment-plan:${r.id}`,type:'treatment',category:'Treatment plan',title:r.title,date:r.created_at,status:label(r.status),detail:lines([r.diagnosis&&`Diagnosis: ${r.diagnosis}`,
        ...(Array.isArray(r.steps)?r.steps.map(step=>typeof step==='string'?step:step?.title||step?.description||step?.text||''):[]),r.follow_up&&`Follow-up: ${dateText(r.follow_up)}`]),
        sections: [
          section('Treatment plan', [['Veterinarian', r.veterinarian], ['Diagnosis', r.diagnosis], ['Severity', label(r.severity)], ['Follow-up date', dateText(r.follow_up)]]),
          section('Care steps', (Array.isArray(r.steps) ? r.steps : []).map((step, index) => [
            `Step ${index + 1}`, typeof step === 'string' ? step : lines([
              step?.title || step?.description || step?.text, step?.detail,
              step?.done === true && 'Completed', step?.due && `Due: ${step.due}`, step?.completedAt && `Completed on: ${dateText(step.completedAt)}`,
            ].filter(Boolean)),
          ])),
          section('Related prescriptions', medications.rows.filter(item => String(item.plan_id) === String(r.id))
            .map(item => [item.medication, [item.dosage, item.route, item.frequency, label(item.status)].filter(Boolean).join(' · ')])),
        ],
      })),
      ...treatments.rows.map(r=>({id:`treatment:${r.id}`,type:'treatment',category:'Treatment',title:r.procedure,date:r.performed_at,status:label(r.status),detail:lines([r.diagnosis&&`Diagnosis: ${r.diagnosis}`,r.outcome&&`Outcome: ${r.outcome}`,r.follow_up_instructions&&`Follow-up: ${r.follow_up_instructions}`]),
        sections: [section('Procedure details', [['Veterinarian', r.veterinarian], ['Diagnosis', r.diagnosis], ['Treatment plan', r.plan_title], ['Outcome', r.outcome], ['Follow-up instructions', r.follow_up_instructions]])],
      })),
      ...labs.rows.map(r => {
        const result = r.results || {};
        const metadata = r.metadata || {};
        const measurements = (Array.isArray(result.measurements) ? result.measurements : []).flatMap((item, index) => {
          if (!item || typeof item !== 'object') return [];
          const name = item.name || item.test || item.parameter || `Measurement ${index + 1}`;
          const value = item.value == null ? '' : [item.value, item.unit].filter(part => part != null && part !== '').join(' ');
          const description = [value, item.referenceRange && `Reference: ${item.referenceRange}`, item.status || item.flag].filter(Boolean).join(' · ');
          return description ? [[name, description]] : [];
        });
        const testSpecific = metadata.testSpecificResults;
        const schema = schemaFor(r.test_name);
        const testFields = testSpecific?.schemaId === schema.id && testSpecific?.testType === r.test_name
          ? schema.fields.map(field => [field.label, testSpecific.values?.[field.key]]) : [];
        return { id:`lab:${r.id}`,type:'lab',category:'Lab result',title:r.test_name,date:r.reported_at||r.collected_at,status:'Verified',clinicVerified:true,
          detail:lines([result.summary,result.interpretation,...measurements.map(([name,value]) => `${name} · ${value}`)])||'Verified laboratory result.',
          sections: [
            section('Test and verification', [['Result', metadata.testResult], ['Laboratory', metadata.laboratory], ['Specimen type', metadata.specimenType], ['Requested by', metadata.requestedBy], ['Collected on', dateText(r.collected_at || metadata.collectionDate)], ['Reported on', dateText(r.reported_at || metadata.resultDate)], ['Verified by', metadata.verifiedByName], ['Verified on', dateText(metadata.verifiedAt)]]),
            section('Findings', [['Summary', result.summary], ['Interpretation', result.interpretation]]),
            section('Measurements', measurements),
            section('Test-specific results', testFields),
          ],
        };
      }),
      ...vaccines.rows.map(r=>({id:`vaccine:${r.id}`,type:'vaccine',category:'Vaccine',title:r.vaccine_name,date:r.date_given,status:label(r.status)||'Verified',clinicVerified:true,detail:lines([r.dose&&`Dose: ${r.dose}`,r.manufacturer&&`Manufacturer: ${r.manufacturer}`,r.next_due&&`Next due: ${dateText(r.next_due)}`])||'Clinic-verified vaccination record.',
        sections: [
          section('Vaccination details', [['Dose', r.dose], ['Manufacturer', r.manufacturer], ['Batch or lot number', r.batch_number], ['Vaccine expiry date', dateText(r.expiry_date)], ['Next due date', dateText(r.next_due)]]),
          section('Administration and verification', [['Administered by', r.administered_by_name], ['Verified by', r.verified_by_name], ['Verified on', dateText(r.verified_at)]]),
        ],
      })),
      ...medications.rows.map(r=>({id:`medication:${r.id}`,type:'medication',category:'Medication',title:r.medication,date:r.issued_at,status:label(r.status)||'Recorded',detail:lines([r.dosage&&`Dosage: ${r.dosage}`,r.route&&`Route: ${r.route}`,r.frequency&&`Frequency: ${r.frequency}`,r.instructions]), sections:medicationSections(r)})),
    ];
    // Keep explicit doctor updates, but prefer current canonical rows over stale shared snapshots.
    const updates=new Map();
    for(const share of [...(Array.isArray(pet.shares)?pet.shares:[])].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))) {
      for(const record of share.records||[]) if(String(record.id).startsWith('doctor-update:')&&!updates.has(record.id)) updates.set(record.id,{...record,date:record.date||share.createdAt,sharedAt:share.createdAt,sharedBy:share.sharedBy,status:record.status||'Shared'});
    }
    records.push(...updates.values());
    res.json({petId:pet.id,petName:pet.name,clinicName:pet.clinic_name,records:records.map(r=>({
      ...r,sections:r.sections?.filter(group => group.fields.length),clinicName:pet.clinic_name,key:r.id,
      origin:String(r.id).startsWith('doctor-update:')?'shared':'clinic',
    })).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0))});
  }catch(error){next(error);}
};
