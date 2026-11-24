const db = require('../config/db');
const { has } = require('../utils/rolePermissions');
const monitoring = require('../services/diseaseMonitoring');

const reject = (status, message) => Object.assign(new Error(message), { status });
const activeClinics = `
  SELECT c.id,c.name FROM clinics c
  WHERE c.id<>$1 AND NOT COALESCE(c.archived,false)
    AND NOT COALESCE((c.metadata->>'archived')::boolean,false)
    AND lower(COALESCE(c.metadata->>'status','active'))='active'
    AND EXISTS (SELECT 1 FROM pets p WHERE p.clinic_id=c.id AND NOT COALESCE((p.metadata->>'archived')::boolean,false))`;
const owners = `
  SELECT DISTINCT ON (lower(trim(c.email))) c.id,lower(trim(c.email)) AS email
  FROM clients c JOIN clinics cl ON cl.id=c.clinic_id
  WHERE c.clinic_id=$1 AND lower(trim(cl.metadata->>'surveillance_area'))=lower($2)
    AND NOT COALESCE((c.metadata->>'archived')::boolean,false)
    AND EXISTS (SELECT 1 FROM users u WHERE lower(trim(u.email))=lower(trim(c.email))
      AND u.metadata->>'account_type'='pet_owner' AND u.email_verified_at IS NOT NULL AND u.is_active IS NOT FALSE)
    AND EXISTS (SELECT 1 FROM pets p WHERE p.clinic_id=c.clinic_id AND p.client_id=c.id
      AND NOT COALESCE((p.metadata->>'archived')::boolean,false))
  ORDER BY lower(trim(c.email)),c.id`;

async function currentSignal(req) {
  if (!req.user?.id || !req.user.clinic_id || !has(req.user,'Alert Clinics')) throw reject(403,'Clinic alert permission is required.');
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw reject(400,'Invalid signal ID.');
  const { alerts } = await monitoring.read(req.user,{days:30});
  const signal = alerts.find(row=>row.id===id && row.automatic);
  if (!signal) throw reject(404,'This signal is no longer part of the latest detected increase.');
  if (signal.status!=='under_review') throw reject(409,'Start reviewing the signal before sending an advisory.');
  return signal;
}

function messages(signal) {
  return {
    clinic: `Reports of ${signal.disease} rose in ${signal.area} during ${signal.period_start} to ${signal.period_end}, compared with the preceding reporting week. Review local trends and follow your clinic’s reporting procedures. This signal does not confirm an outbreak.`,
    owners: `Your clinic is monitoring reports of ${signal.disease} in ${signal.area}. Contact your veterinary clinic if your pet seems unwell or you have questions about prevention.`,
  };
}

async function recipients(client, clinicId, signal, canNotifyOwners) {
  const clinics=(await client.query(`
    SELECT c.id,c.name,(d.alert_id IS NOT NULL) AS sent
    FROM (${activeClinics}) c LEFT JOIN disease_alert_deliveries d ON d.alert_id=$2 AND d.clinic_id=c.id AND d.audience='clinic'
    ORDER BY c.name`,[clinicId,signal.id])).rows;
  const ownerAudience=canNotifyOwners ? (await client.query(`
    SELECT (SELECT count(*)::int FROM (${owners}) o) AS count,
      EXISTS(SELECT 1 FROM disease_alert_deliveries WHERE alert_id=$3 AND clinic_id=$1 AND audience='owners') AS sent`,
    [clinicId,signal.area,signal.id])).rows[0] : null;
  return {clinics,owners:ownerAudience};
}

exports.preview=async(req,res,next)=>{
  try {
    const signal=await currentSignal(req);
    res.setHeader('Cache-Control','no-store');
    res.json({...await recipients(db,req.user.clinic_id,signal,has(req.user,'Send Notifications')),messages:messages(signal),comparison:{observed:signal.observed_cases,baseline:signal.baseline_cases}});
  } catch(error) {
    if(error.status)return res.status(error.status).json({error:error.message});
    next(error);
  }
};

exports.send=async(req,res,next)=>{
  try {
    const {clinicIds=[],notifyOwners=false,comparison}=req.body||{};
    if(!Array.isArray(clinicIds)||clinicIds.length>100||clinicIds.some(id=>!Number.isSafeInteger(id)||id<1)||
       typeof notifyOwners!=='boolean'||(!clinicIds.length&&!notifyOwners))throw reject(400,'Select a valid alert audience.');
    if(notifyOwners&&!has(req.user,'Send Notifications'))throw reject(403,'Pet owner notification permission is required.');
    const signal=await currentSignal(req);
    if(comparison?.observed!==signal.observed_cases||comparison?.baseline!==signal.baseline_cases)throw reject(409,'The counts changed after preview. Cancel and reopen the advisory to review the latest counts.');
    const clinicId=req.user.clinic_id;
    const text=messages(signal);
    const client=await db.pool.connect();
    try {
      await client.query('BEGIN');
      const locked=(await client.query(
        'SELECT status,snapshot FROM disease_monitoring_alerts WHERE id=$1 AND clinic_id=$2 FOR UPDATE',[signal.id,clinicId]
      )).rows[0];
      if(locked?.status!=='under_review'||locked.snapshot.observed_cases!==signal.observed_cases||
         locked.snapshot.baseline_cases!==signal.baseline_cases)throw reject(409,'The signal changed. Reopen it to review the latest counts.');
      const available=await recipients(client,clinicId,signal,notifyOwners);
      if(clinicIds.some(id=>!available.clinics.some(clinic=>clinic.id===id)))throw reject(422,'A selected clinic is no longer eligible.');
      const eligible=available.clinics.filter(clinic=>clinicIds.includes(clinic.id)&&!clinic.sent).map(clinic=>clinic.id);
      let clinicsSent=0,ownersSent=0;
      if(eligible.length){
        const delivered=await client.query(`
          WITH sent AS (
            INSERT INTO clinic_notifications(clinic_id,recipient_user_id,title,text)
            SELECT u.clinic_id,u.id,$2,$3 FROM users u JOIN roles r ON r.id=u.role_id
            WHERE u.clinic_id=ANY($1::int[]) AND u.is_active IS NOT FALSE
              AND (u.email_verification_required IS NOT TRUE OR u.email_verified_at IS NOT NULL)
              AND lower(regexp_replace(trim(r.name),'[[:space:]-]+','_','g')) IN ('owner','clinic_owner','doctor','assistant_doctor','veterinarian')
            RETURNING clinic_id
          )
          INSERT INTO disease_alert_deliveries(alert_id,clinic_id,audience,sent_by)
          SELECT DISTINCT $4::int,clinic_id,'clinic',$5::int FROM sent RETURNING clinic_id`,
          [eligible,`Disease advisory: ${signal.disease}`,text.clinic,signal.id,req.user.id]);
        clinicsSent=delivered.rowCount;
      }
      if(notifyOwners&&!available.owners.sent&&available.owners.count){
        const sent=await client.query(`
          INSERT INTO clinic_owner_notifications(clinic_id,client_id,recipient_email,title,message,type,severity)
          SELECT $1,o.id,o.email,$3,$4,'disease_advisory','moderate' FROM (${owners}) o`,
          [clinicId,signal.area,`Pet health advisory: ${signal.disease}`,text.owners]);
        ownersSent=sent.rowCount;
        if(ownersSent)await client.query(
          "INSERT INTO disease_alert_deliveries(alert_id,clinic_id,audience,sent_by) VALUES($1,$2,'owners',$3)",
          [signal.id,clinicId,req.user.id]);
      }
      await client.query('COMMIT');
      res.json({clinicsSent,ownersSent});
    } catch(error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  } catch(error) {
    if(error.status)return res.status(error.status).json({error:error.message});
    next(error);
  }
};
