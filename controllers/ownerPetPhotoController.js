const db = require('../config/db');
const { publish } = require('../utils/clinicEvents');

function image(body) {
  const data = typeof body?.data === 'string' ? body.data : '';
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if (!match) throw Object.assign(new Error('Choose a JPEG, PNG, or WEBP photo.'), { status: 422 });
  if (match[2].length > 1398104) throw Object.assign(new Error('Photo must be 1 MB or smaller.'), { status: 413 });
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 1048576) throw Object.assign(new Error('Photo must be 1 MB or smaller.'), { status: 413 });
  const valid = match[1] === 'image/jpeg' ? bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : match[1] === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!valid) throw Object.assign(new Error('This file is not a valid photo.'), { status: 422 });
  return { data, contentType: match[1], filename: `pet-photo.${match[1].split('/')[1]}` };
}
const upload = clinic => async (req, res, next) => {
  if (!req.user?.id || !['', 'user', 'pet_owner'].includes(req.user.role || '')) return res.status(403).json({ error: 'Pet-owner account required.' });
  const id = Number(req.params.id), email = String(req.user.email || '').trim().toLowerCase();
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid pet ID.' });
  let client;
  try {
    const photo = image(req.body);
    client = await db.pool.connect(); await client.query('BEGIN');
    const pet = (await client.query(clinic ? `SELECT p.id,p.clinic_id FROM pets p
      JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id JOIN clinics cl ON cl.id=p.clinic_id
      WHERE p.id=$1 AND lower(trim(c.email))=$2 AND COALESCE((p.metadata->>'archived')::boolean,false)=false
        AND COALESCE(cl.archived,false)=false FOR UPDATE OF p`
      : 'SELECT id FROM pet_owner_pets WHERE id=$1 AND owner_id=$2 FOR UPDATE', [id,clinic ? email : req.user.id])).rows[0];
    if (!pet) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pet not found in your account.' }); }
    if (clinic) {
      const existing = (await client.query(`SELECT id FROM attachments WHERE clinic_id=$1 AND owner_table='pets' AND owner_id=$2
        AND metadata->>'source'='pet_profile_photo' ORDER BY uploaded_at DESC,id DESC LIMIT 1`, [pet.clinic_id,id])).rows[0];
      const metadata = JSON.stringify({ source: 'pet_profile_photo', uploaded_by: req.user.id });
      if (existing) await client.query(`UPDATE attachments SET filename=$1,content_type=$2,url=$3,metadata=$4::jsonb,uploaded_at=now() WHERE id=$5 AND clinic_id=$6`, [photo.filename,photo.contentType,photo.data,metadata,existing.id,pet.clinic_id]);
      else await client.query(`INSERT INTO attachments(clinic_id,owner_table,owner_id,filename,content_type,url,metadata) VALUES($1,'pets',$2,$3,$4,$5,$6::jsonb)`, [pet.clinic_id,id,photo.filename,photo.contentType,photo.data,metadata]);
    } else await client.query('UPDATE pet_owner_pets SET photo_url=$1 WHERE id=$2 AND owner_id=$3', [photo.data,id,req.user.id]);
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) VALUES($1,'owner_photo_upload',$2,$3,$4::jsonb)`, [req.user.id,clinic ? 'pets' : 'pet_owner_pets',id,JSON.stringify({ source: 'pet_owner_mobile', content_type: photo.contentType })]);
    await client.query('COMMIT'); if (clinic) publish(pet.clinic_id,'pets');
    res.status(201).json({ photo_url: photo.data });
  } catch (error) { if (client) await client.query('ROLLBACK'); if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
  finally { if (client) client.release(); }
};
exports.personal = upload(false);
exports.clinic = upload(true);
