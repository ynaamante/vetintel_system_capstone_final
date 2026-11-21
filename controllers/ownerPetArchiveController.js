const db = require('../config/db');
exports.ensureSchema = () => db.query(require('fs').readFileSync(require('path').join(__dirname,'../scripts/owner_pet_archives_schema.sql'),'utf8'));
function owner(req,res) {
  if(!req.user?.id || !['','user','pet_owner'].includes(req.user.role || '')) { res.status(403).json({error:'Pet-owner account required.'}); return false; }
  return true;
}
exports.list = async(req,res,next) => {
  if(!owner(req,res))return;
  try {
    const personal=await db.query(`SELECT p.id,p.name,p.species,p.breed,p.photo_url,'account' AS source,NULL::text AS clinic_name,a.archived_at
      FROM owner_pet_archives a JOIN pet_owner_pets p ON p.id=a.pet_id AND p.owner_id=a.owner_id
      WHERE a.owner_id=$1 AND a.source='account'`,[req.user.id]);
    const clinic=await db.query(`SELECT p.id,p.name,p.species,p.breed,'clinic' AS source,cl.name AS clinic_name,a.archived_at,
      (SELECT photo.url FROM attachments photo WHERE photo.clinic_id=p.clinic_id AND photo.owner_table='pets' AND photo.owner_id=p.id
        AND photo.metadata->>'source'='pet_profile_photo' ORDER BY photo.uploaded_at DESC,photo.id DESC LIMIT 1) AS photo_url
      FROM owner_pet_archives a JOIN pets p ON p.id=a.pet_id JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id
      JOIN clinics cl ON cl.id=p.clinic_id WHERE a.owner_id=$1 AND a.source='clinic' AND lower(trim(c.email))=lower(trim($2))
        AND COALESCE((p.metadata->>'archived')::boolean,false)=false AND COALESCE(cl.archived,false)=false`,[req.user.id,req.user.email||'']);
    res.json([...personal.rows,...clinic.rows].sort((a,b)=>new Date(b.archived_at)-new Date(a.archived_at)));
  }catch(error){next(error);}
};
exports.set = async(req,res,next) => {
  if(!owner(req,res))return;
  const {source,archived}=req.body,id=Number(req.body.pet_id);
  if(!['account','clinic'].includes(source)||typeof archived!=='boolean'||!Number.isSafeInteger(id)||id<1)return res.status(422).json({error:'Select a valid pet and archive action.'});
  let client;
  try {
    client=await db.pool.connect();await client.query('BEGIN');
    const pet=(await client.query(source==='account'
      ? 'SELECT id FROM pet_owner_pets WHERE id=$1 AND owner_id=$2 FOR UPDATE'
      : `SELECT p.id FROM pets p JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id JOIN clinics cl ON cl.id=p.clinic_id
        WHERE p.id=$1 AND lower(trim(c.email))=lower(trim($2)) AND COALESCE((p.metadata->>'archived')::boolean,false)=false
          AND COALESCE(cl.archived,false)=false FOR UPDATE OF p`,[id,source==='account'?req.user.id:req.user.email||''])).rows[0];
    if(!pet){await client.query('ROLLBACK');return res.status(404).json({error:'Pet not found in your account.'});}
    if(archived)await client.query(`INSERT INTO owner_pet_archives(owner_id,source,pet_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[req.user.id,source,id]);
    else await client.query('DELETE FROM owner_pet_archives WHERE owner_id=$1 AND source=$2 AND pet_id=$3',[req.user.id,source,id]);
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) VALUES($1,$2,'owner_pet_archives',$3,$4::jsonb)`,
      [req.user.id,archived?'owner_archive_pet':'owner_restore_pet',id,JSON.stringify({source,pet_id:id})]);
    await client.query('COMMIT');res.json({success:true,archived});
  }catch(error){if(client)await client.query('ROLLBACK');next(error);}finally{if(client)client.release();}
};
