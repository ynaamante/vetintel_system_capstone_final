const db=require('../config/db');
const {publish}=require('../utils/clinicEvents');
const normalize=role=>String(role||'').toLowerCase().replace(/[\s-]+/g,'_');
exports.categoriesFor=item=>{
  if(item.catalog_kind==='product')return [];
  const category=item.category;
  if(category==='Consultation'||item.item_type==='consultation'){
    if(/follow[- ]?up/i.test(item.name))return ['Follow-up'];
    if(/general consultation|emergency consultation|medical certificate/i.test(item.name))return ['General'];
    return ['Check-up'];
  }
  if(['Vaccination','Treatment','Laboratory','Surgery','Dental','Confinement','Grooming','General','Check-up','Follow-up'].includes(category))return [category];
  return [{vaccination:'Vaccination',lab_test:'Laboratory',inpatient:'Confinement',treatment:'Treatment'}[item.item_type]||'General'];
};
const durationDefaults=require('../data/appointmentDurationDefaults.json');
exports.defaultDuration=item=>String(durationDefaults[exports.categoriesFor(item)[0]]||30)+' minutes';
exports.ensureSchema=()=>db.query(`ALTER TABLE clinic_billing_catalog ADD COLUMN IF NOT EXISTS inventory_notes TEXT;
CREATE TABLE IF NOT EXISTS clinic_service_inventory_links(
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),catalog_item_id INTEGER NOT NULL REFERENCES clinic_billing_catalog(id),
  inventory_item_id INTEGER NOT NULL REFERENCES clinic_inventory_items(id),
  PRIMARY KEY(clinic_id,catalog_item_id,inventory_item_id))`);
exports.enrich=async(rows,clinic)=>{
  const stock=await db.query(`SELECT l.catalog_item_id,i.id,i.sku,i.name,i.category,i.unit,i.active,i.vaccine_batch_id,
    COALESCE(v.quantity,i.quantity) AS quantity,(i.category='Equipment & assets') AS is_equipment,TO_CHAR(i.expiry_date,'YYYY-MM-DD') AS expiry_date
    FROM clinic_service_inventory_links l JOIN clinic_inventory_items i ON i.id=l.inventory_item_id AND i.clinic_id=l.clinic_id
    LEFT JOIN clinic_vaccine_batches v ON v.id=i.vaccine_batch_id AND v.clinic_id=i.clinic_id WHERE l.clinic_id=$1 ORDER BY i.sku`,[clinic]);
  return rows.map(row=>({...row,duration:row.catalog_kind==='product'?row.duration:(row.duration||exports.defaultDuration(row)),appointment_categories:exports.categoriesFor(row),inventory_links:stock.rows.filter(item=>String(item.catalog_item_id)===String(row.id))}));
};
exports.update=async(req,res,next)=>{
  const clinic=Number(req.user?.clinic_id),id=Number(req.params.id);
  if(!['owner','clinic_owner'].includes(normalize(req.user?.role))||!Number.isInteger(clinic)||clinic<1)return res.status(403).json({error:'Clinic owner access required.'});
  const ids=req.body.inventory_item_ids;
  const notes=req.body.inventory_notes;
  if(notes!==undefined&&(typeof notes!=='string'||notes.length>2000))return res.status(422).json({error:'Inventory notes must be at most 2000 characters.'});
  if(!Number.isInteger(id)||id<1||!Array.isArray(ids)||ids.length>205||ids.some(value=>!Number.isInteger(value)||value<1)||new Set(ids).size!==ids.length)return res.status(422).json({error:'Select valid inventory items.'});
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const service=await client.query("SELECT id FROM clinic_billing_catalog WHERE id=$1 AND clinic_id=$2 AND catalog_kind='service' AND replaced_by_source IS NULL FOR UPDATE",[id,clinic]);
    if(!service.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Service not found.'});}
    const items=await client.query('SELECT id FROM clinic_inventory_items WHERE clinic_id=$1 AND id=ANY($2::int[]) AND active',[clinic,ids]);
    if(items.rows.length!==ids.length){await client.query('ROLLBACK');return res.status(422).json({error:'Select active inventory belonging to this clinic.'});}
    if(notes!==undefined)await client.query('UPDATE clinic_billing_catalog SET inventory_notes=$1,updated_at=now() WHERE id=$2 AND clinic_id=$3',[notes.trim()||null,id,clinic]);
    await client.query('DELETE FROM clinic_service_inventory_links WHERE clinic_id=$1 AND catalog_item_id=$2',[clinic,id]);
    await client.query('INSERT INTO clinic_service_inventory_links(clinic_id,catalog_item_id,inventory_item_id) SELECT $1,$2,unnest($3::int[])',[clinic,id,ids]);
    await client.query("INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) VALUES($1,'link_service_inventory','clinic_billing_catalog',$2,$3::jsonb)",[req.user.id,id,JSON.stringify({inventory_item_ids:ids})]);
    await client.query('COMMIT');publish(clinic,'catalog');res.json({catalog_item_id:id,inventory_item_ids:ids});
  }catch(error){await client.query('ROLLBACK').catch(()=>{});next(error);}finally{client.release();}
};
