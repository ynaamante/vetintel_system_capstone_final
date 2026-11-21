const crypto = require('crypto');
const db = require('../config/db');
exports.ensureSchema = () => db.query(require('fs').readFileSync(require('path').join(__dirname,'../scripts/pet_sharing_schema.sql'),'utf8'));
const uuid = value => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(String(value || ''));
const owner = (req,res) => {
  if (!req.user?.id || !req.user.email || !['','user','pet_owner'].includes(req.user.role || '')) { res.status(403).json({error:'Pet-owner account required.'}); return false; }
  return true;
};
const doctor = (req,res) => {
  if (!['doctor','assistant_doctor','veterinarian'].includes(req.user?.role) || !Number.isSafeInteger(Number(req.user.clinic_id)) || Number(req.user.clinic_id)<1) { res.status(403).json({error:'Sign in as a clinic veterinarian.'}); return false; }
  return true;
};
const owned = `q.owner_id=$1 AND EXISTS(SELECT 1 FROM pets p JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id
  WHERE p.id=q.pet_id AND p.clinic_id=q.source_clinic_id AND lower(trim(c.email))=lower(trim($2))
    AND COALESCE((p.metadata->>'archived')::boolean,false)=false)`;
const status = row => row.status==='pending' && new Date(row.request_expires_at)<=new Date() || row.status==='approved' && new Date(row.access_expires_at)<=new Date() ? 'expired' : row.status;
const mapRequest = row => ({ id: row.id, status: status(row), requestExpiresAt: row.request_expires_at, accessExpiresAt: row.access_expires_at });
async function audit(client,req,id,action) {
  await client.query(`INSERT INTO audit_trail(user_id,action,table_name,new_data) VALUES($1,$2,'pet_sharing_requests',$3::jsonb)`, [req.user.id,action,JSON.stringify({request_id:id})]);
}
exports.issue = async(req,res,next) => {
  if (!owner(req,res)) return;
  const id=Number(req.params.id); if(!Number.isSafeInteger(id)||id<1) return res.status(400).json({error:'Invalid pet.'});
  try {
    const pet=(await db.query(`SELECT p.id,p.clinic_id FROM pets p JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id
      WHERE p.id=$1 AND lower(trim(c.email))=lower(trim($2)) AND COALESCE((p.metadata->>'archived')::boolean,false)=false`,[id,req.user.email])).rows[0];
    if(!pet) return res.status(404).json({error:'Clinic-linked pet not found in your account.'});
    const token=crypto.randomBytes(32).toString('hex');
    const row=(await db.query(`INSERT INTO pet_sharing_qr(id,token_hash,pet_id,source_clinic_id,owner_id,expires_at)
      VALUES($1,$2,$3,$4,$5,now()+interval '5 minutes') RETURNING expires_at`,[crypto.randomUUID(),crypto.createHash('sha256').update(token).digest('hex'),id,pet.clinic_id,req.user.id])).rows[0];
    res.json({value:`vetintel:pet-share:${token}`,expiresAt:row.expires_at});
  } catch(error){next(error);}
};
exports.request = async(req,res,next) => {
  if(!doctor(req,res)) return;
  const token=String(req.body.token||'').replace(/^vetintel:pet-share:/,'').trim();
  if(!/^[a-f0-9]{64}$/.test(token)) return res.status(422).json({error:'Scan a valid PetWatch medical-history QR.'});
  let client;
  try {
    client=await db.pool.connect(); await client.query('BEGIN');
    const qr=(await client.query(`SELECT q.id FROM pet_sharing_qr q JOIN users u ON u.id=q.owner_id
      JOIN pets p ON p.id=q.pet_id AND p.clinic_id=q.source_clinic_id JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id
      WHERE q.token_hash=$1 AND q.expires_at>now() AND lower(trim(c.email))=lower(trim(u.email))
        AND COALESCE((p.metadata->>'archived')::boolean,false)=false FOR SHARE OF q`,[crypto.createHash('sha256').update(token).digest('hex')])).rows[0];
    if(!qr){await client.query('ROLLBACK');return res.status(410).json({error:'QR expired or unavailable. Ask the owner to show a new QR.'});}
    const row=(await client.query(`INSERT INTO pet_sharing_requests(id,qr_id,doctor_id,doctor_clinic_id)
      VALUES($1,$2,$3,$4) ON CONFLICT(qr_id,doctor_id) DO UPDATE SET qr_id=EXCLUDED.qr_id RETURNING *`,[crypto.randomUUID(),qr.id,req.user.id,req.user.clinic_id])).rows[0];
    await audit(client,req,row.id,'request_pet_history'); await client.query('COMMIT');
    res.status(201).json(mapRequest(row));
  }catch(error){if(client)await client.query('ROLLBACK');next(error);}finally{if(client)client.release();}
};
exports.ownerRequests = async(req,res,next) => {
  if(!owner(req,res))return;
  try {
    const rows=(await db.query(`SELECT r.*,p.name AS pet_name,u.name AS doctor_name,cl.name AS clinic_name,q.pet_id
      FROM pet_sharing_requests r JOIN pet_sharing_qr q ON q.id=r.qr_id JOIN pets p ON p.id=q.pet_id
      JOIN users u ON u.id=r.doctor_id JOIN clinics cl ON cl.id=r.doctor_clinic_id
      WHERE ${owned} ORDER BY r.created_at DESC LIMIT 100`,[req.user.id,req.user.email])).rows;
    res.json(rows.map(r=>({id:`share-${r.id}`,accessRequestId:r.id,requestStatus:status(r),title:'Medical history access request',
      message:`${r.doctor_name} at ${r.clinic_name} requests ${r.pet_name}’s medical history. Allow access for 30 minutes?`,
      doctorName:r.doctor_name,clinicName:r.clinic_name,petId:r.pet_id,petName:r.pet_name,type:'access_request',severity:'moderate',date:r.created_at,
      read:Boolean(r.read_at),received:true,requestExpiresAt:r.request_expires_at,accessExpiresAt:r.access_expires_at})));
  }catch(error){next(error);}
};
exports.decide = async(req,res,next) => {
  if(!owner(req,res))return;
  const action=req.body.action;
  if(!uuid(req.params.id)||!['approve','deny','revoke'].includes(action))return res.status(422).json({error:'Choose allow, decline, or revoke.'});
  let client;
  try {
    client=await db.pool.connect();await client.query('BEGIN');
    const row=(await client.query(`SELECT r.* FROM pet_sharing_requests r JOIN pet_sharing_qr q ON q.id=r.qr_id
      WHERE ${owned} AND r.id=$3 FOR UPDATE OF r`,[req.user.id,req.user.email,req.params.id])).rows[0];
    if(!row){await client.query('ROLLBACK');return res.status(404).json({error:'Request not found.'});}
    if(action==='revoke'?status(row)!=='approved':status(row)!=='pending'){
      await client.query('ROLLBACK');return res.status(409).json({error:'This request has already been decided or expired.'});
    }
    const updated=(await client.query(`UPDATE pet_sharing_requests SET status=$2,decided_at=now(),read_at=now(),
      access_expires_at=CASE WHEN $2='approved' THEN now()+interval '30 minutes' ELSE NULL END WHERE id=$1 RETURNING *`,[row.id,{approve:'approved',deny:'denied',revoke:'revoked'}[action]])).rows[0];
    await audit(client,req,row.id,`pet_history_${action}`);await client.query('COMMIT');res.json(mapRequest(updated));
  }catch(error){if(client)await client.query('ROLLBACK');next(error);}finally{if(client)client.release();}
};
exports.read = async(req,res,next) => {
  if(!owner(req,res))return;
  const id=req.params.id; if(id&&!uuid(id))return res.status(400).json({error:'Invalid request.'});
  try{
    const rows=(await db.query(`UPDATE pet_sharing_requests r SET read_at=COALESCE(r.read_at,now()) FROM pet_sharing_qr q
      WHERE q.id=r.qr_id AND ${owned} ${id?'AND r.id=$3':''} RETURNING r.id`,id?[req.user.id,req.user.email,id]:[req.user.id,req.user.email])).rows;
    res.json({ids:rows.map(r=>`share-${r.id}`)});
  }catch(error){next(error);}
};
exports.view = async(req,res,next) => {
  if(!doctor(req,res))return;
  if(!uuid(req.params.id))return res.status(400).json({error:'Invalid request.'});
  try {
    const row=(await db.query(`SELECT r.*,q.pet_id,q.source_clinic_id FROM pet_sharing_requests r JOIN pet_sharing_qr q ON q.id=r.qr_id
      JOIN pets p ON p.id=q.pet_id AND p.clinic_id=q.source_clinic_id JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id JOIN users u ON u.id=q.owner_id
      WHERE r.id=$1 AND r.doctor_id=$2 AND r.doctor_clinic_id=$3 AND lower(trim(c.email))=lower(trim(u.email))
        AND COALESCE((p.metadata->>'archived')::boolean,false)=false`,[req.params.id,req.user.id,req.user.clinic_id])).rows[0];
    if(!row)return res.status(404).json({error:'Request not found.'});
    if(status(row)!=='approved')return res.json(mapRequest(row));
    const args=[row.pet_id,row.source_clinic_id];
    const pet=(await db.query(`SELECT name,species,breed,sex,birth_date,color,metadata->>'allergies' AS allergies,metadata->>'weight' AS weight FROM pets WHERE id=$1 AND clinic_id=$2`,args)).rows[0];
    const vaccinations=(await db.query(`SELECT vaccine_name,date_given,next_due,status,verified FROM vaccinations WHERE pet_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false ORDER BY date_given DESC`,args)).rows;
    const diagnoses=(await db.query(`SELECT diagnosis,case_classification,clinical_status,recorded_at FROM patient_diagnoses WHERE pet_id=$1 AND clinic_id=$2 AND record_status='finalized' ORDER BY recorded_at DESC`,args)).rows;
    const consultations=(await db.query(`SELECT started_at,completed_at,notes FROM consultations WHERE pet_id=$1 AND clinic_id=$2 AND status='completed' ORDER BY completed_at DESC`,args)).rows.map(r=>({date:r.completed_at||r.started_at,...Object.fromEntries(['chiefComplaint','clinicalFindings','diagnosis','diagnosisStatus','treatment','outcome','medications','vaccinations','followUpDate','followUpInstructions'].filter(k=>r.notes?.[k]).map(k=>[k,r.notes[k]]))}));
    const treatments=(await db.query(`SELECT diagnosis,procedure,outcome,status,performed_at,follow_up_instructions FROM treatment_records WHERE pet_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false ORDER BY performed_at DESC`,args)).rows;
    const medications=(await db.query(`SELECT medication,dosage,route,frequency,status,instructions,issued_at FROM prescriptions WHERE pet_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false ORDER BY issued_at DESC`,args)).rows;
    // Recheck after reads so a revoked or expired grant cannot return newly fetched history.
    const active=(await db.query(`SELECT id FROM pet_sharing_requests WHERE id=$1 AND status='approved' AND access_expires_at>now()`,[row.id])).rows.length;
    if(!active)return res.status(403).json({error:'Owner access has expired or was revoked.'});
    await audit(db,req,row.id,'view_pet_history');
    res.json({...mapRequest(row),history:{pet,consultations,vaccinations,diagnoses,treatments,medications}});
  }catch(error){next(error);}
};
