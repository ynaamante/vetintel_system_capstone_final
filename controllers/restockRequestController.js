const db=require('../config/db');
const {profile,has}=require('../utils/rolePermissions');
const {publish}=require('../utils/clinicEvents');
exports.ensureSchema=()=>db.query(require('fs').readFileSync(require('path').join(__dirname,'../scripts/restock_requests_schema.sql'),'utf8'));
const rowsSql=`SELECT r.*,i.sku,i.name AS item,i.unit,COALESCE(v.quantity,i.quantity) AS stock,i.reorder_level,
 i.category,i.manufacturer,i.expiry_date,u.name AS requested_by_name,role.name AS requested_by_role,reviewer.name AS reviewed_by_name,
 CASE WHEN COALESCE(v.quantity,i.quantity)=0 THEN 'Out of Stock'
 WHEN i.reorder_level>0 AND COALESCE(v.quantity,i.quantity)<=GREATEST(i.reorder_level/2,1) THEN 'Critical Stock'
 WHEN COALESCE(v.quantity,i.quantity)<=i.reorder_level THEN 'Low Stock' ELSE 'In Stock' END AS stock_status
 FROM clinic_restock_requests r JOIN clinic_inventory_items i ON i.id=r.inventory_item_id AND i.clinic_id=r.clinic_id
 LEFT JOIN clinic_vaccine_batches v ON v.id=i.vaccine_batch_id AND v.clinic_id=r.clinic_id
 JOIN users u ON u.id=r.requested_by JOIN roles role ON role.id=u.role_id LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by`;
exports.list=async(req,res,next)=>{
 try{
  const clinic=Number(req.user?.clinic_id),role=profile(req.user?.role);
  if(!['owner','doctor'].includes(role)||!Number.isInteger(clinic)||clinic<1||!(has(req.user,'View Inventory')||(role==='owner'&&has(req.user,'View Clinic Overview'))))return res.status(403).json({error:'Clinic inventory access required.'});
  const result=await db.query(rowsSql+` WHERE r.clinic_id=$1 AND ($2::int IS NULL OR r.requested_by=$2)
   AND ($3::boolean OR r.status IN ('pending','approved')) ORDER BY r.created_at DESC,r.id DESC`,[clinic,role==='owner'?null:req.user.id,req.query.include_closed==='true']);
  return res.json(result.rows);
 }catch(error){return next(error);}
};
exports.create=async(req,res,next)=>{
 const clinic=Number(req.user?.clinic_id),quantity=Number(req.body.quantity),item=Number(req.body.inventory_item_id),notes=req.body.notes??'';
 const urgency=req.body.urgency??'normal';
 if(!['normal','urgent'].includes(urgency))return res.status(422).json({error:'Choose Normal or Urgent urgency.'});
 if(profile(req.user?.role)!=='doctor'||!has(req.user,'Request Restock'))return res.status(403).json({error:'Doctor restock-request permission required.'});
 if(!Number.isInteger(quantity)||quantity<1||quantity>100000||!Number.isInteger(item)||item<1||typeof notes!=='string'||notes.length>250)return res.status(422).json({error:'Enter a positive whole-number quantity; notes must be at most 250 characters.'});
 const client=await db.pool.connect();
 try{
  await client.query('BEGIN');
  const inventory=(await client.query('SELECT id FROM clinic_inventory_items WHERE id=$1 AND clinic_id=$2 AND active FOR SHARE',[item,clinic])).rows[0];
  if(!inventory){await client.query('ROLLBACK');return res.status(404).json({error:'Inventory item not found in your clinic.'});}
  const row=(await client.query(`INSERT INTO clinic_restock_requests(clinic_id,inventory_item_id,requested_by,quantity,notes,urgency)
   VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(clinic_id,inventory_item_id,requested_by) WHERE status IN ('pending','approved') DO NOTHING RETURNING *`,[clinic,item,req.user.id,quantity,notes.trim(),urgency])).rows[0];
  if(!row){await client.query('ROLLBACK');return res.status(409).json({error:'You already have an open request for this item.'});}
  await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) VALUES($1,'request_restock','clinic_restock_requests',$2,$3::jsonb)`,[req.user.id,row.id,JSON.stringify(row)]);
  await client.query('COMMIT');publish(clinic,'inventory');return res.status(201).json(row);
 }catch(error){await client.query('ROLLBACK');return next(error);}finally{client.release();}
};
exports.review=async(req,res,next)=>{
 const clinic=Number(req.user?.clinic_id),status=req.body.status,notes=req.body.review_notes??'';
 if(profile(req.user?.role)!=='owner'||!has(req.user,'Restock Inventory'))return res.status(403).json({error:'Clinic owner restock-management permission required.'});
 if(!['approved','fulfilled','rejected'].includes(status)||typeof notes!=='string'||notes.length>1000||(status==='rejected'&&!notes.trim()))return res.status(422).json({error:'Choose a valid decision. Rejections require a reason of at most 1000 characters.'});
 const client=await db.pool.connect();
 try{
  await client.query('BEGIN');
  const before=(await client.query('SELECT * FROM clinic_restock_requests WHERE id=$1 AND clinic_id=$2 FOR UPDATE',[Number(req.params.id),clinic])).rows[0];
  if(!before){await client.query('ROLLBACK');return res.status(404).json({error:'Request not found in your clinic.'});}
  if(!['pending','approved'].includes(before.status)){await client.query('ROLLBACK');return res.status(409).json({error:'This request is already closed.'});}
  const row=(await client.query('UPDATE clinic_restock_requests SET status=$1,review_notes=$2,reviewed_by=$3,updated_at=now() WHERE id=$4 AND clinic_id=$5 RETURNING *',[status,notes.trim(),req.user.id,before.id,clinic])).rows[0];
  await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,old_data,new_data) VALUES($1,'review_restock','clinic_restock_requests',$2,$3::jsonb,$4::jsonb)`,[req.user.id,row.id,JSON.stringify(before),JSON.stringify(row)]);
  await client.query('COMMIT');publish(clinic,'inventory');return res.json(row);
 }catch(error){await client.query('ROLLBACK');return next(error);}finally{client.release();}
};
