const db=require('../config/db');
exports.ensureSchema=()=>db.query(`CREATE TABLE IF NOT EXISTS clinic_vaccine_batches(
  id SERIAL PRIMARY KEY,clinic_id INTEGER NOT NULL REFERENCES clinics(id),product_name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,batch_number TEXT NOT NULL,expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity>=0),default_dose TEXT,default_route TEXT,
  catalog_item_id INTEGER REFERENCES clinic_billing_catalog(id),created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id,product_name,batch_number));`);
function scope(req,res){const clinic=Number(req.user?.clinic_id),role=String(req.user?.role||'').toLowerCase().replace(/[\s-]+/g,'_');if(!Number.isInteger(clinic)||clinic<1||!['doctor','assistant_doctor','veterinarian','clinic_owner','owner','receptionist'].includes(role)){res.status(403).json({error:'Clinic staff access required.'});return null;}return clinic;}
exports.list=async(req,res,next)=>{const clinic=scope(req,res);if(!clinic)return;try{const rows=await db.query(`SELECT id,product_name,manufacturer,batch_number,TO_CHAR(expiry_date,'YYYY-MM-DD') AS expiry_date,quantity,default_dose,default_route,catalog_item_id FROM clinic_vaccine_batches WHERE clinic_id=$1 AND active=true ORDER BY product_name,expiry_date`,[clinic]);res.json(rows.rows);}catch(e){next(e);}};
exports.create=async(req,res,next)=>{const clinic=scope(req,res);if(!clinic)return;try{
  if(!['doctor','assistant_doctor','veterinarian','clinic_owner','owner'].includes(String(req.user.role).toLowerCase().replace(/[\s-]+/g,'_')))return res.status(403).json({error:'Clinical staff or clinic owner access required to add vaccine stock.'});
  const b=req.body;const name=String(b.product_name||'').trim(),manufacturer=String(b.manufacturer||'').trim(),batch=String(b.batch_number||'').trim(),quantity=Number(b.quantity);
  const date=String(b.expiry_date||'');
  if(!name||!manufacturer||!batch||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!Number.isInteger(quantity)||quantity<0)return res.status(422).json({error:'Complete the product, manufacturer, batch, valid expiry date, and whole-number quantity.'});
  const rows=await db.query(`INSERT INTO clinic_vaccine_batches(clinic_id,product_name,manufacturer,batch_number,expiry_date,quantity,default_dose,default_route,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[clinic,name,manufacturer,batch,date,quantity,String(b.default_dose||'').trim()||null,String(b.default_route||'').trim()||null,req.user.id]);res.status(201).json(rows.rows[0]);
}catch(e){if(e.code==='23505')return res.status(409).json({error:'This product and batch already exist in inventory.'});next(e);}};
