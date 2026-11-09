const db=require('../config/db');
const {publish}=require('../utils/clinicEvents');
const dataset=require('../data/importedInventory205.json');
const ownerRoles=new Set(['owner','clinic_owner','super_admin']);
const normalize=value=>String(value||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
function scope(req,res,write=false){const clinic=Number(req.user?.clinic_id),role=normalize(req.user?.role);if(!Number.isInteger(clinic)||clinic<1||!(write?ownerRoles:new Set([...ownerRoles,'doctor','assistant_doctor','veterinarian','receptionist'])).has(role)){res.status(403).json({error:write?'Clinic owner access is required.':'Clinic staff access is required.'});return null;}return clinic;}
exports.ensureSchema=()=>db.query(`
  ALTER TABLE clinic_billing_catalog ALTER COLUMN unit_price DROP NOT NULL;
  ALTER TABLE clinic_billing_catalog ADD COLUMN IF NOT EXISTS source_key TEXT;
  ALTER TABLE clinic_billing_catalog ADD COLUMN IF NOT EXISTS source_sku TEXT;
  ALTER TABLE clinic_billing_catalog ADD COLUMN IF NOT EXISTS catalog_kind TEXT NOT NULL DEFAULT 'service';
  ALTER TABLE clinic_billing_catalog ADD COLUMN IF NOT EXISTS replaced_by_source TEXT;
  ALTER TABLE clinic_billing_catalog DROP CONSTRAINT IF EXISTS clinic_billing_catalog_item_type_check;
  ALTER TABLE clinic_billing_catalog ADD CONSTRAINT clinic_billing_catalog_item_type_check CHECK(item_type IN('consultation','treatment','medication','vaccination','lab_test','inpatient','product'));
  ALTER TABLE clinic_vaccine_batches ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
  CREATE TABLE IF NOT EXISTS clinic_inventory_items(
    id SERIAL PRIMARY KEY,clinic_id INTEGER NOT NULL REFERENCES clinics(id),sku TEXT NOT NULL,name TEXT NOT NULL,
    category TEXT NOT NULL,manufacturer TEXT,supplier TEXT,batch_number TEXT,expiry_date DATE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity>=0),unit TEXT NOT NULL,reorder_level INTEGER NOT NULL DEFAULT 0 CHECK(reorder_level>=0),
    catalog_item_id INTEGER REFERENCES clinic_billing_catalog(id),vaccine_batch_id INTEGER REFERENCES clinic_vaccine_batches(id),
    active BOOLEAN NOT NULL DEFAULT true,is_mock BOOLEAN NOT NULL DEFAULT false,source_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(clinic_id,sku));
  CREATE TABLE IF NOT EXISTS clinic_inventory_imports(clinic_id INTEGER NOT NULL REFERENCES clinics(id),source_key TEXT NOT NULL,
    filename TEXT NOT NULL,item_count INTEGER NOT NULL,backup_data JSONB NOT NULL,imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(clinic_id,source_key));
`);
exports.list=async(req,res,next)=>{const clinic=scope(req,res);if(!clinic)return;try{
  const rows=await db.query(`SELECT i.*,TO_CHAR(i.expiry_date,'YYYY-MM-DD') AS expiry_date,COALESCE(v.quantity,i.quantity) AS quantity,c.unit_price,
    (c.unit_price IS NOT NULL) AS price_configured FROM clinic_inventory_items i
    LEFT JOIN clinic_vaccine_batches v ON v.id=i.vaccine_batch_id AND v.clinic_id=i.clinic_id
    LEFT JOIN clinic_billing_catalog c ON c.id=i.catalog_item_id AND c.clinic_id=i.clinic_id
    WHERE i.clinic_id=$1 AND ($2::boolean OR i.active) ORDER BY i.sku`,[clinic,req.query.include_inactive==='true']);
  res.json(rows.rows);
}catch(e){next(e);}};
exports.update=async(req,res,next)=>{const clinic=scope(req,res,true);if(!clinic)return;const id=Number(req.params.id),body=req.body;
  if(!Number.isInteger(id)||id<1||!Number.isInteger(Number(body.quantity))||Number(body.quantity)<0||!Number.isInteger(Number(body.reorder_level))||Number(body.reorder_level)<0||!String(body.name||'').trim()||!String(body.unit||'').trim())return res.status(422).json({error:'Enter a name, unit, and non-negative whole-number stock and reorder level.'});
  const client=await db.pool.connect();try{await client.query('BEGIN');const current=(await client.query('SELECT * FROM clinic_inventory_items WHERE id=$1 AND clinic_id=$2 FOR UPDATE',[id,clinic])).rows[0];if(!current){await client.query('ROLLBACK');return res.status(404).json({error:'Inventory item not found.'});}
    const result=(await client.query(`UPDATE clinic_inventory_items SET name=$1,manufacturer=$2,supplier=$3,batch_number=$4,expiry_date=$5,quantity=$6,unit=$7,reorder_level=$8,active=$9,updated_at=now() WHERE id=$10 AND clinic_id=$11 RETURNING *`,[String(body.name).trim(),body.manufacturer||null,body.supplier||null,body.batch_number||null,body.expiry_date||null,Number(body.quantity),String(body.unit).trim(),Number(body.reorder_level),body.active!==false,id,clinic])).rows[0];
    if(current.catalog_item_id)await client.query('UPDATE clinic_billing_catalog SET name=$1,unit=$2,active=$3,updated_at=now() WHERE id=$4 AND clinic_id=$5',[result.name,result.unit,result.active,current.catalog_item_id,clinic]);
    if(current.vaccine_batch_id)await client.query(`UPDATE clinic_vaccine_batches SET product_name=$1,manufacturer=$2,batch_number=$3,expiry_date=$4,quantity=$5,active=$6,updated_at=now() WHERE id=$7 AND clinic_id=$8`,[result.name,result.manufacturer,result.batch_number,result.expiry_date,result.quantity,result.active,current.vaccine_batch_id,clinic]);
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,old_data,new_data) VALUES($1,'update_inventory','clinic_inventory_items',$2,$3::jsonb,$4::jsonb)`,[req.user.id,id,JSON.stringify(current),JSON.stringify(result)]);
    await client.query('COMMIT');publish(clinic,'inventory');res.json(result);
  }catch(e){await client.query('ROLLBACK').catch(()=>{});if(['23505','23514','22007','22008','23502'].includes(e.code))return res.status(422).json({error:'Check the item details, batch, expiry date, and stock values.'});next(e);}finally{client.release();}
};
exports.replaceFromPdf=async(clinic,actorId=null,clientOverride=null)=>{
  const client=clientOverride||await db.pool.connect(),source=dataset.sha256;
  try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[clinic]);
    const existing=await client.query('SELECT item_count FROM clinic_inventory_imports WHERE clinic_id=$1 AND source_key=$2',[clinic,source]);
    if(existing.rows.length){await client.query('COMMIT');return{imported:0,already_imported:true,total:existing.rows[0].item_count};}
    const [catalog,batches,inventory]=await Promise.all([
      client.query('SELECT * FROM clinic_billing_catalog WHERE clinic_id=$1',[clinic]),client.query('SELECT * FROM clinic_vaccine_batches WHERE clinic_id=$1',[clinic]),client.query('SELECT * FROM clinic_inventory_items WHERE clinic_id=$1',[clinic]),
    ]);
    await client.query(`INSERT INTO clinic_inventory_imports(clinic_id,source_key,filename,item_count,backup_data) VALUES($1,$2,$3,$4,$5::jsonb)`,[clinic,source,dataset.filename,dataset.items.length,JSON.stringify({catalog:catalog.rows,vaccine_batches:batches.rows,inventory:inventory.rows})]);
    await client.query('UPDATE clinic_billing_catalog SET active=false,replaced_by_source=$2,updated_at=now() WHERE clinic_id=$1',[clinic,source]);
    await client.query('UPDATE clinic_inventory_items SET active=false,updated_at=now() WHERE clinic_id=$1',[clinic]);
    await client.query('UPDATE clinic_vaccine_batches SET active=false,updated_at=now() WHERE clinic_id=$1',[clinic]);
    const pharma=new Set(['Antibiotics','Pain & inflammation','Parasite control','Gastrointestinal','Skin, eye & ear','Cardiac & endocrine','Anesthesia & emergency','Fluids & nutrition']);
    for(const item of dataset.items){
      const type=item.category==='Vaccines'?'vaccination':pharma.has(item.category)?'medication':'product';
      const cat=(await client.query(`INSERT INTO clinic_billing_catalog(clinic_id,item_type,category,name,description,unit,unit_price,active,catalog_kind,source_key,source_sku)
        VALUES($1,$2,$3,$4,$5,$6,NULL,true,'product',$7,$8) ON CONFLICT(clinic_id,item_type,name) DO UPDATE SET category=EXCLUDED.category,description=EXCLUDED.description,unit=EXCLUDED.unit,unit_price=NULL,active=true,catalog_kind='product',source_key=EXCLUDED.source_key,source_sku=EXCLUDED.source_sku,replaced_by_source=NULL,updated_at=now() RETURNING id`,[clinic,type,item.category,item.name,`Imported mock inventory · ${item.sku} · ${dataset.filename}. Price not supplied.`,item.unit,source,item.sku])).rows[0];
      let vaccineId=null;
      if(item.category==='Vaccines')vaccineId=(await client.query(`INSERT INTO clinic_vaccine_batches(clinic_id,product_name,manufacturer,batch_number,expiry_date,quantity,catalog_item_id,created_by,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)
        ON CONFLICT(clinic_id,product_name,batch_number) DO UPDATE SET manufacturer=EXCLUDED.manufacturer,expiry_date=EXCLUDED.expiry_date,quantity=EXCLUDED.quantity,catalog_item_id=EXCLUDED.catalog_item_id,active=true,updated_at=now() RETURNING id`,[clinic,item.name,item.manufacturer,item.batch_number,item.expiry_date,item.quantity,cat.id,actorId])).rows[0].id;
      await client.query(`INSERT INTO clinic_inventory_items(clinic_id,sku,name,category,manufacturer,supplier,batch_number,expiry_date,quantity,unit,reorder_level,catalog_item_id,vaccine_batch_id,active,is_mock,source_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,true,$14) ON CONFLICT(clinic_id,sku) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,manufacturer=EXCLUDED.manufacturer,supplier=EXCLUDED.supplier,batch_number=EXCLUDED.batch_number,expiry_date=EXCLUDED.expiry_date,quantity=EXCLUDED.quantity,unit=EXCLUDED.unit,reorder_level=EXCLUDED.reorder_level,catalog_item_id=EXCLUDED.catalog_item_id,vaccine_batch_id=EXCLUDED.vaccine_batch_id,active=true,is_mock=true,source_key=EXCLUDED.source_key,updated_at=now()`,[clinic,item.sku,item.name,item.category,item.manufacturer,item.supplier,item.batch_number,item.expiry_date,item.quantity,item.unit,item.reorder_level,cat.id,vaccineId,source]);
    }
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,new_data) VALUES($1,'replace_inventory_from_pdf','clinic_inventory_imports',$2::jsonb)`,[actorId,JSON.stringify({clinic_id:clinic,filename:dataset.filename,source_key:source,items:205,categories:16,prices_supplied:false})]);
    await client.query('COMMIT');publish(clinic,'inventory');return{imported:205,categories:16,vaccine_batches:10,prices_supplied:false};
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{if(!clientOverride)client.release();}
};
exports.importPdf=async(req,res,next)=>{const clinic=scope(req,res,true);if(!clinic)return;try{res.json(await exports.replaceFromPdf(clinic,req.user.id));}catch(e){next(e);}};
