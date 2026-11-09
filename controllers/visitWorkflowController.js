const db = require('../config/db');
const { publish } = require('../utils/clinicEvents');
const doctorRoles = new Set(['doctor','assistant_doctor','veterinarian']);
function scope(req, res) {
  const role = String(req.user?.role || '').toLowerCase().replace(/[\s-]+/g,'_');
  const clinic = Number(req.user?.clinic_id), id = Number(req.params.id);
  if (!doctorRoles.has(role)) { res.status(403).json({ error:'Veterinarian access is required.' }); return null; }
  if (!Number.isInteger(clinic) || clinic < 1 || !Number.isInteger(id) || id < 1) { res.status(400).json({error:'Invalid clinic or appointment.'}); return null; }
  return [id,clinic];
}
async function audit(client, req, id, action, data) {
  await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) VALUES($1,$2,'appointments',$3,$4::jsonb)`,
    [req.user.id,action,id,JSON.stringify({...data,_audit:{role:req.user.role}})]);
}
exports.get = async (req,res,next) => {
  const params=scope(req,res); if(!params) return;
  try {
    const result=await db.query(`SELECT a.id,a.pet_id,a.practitioner_id,a.start_time,a.reason,a.status,a.notes,
      p.name AS pet,p.species,p.breed,p.birth_date,(SELECT photo.id FROM attachments photo WHERE photo.clinic_id=a.clinic_id AND photo.owner_table='pets' AND photo.owner_id=p.id AND photo.metadata->>'source'='pet_profile_photo' ORDER BY photo.id DESC LIMIT 1) AS photo_attachment_id,c.name AS owner,u.name AS veterinarian,co.id AS consultation_id,co.status AS consultation_status,
      co.started_at,co.completed_at,co.notes AS consultation_notes
      FROM appointments a JOIN pets p ON p.id=a.pet_id LEFT JOIN clients c ON c.id=a.client_id
      LEFT JOIN users u ON u.id=a.practitioner_id LEFT JOIN consultations co ON co.appointment_id=a.id AND co.clinic_id=a.clinic_id
      WHERE a.id=$1 AND a.clinic_id=$2`,params);
    if(!result.rows.length) return res.status(404).json({error:'Appointment not found.'});
    const [vaccines,catalog,invoices,history]=await Promise.all([
      db.query(`SELECT id,vaccine_name,status,verified,date_given,verified_at,manufacturer,batch_number,TO_CHAR(expiry_date,'YYYY-MM-DD') AS expiry_date,dose,TO_CHAR(next_due,'YYYY-MM-DD') AS next_due,sticker_attachment_id FROM vaccinations WHERE appointment_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false ORDER BY id`,params),
      db.query(`SELECT id,name,item_type,category,catalog_kind,inventory_notes,unit_price FROM clinic_billing_catalog WHERE clinic_id=$1 AND active=true AND unit_price IS NOT NULL AND replaced_by_source IS NULL ORDER BY name`,[params[1]]),
      db.query(`SELECT id,status,total,metadata FROM invoices WHERE appointment_id=$1 AND clinic_id=$2 AND status<>'void' ORDER BY id`,params),
      db.query(`SELECT t.id,t.action,t.created_at,u.name AS actor FROM audit_trail t LEFT JOIN users u ON u.id=t.user_id WHERE (t.table_name='appointments' AND t.record_id=$1) OR (t.table_name='vaccinations' AND t.record_id IN (SELECT id FROM vaccinations WHERE appointment_id=$1 AND clinic_id=$2)) ORDER BY t.created_at DESC,t.id DESC`,params),
    ]);
    return res.json({visit:result.rows[0],vaccinations:vaccines.rows,catalog:await require('./catalogConnections').enrich(catalog.rows,params[1]),invoices:invoices.rows,history:history.rows});
  } catch(error){next(error);}
};
exports.act = async(req,res,next)=>{
  const params=scope(req,res);if(!params)return;
  let action=req.body.action;
  if(action==='administer'){req.body={...req.body,action:'record_vaccination'};return require('./vaccinationVisitController').save(req,res,next);}
  if(['save_vaccination_draft','record_vaccination'].includes(action))return require('./vaccinationVisitController').save(req,res,next);
  if(!['start','end','administer','complete_service'].includes(action))return res.status(422).json({error:'Invalid visit action.'});
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const fail=async(message,code=409)=>{await client.query('ROLLBACK');return res.status(code).json({error:message});};
    const row=await client.query(`SELECT * FROM appointments WHERE id=$1 AND clinic_id=$2 FOR UPDATE`,params);
    const appointment=row.rows[0];if(!appointment)return await fail('Appointment not found.',404);
    if(appointment.practitioner_id && Number(appointment.practitioner_id)!==Number(req.user.id))return await fail('This appointment is assigned to another veterinarian.',403);
    let consultation=(await client.query(`SELECT * FROM consultations WHERE appointment_id=$1 AND clinic_id=$2 FOR UPDATE`,params)).rows[0];
    if(action==='start'){
      const checked=await require('../utils/productValidation').service(client,appointment,params[1]);if(checked.error)return await fail(checked.error,422);
      if(!['scheduled','checked_in','in_consultation'].includes(appointment.status))return await fail('This appointment cannot start consultation from its current status.');
      if(consultation?.status==='completed')return await fail('This consultation has already ended.');
      consultation=(await client.query(`INSERT INTO consultations(clinic_id,appointment_id,pet_id,doctor_id,status)
        VALUES($1,$2,$3,$4,'in_progress') ON CONFLICT(appointment_id) DO UPDATE SET updated_at=now() RETURNING *`,
        [params[1],params[0],appointment.pet_id,req.user.id])).rows[0];
      await client.query(`UPDATE appointments SET status='in_consultation',practitioner_id=COALESCE(practitioner_id,$3),updated_at=now() WHERE id=$1 AND clinic_id=$2`,[...params,req.user.id]);
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[params[1]]);
      const queue=await client.query(`UPDATE patient_queue SET status='in_consultation',updated_at=now() WHERE appointment_id=$1 AND clinic_id=$2 RETURNING id`,params);
      if(!queue.rows.length) await client.query(`INSERT INTO patient_queue(clinic_id,appointment_id,pet_id,position,status)
        SELECT $1,$2,$3,COALESCE(MAX(position),0)+1,'in_consultation' FROM patient_queue WHERE clinic_id=$1`,[params[1],params[0],appointment.pet_id]);
    }else{
      if(!consultation)return await fail('Start the consultation first.');
      if(action==='end'){
        if(consultation.status!=='in_progress')return await fail('Only an active consultation can be ended.');
        if(/vaccin|rabies/i.test(appointment.reason||'')){
          const vaccines=await client.query(`SELECT status,verified FROM vaccinations WHERE appointment_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false FOR SHARE`,params);
          if(!vaccines.rows.length||vaccines.rows.some(v=>v.status==='scheduled'||!v.verified))return await fail('Administer and verify the visit vaccinations before ending this consultation.');
        }
        const checked=await require('../utils/productValidation').service(client,appointment,params[1]);if(checked.error)return await fail(checked.error,422);
        const recorded=(await client.query('SELECT * FROM vaccinations WHERE appointment_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false',params)).rows;
        for(const vaccine of recorded){const mismatch=await require('../utils/productValidation').savedVaccination(client,vaccine,params[1]);if(mismatch)return await fail(mismatch,422);}
        await client.query(`UPDATE consultations SET status='completed',completed_at=now(),completed_by=$3,updated_at=now() WHERE appointment_id=$1 AND clinic_id=$2`,[...params,req.user.id]);
        await client.query(`UPDATE appointments SET status='completed',updated_at=now() WHERE id=$1 AND clinic_id=$2`,params);
        await client.query(`UPDATE patient_queue SET status='completed',updated_at=now() WHERE appointment_id=$1 AND clinic_id=$2`,params);
      }else{
        if(consultation.status!=='completed')return await fail('End the consultation before confirming service completion.');
        const existing=await client.query(`SELECT id FROM invoices WHERE appointment_id=$1 AND clinic_id=$2 AND status<>'void' FOR UPDATE`,params);
        if(existing.rows.length){await client.query('COMMIT');return res.json({invoice_id:existing.rows[0].id,already_completed:true});}
        const checked=await require('../utils/productValidation').service(client,appointment,params[1]);if(checked.error)return await fail(checked.error,422);
        const catalogId=Number(req.body.catalog_item_id);
        if(catalogId!==checked.service.id)return await fail('The billed service must match the booked appointment service.',422);
        const catalog=await client.query(`SELECT id,name,item_type,unit_price FROM clinic_billing_catalog WHERE id=$1 AND clinic_id=$2 AND active=true AND unit_price IS NOT NULL AND replaced_by_source IS NULL FOR SHARE`,[catalogId,params[1]]);
        const service=catalog.rows[0];if(!service)return await fail('Select an active service from the clinic price catalog.',422);
        const vaccines=await client.query(`SELECT status,verified FROM vaccinations WHERE appointment_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false FOR SHARE`,params);
        const vaccinationVisit=service.item_type==='vaccination'||/vaccin|rabies/i.test(appointment.reason||'');
        if(/vaccin|rabies/i.test(appointment.reason||'') && service.item_type!=='vaccination')return await fail('Choose the vaccination service from the clinic price catalog.',422);
        if(vaccinationVisit && (!vaccines.rows.length||vaccines.rows.some(v=>v.status==='scheduled'||!v.verified)))return await fail('Administer and verify every vaccination for this visit before billing.');
        if(!appointment.client_id)return await fail('The appointment must have an owner before billing.',422);
        const invoice=(await client.query(`INSERT INTO invoices(clinic_id,client_id,appointment_id,consultation_id,status,currency,subtotal,tax,total,issued_at,metadata)
          VALUES($1,$2,$3,$4,'issued','PHP',$5,0,$5,now(),$6::jsonb) RETURNING id`,
          [params[1],appointment.client_id,params[0],consultation.id,service.unit_price,JSON.stringify({sent_to_reception:true,sent_to_reception_by:req.user.id,sent_to_reception_at:new Date().toISOString(),service_completed:true})])).rows[0];
        await client.query(`INSERT INTO invoice_items(invoice_id,description,unit_price,quantity,catalog_item_id,item_type) VALUES($1,$2,$3,1,$4,$5)`,[invoice.id,service.name,service.unit_price,service.id,service.item_type]);
        await audit(client,req,params[0],'confirm_service_completed',{status:'completed',invoice_id:invoice.id,catalog_item_id:service.id});
        await client.query('COMMIT');publish(params[1],'billing');return res.json({invoice_id:invoice.id});
      }
    }
    await audit(client,req,params[0],{start:'start_consultation',end:'end_consultation',administer:'administer_vaccination'}[action],{status:action==='end'?'completed':'in_consultation'});
    await client.query('COMMIT');publish(params[1],action);return res.json({id:params[0],action});
  }catch(error){await client.query('ROLLBACK').catch(()=>{});next(error);}finally{client.release();}
};
