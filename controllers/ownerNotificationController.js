const db=require('../config/db');
function emailFor(req,res){const email=String(req.user?.email||'').trim().toLowerCase();if(!email){res.status(403).json({error:'Sign in with your registered pet owner email.'});return null;}return email;}
const ownership=`LOWER(TRIM(n.recipient_email))=$1 AND EXISTS(SELECT 1 FROM clients c WHERE c.id=n.client_id AND c.clinic_id=n.clinic_id AND LOWER(TRIM(c.email))=$1)`;
const map=row=>({id:String(row.id),title:row.title,message:row.message,type:row.type,severity:row.severity,date:row.created_at,read:Boolean(row.read_at),received:Boolean(row.received_at),petId:row.pet_id,clinicName:row.clinic_name});
exports.list=async(req,res,next)=>{
  const email=emailFor(req,res);if(!email)return;
  try{const result=await db.query(`SELECT n.*,cl.name AS clinic_name FROM clinic_owner_notifications n JOIN clinics cl ON cl.id=n.clinic_id
    WHERE ${ownership} ORDER BY n.created_at DESC,n.id DESC LIMIT 100`,[email]);res.json(result.rows.map(map));}catch(error){next(error);}
};
exports.acknowledge=async(req,res,next)=>{
  const email=emailFor(req,res);if(!email)return;
  const ids=req.body.ids;if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>!/^\d+$/.test(String(id))))return res.status(400).json({error:'Choose valid notification IDs.'});
  try{await db.query(`WITH received AS(UPDATE clinic_owner_notifications n SET received_at=COALESCE(n.received_at,now())
    WHERE ${ownership} AND n.id=ANY($2::bigint[]) RETURNING delivery_id)
    UPDATE clinic_reminder_deliveries SET status='delivered' WHERE id IN(SELECT delivery_id FROM received) AND channel='in_app' AND status='sent'`,[email,ids]);res.json({success:true});}catch(error){next(error);}
};
exports.markRead=async(req,res,next)=>{
  const email=emailFor(req,res);if(!email)return;
  const all=req.params.id===undefined;
  if(!all&&!/^\d+$/.test(req.params.id))return res.status(400).json({error:'Invalid notification.'});
  try{const result=await db.query(`WITH updated AS(UPDATE clinic_owner_notifications n
    SET read_at=COALESCE(n.read_at,now()),received_at=COALESCE(n.received_at,now())
    WHERE ${ownership} ${all?'':'AND n.id=$2::bigint'} RETURNING n.id,n.delivery_id), delivered AS(
      UPDATE clinic_reminder_deliveries SET status='delivered' WHERE id IN(SELECT delivery_id FROM updated) AND channel='in_app' AND status='sent' RETURNING id)
    SELECT id FROM updated`,all?[email]:[email,req.params.id]);
    if(!all&&!result.rows.length)return res.status(404).json({error:'Notification not found.'});res.json({success:true,ids:result.rows.map(row=>String(row.id))});
  }catch(error){next(error);}
};
