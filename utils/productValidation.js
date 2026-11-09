const compact=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
exports.speciesError=(name,species)=>{
  const dog=/\b(canine|dog)\b/i.test(name),cat=/\b(feline|cat)\b/i.test(name);
  const kind=String(species||'').toLowerCase();
  if(dog&&!cat&&!['dog','canine'].includes(kind))return 'This canine service cannot be used for this patient species.';
  if(cat&&!dog&&!['cat','feline'].includes(kind))return 'This feline service cannot be used for this patient species.';
  return null;
};
exports.stickerError=(text,batch)=>{
  const normalized=compact(text);
  if(!normalized||!normalized.includes(compact(batch.batch_number)))return 'The sticker batch number must match the selected inventory batch.';
  if(!normalized.includes(compact(batch.product_name)))return 'The sticker product name must match the selected inventory product.';
  const dates=[...String(text).matchAll(/\b(20\d{2})[-/.](\d{2})[-/.](\d{2})\b/g)].map(match=>`${match[1]}-${match[2]}-${match[3]}`);
  if(!dates.length)return 'The sticker expiry date could not be read. Upload a clearer label with YYYY-MM-DD expiry.';
  if(!dates.includes(batch.expiry))return 'The sticker expiry date does not match the inventory batch. Check the label and inventory record.';
  if(dates.some(date=>date!==batch.expiry))return 'The sticker contains a conflicting date. Review the physical label and upload an unambiguous expiry label.';
  return null;
};
exports.service=async(client,appointment,clinic)=>{
  let id=Number(appointment.notes?.service_catalog_item_id);
  if(!id&&appointment.notes?.service_name){const matches=await client.query("SELECT id FROM clinic_billing_catalog WHERE clinic_id=$1 AND lower(name)=lower($2) AND active AND catalog_kind='service' AND replaced_by_source IS NULL",[clinic,appointment.notes.service_name]);if(matches.rows.length===1)id=matches.rows[0].id;}
  if(!id)return {error:'Select an owner-catalog service for this appointment before continuing.'};
  const row=(await client.query("SELECT * FROM clinic_billing_catalog WHERE id=$1 AND clinic_id=$2 AND active AND catalog_kind='service' AND replaced_by_source IS NULL",[id,clinic])).rows[0];
  if(!row)return {error:'The selected service is unavailable in this clinic.'};
  const pet=(await client.query('SELECT species FROM pets WHERE id=$1 AND clinic_id=$2',[appointment.pet_id,clinic])).rows[0];
  const error=exports.speciesError(row.name,pet?.species);if(error)return {error};
  const category=appointment.notes?.service_category||appointment.workflow_type;
  if(category&&!require('../controllers/catalogConnections').categoriesFor(row).includes(category))return {error:'The selected service does not match this appointment type.'};
  return {service:row};
};
exports.batch=async(client,service,batch,clinic)=>{
  if(!batch)return 'Choose a saved inventory batch linked to this vaccination service.';
  const rows=await client.query(`SELECT i.id FROM clinic_service_inventory_links l JOIN clinic_inventory_items i
    ON i.id=l.inventory_item_id AND i.clinic_id=l.clinic_id WHERE l.clinic_id=$1 AND l.catalog_item_id=$2
    AND i.vaccine_batch_id=$3 AND i.active`,[clinic,service.id,batch.id]);
  return rows.rows.length?null:'Wrong vaccine product: this inventory batch is not linked to the selected service.';
};
exports.savedVaccination=async(client,record,clinic)=>{
  const appointment=(await client.query('SELECT * FROM appointments WHERE id=$1 AND clinic_id=$2',[record.appointment_id,clinic])).rows[0];
  if(!appointment)return 'The vaccination must belong to a valid clinic appointment.';
  const selected=await exports.service(client,appointment,clinic);if(selected.error)return selected.error;
  const batch=(await client.query("SELECT *,TO_CHAR(expiry_date,'YYYY-MM-DD') AS expiry FROM clinic_vaccine_batches WHERE clinic_id=$1 AND batch_number=$2 AND product_name=$3 AND active",[clinic,record.batch_number,record.vaccine_name])).rows;
  if(batch.length!==1)return 'The vaccination product and batch must match a saved inventory batch.';
  const mismatch=await exports.batch(client,selected.service,batch[0],clinic);if(mismatch)return mismatch;
  const attachment=(await client.query('SELECT metadata FROM attachments WHERE id=$1 AND clinic_id=$2',[record.sticker_attachment_id,clinic])).rows[0];
  return exports.stickerError(attachment?.metadata?.ocr_text,batch[0]);
};
