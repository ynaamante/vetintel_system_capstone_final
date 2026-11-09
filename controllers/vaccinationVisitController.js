const validation=require('../utils/productValidation');
const db=require('../config/db');
const {publish}=require('../utils/clinicEvents');
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
function proofInput(proof){
  if(!proof)return null;
  const type=String(proof.content_type||'').toLowerCase(),filename=String(proof.filename||'').trim().replace(/[\\/\r\n]/g,'_').slice(0,255),data=String(proof.data||'');
  const prefix=`data:${type};base64,`,encoded=data.slice(prefix.length);
  if(!filename||!['image/png','image/jpeg','image/webp','application/pdf'].includes(type)||!data.startsWith(prefix)||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new Error('Choose a PNG, JPEG, WEBP, or PDF proof file.');
  const bytes=Buffer.from(encoded,'base64');if(!bytes.length||bytes.length>5*1024*1024)throw new Error('The proof file must be 5 MB or smaller.');
  const valid=type==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  if(!valid)throw new Error('The sticker file does not match its image type.');return{filename,type,data};
}
exports.save=async(req,res,next)=>{
  const clinic=Number(req.user?.clinic_id),id=Number(req.params.id),role=String(req.user?.role||'').toLowerCase().replace(/[\s-]+/g,'_');
  if(!['doctor','assistant_doctor','veterinarian'].includes(role))return res.status(403).json({error:'Veterinarian access is required.'});
  if(!Number.isInteger(clinic)||clinic<1||!Number.isInteger(id)||id<1)return res.status(400).json({error:'Invalid appointment.'});
  const confirm=req.body.action==='record_vaccination';
  let proof;try{proof=proofInput(req.body.proof);}catch(e){return res.status(422).json({error:e.message});}
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const fail=async(message,status=409)=>{await client.query('ROLLBACK');return res.status(status).json({error:message});};
    const a=(await client.query(`SELECT * FROM appointments WHERE id=$1 AND clinic_id=$2 FOR UPDATE`,[id,clinic])).rows[0];
    if(!a)return await fail('Appointment not found.',404);
    if(a.practitioner_id&&Number(a.practitioner_id)!==Number(req.user.id))return await fail('This visit is assigned to another veterinarian.',403);
    if(['cancelled','no_show','rescheduled','completed'].includes(a.status))return await fail('This visit is closed for vaccination changes.');
    if(!/vaccin|rabies/i.test(a.reason||'')&&String(a.notes?.service_category||'').toLowerCase()!=='vaccination')return await fail('This is not a vaccination visit.');
    const selectedService=await validation.service(client,a,clinic);
    if(selectedService.error)return await fail(selectedService.error,422);
    if(selectedService.service.item_type!=='vaccination')return await fail('Choose a vaccination service.',422);
    const existing=(await client.query(`SELECT * FROM vaccinations WHERE appointment_id=$1 AND clinic_id=$2 AND COALESCE(archived,false)=false ORDER BY id LIMIT 1 FOR UPDATE`,[id,clinic])).rows[0];
    if(existing&&existing.status!=='scheduled')return await fail('Administration is already recorded. Verify the existing record instead of recording it again.');
    let batch;
    if(req.body.inventory_batch_id){batch=(await client.query(`SELECT *,TO_CHAR(expiry_date,'YYYY-MM-DD') AS expiry FROM clinic_vaccine_batches WHERE id=$1 AND clinic_id=$2 AND active=true FOR UPDATE`,[Number(req.body.inventory_batch_id),clinic])).rows[0];if(!batch)return await fail('Inventory batch not found in this clinic.',422);}
    else if(req.body.batch_number&&req.body.manufacturer&&validDate(String(req.body.expiry_date||''))){
      const matches=await client.query(`SELECT *,TO_CHAR(expiry_date,'YYYY-MM-DD') AS expiry FROM clinic_vaccine_batches WHERE clinic_id=$1 AND active=true AND lower(batch_number)=lower($2) AND lower(manufacturer)=lower($3) AND expiry_date=$4 FOR UPDATE`,[clinic,String(req.body.batch_number).trim(),String(req.body.manufacturer).trim(),req.body.expiry_date]);
      if(matches.rows.length===1)batch=matches.rows[0];
    }
    if(batch){const mismatch=await validation.batch(client,selectedService.service,batch,clinic);if(mismatch)return await fail(mismatch,422);}
    const manufacturer=String(batch?.manufacturer||req.body.manufacturer||'').trim();
    const lot=String(batch?.batch_number||req.body.batch_number||'').trim();
    const expiry=String(batch?.expiry||req.body.expiry_date||'');
    const dose=String(req.body.dose||'').trim(),route=String(req.body.route||''),nextDue=String(req.body.next_due||'');
    if(nextDue&&!validDate(nextDue))return await fail('Choose a valid next-due date.',422);
    if(expiry&&!validDate(expiry))return await fail('Choose a valid expiry date.',422);
    if(confirm){
      const mismatch=await validation.batch(client,selectedService.service,batch,clinic);if(mismatch)return await fail(mismatch,422);
      let stickerText=String(req.body.proof?.ocr_text||'');
      if(!proof&&existing?.sticker_attachment_id){const attachment=(await client.query('SELECT metadata FROM attachments WHERE id=$1 AND clinic_id=$2',[existing.sticker_attachment_id,clinic])).rows[0];stickerText=attachment?.metadata?.ocr_text||'';}
      const stickerMismatch=validation.stickerError(stickerText,batch);if(stickerMismatch)return await fail(stickerMismatch,422);
      const co=(await client.query(`SELECT status FROM consultations WHERE appointment_id=$1 AND clinic_id=$2 FOR UPDATE`,[id,clinic])).rows[0];
      if(co?.status!=='in_progress')return await fail('Start consultation before confirming administration.');
      if(!manufacturer||!lot||!validDate(expiry)||!dose||!['Subcutaneous','Intramuscular','Intranasal','Oral'].includes(route)||!validDate(nextDue))return await fail('Complete manufacturer, batch number, expiry date, dose, route, and next due.',422);
      if(req.body.details_confirmed!==true||req.body.proof_confirmed!==true)return await fail('Confirm the recorded vaccination details and sticker proof.',422);
      if(!proof&&!existing?.sticker_attachment_id)return await fail('Upload the vaccine sticker before confirming administration.',422);
      if(batch&&batch.quantity<1)return await fail('This vaccine batch has no stock remaining.');
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      if(expiry<today)return await fail('This vaccine batch has expired.');
    }
    const details=a.notes?.vaccination_details||{};
    const name=batch?.product_name||req.body.vaccine_name||a.notes?.vaccination_type||a.reason;
    let v=existing;
    if(!v)v=(await client.query(`INSERT INTO vaccinations(clinic_id,pet_id,appointment_id,vaccine_name,date_given,status) VALUES($1,$2,$3,$4,$5::timestamptz::date,'scheduled') RETURNING *`,[clinic,a.pet_id,id,name,a.start_time])).rows[0];
    let stickerId=v.sticker_attachment_id;
    if(proof)stickerId=(await client.query(`INSERT INTO attachments(clinic_id,owner_table,owner_id,filename,content_type,url,metadata) VALUES($1,'vaccinations',$2,$3,$4,$5,$6::jsonb) RETURNING id`,[clinic,v.id,proof.filename,proof.type,proof.data,JSON.stringify({source:'vaccination_sticker',uploaded_by:req.user.id,ocr_text:String(req.body.proof?.ocr_text||'').slice(0,20000)})])).rows[0].id;
    const draft={inventory_batch_id:batch?.id||null,manufacturer,batch_number:lot,expiry_date:expiry,dose,route,next_due:nextDue,sticker_attachment_id:stickerId,details_confirmed:req.body.details_confirmed===true,proof_confirmed:req.body.proof_confirmed===true};
    await client.query(`UPDATE appointments SET notes=COALESCE(notes,'{}'::jsonb)||jsonb_build_object('vaccination_draft',$1::jsonb),updated_at=now() WHERE id=$2 AND clinic_id=$3`,[JSON.stringify(draft),id,clinic]);
    await client.query(`UPDATE vaccinations SET vaccine_name=$1,manufacturer=$2,batch_number=$3,expiry_date=$4,dose=$5,next_due=$6,sticker_attachment_id=$7,verified=false,
      verified_by=NULL,verified_at=NULL,verification_reason=NULL,status=$8,date_given=CASE WHEN $8='administered' THEN CURRENT_DATE ELSE date_given END,administered_by=$9
      WHERE id=$10 AND clinic_id=$11`,[name,manufacturer||details.manufacturer||null,lot||details.lot_number||null,expiry||details.expiry_date||null,dose||null,nextDue||null,stickerId,confirm?'administered':'scheduled',req.user.id,v.id,clinic]);
    if(confirm&&batch)await client.query(`UPDATE clinic_vaccine_batches SET quantity=quantity-1,updated_at=now() WHERE id=$1 AND clinic_id=$2`,[batch.id,clinic]);
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) VALUES($1,$2,'vaccinations',$3,$4::jsonb)`,[req.user.id,confirm?'confirm_administration':'save_vaccination_draft',v.id,JSON.stringify({...draft,status:confirm?'administered':'scheduled'})]);
    await client.query('COMMIT');publish(clinic,'vaccination');return res.json({id:v.id,status:confirm?'administered':'scheduled',sticker_attachment_id:stickerId});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});next(e);}finally{client.release();}
};
