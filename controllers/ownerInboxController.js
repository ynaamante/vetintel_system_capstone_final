const db = require('../config/db');
const { publish } = require('../utils/clinicEvents');
const { ownerThread, makeThread } = require('../utils/ownerInbox');
function identity(req, res) {
  const email = String(req.user?.email || '').trim().toLowerCase();
  if (!req.user?.id || !email || !['', 'user', 'pet_owner'].includes(req.user?.role || '')) { res.status(403).json({ error: 'Sign in with a pet-owner account.' }); return null; }
  return email;
}
const ownedPets = `FROM pets p JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id
  JOIN clinics cl ON cl.id=p.clinic_id`;
const ownership = `lower(trim(c.email))=$1 AND COALESCE((p.metadata->>'archived')::boolean,false)=false AND COALESCE(cl.archived,false)=false`;

exports.list = async (req, res, next) => {
  const email = identity(req, res); if (!email) return;
  try {
    const result = await db.query(`SELECT s.value, cl.name AS clinic_name ${ownedPets}
      JOIN settings s ON s.clinic_id=p.clinic_id AND s.key='clinic_inbox:pet-' || p.id::text
      WHERE ${ownership} ORDER BY s.updated_at DESC`, [email]);
    res.json(result.rows.map(row => ownerThread(row.value, row.clinic_name)));
  } catch (error) { next(error); }
};
exports.create = async (req, res, next) => {
  const email = identity(req, res); if (!email) return;
  const petId = Number(req.body.pet_id);
  if (!Number.isSafeInteger(petId) || petId < 1) return res.status(400).json({ error: 'Choose a linked clinic patient.' });
  try {
    const row = (await db.query(`SELECT p.id,p.clinic_id,p.name AS pet,p.species,p.breed,p.sex,p.metadata,c.id AS client_id,c.name,c.phone,cl.name AS clinic_name
      ${ownedPets} WHERE ${ownership} AND p.id=$2`, [email, petId])).rows[0];
    if (!row) return res.status(404).json({ error: 'Linked patient not found.' });
    const thread = makeThread(row);
    const result = await db.query(`INSERT INTO settings (clinic_id,key,value) VALUES ($1,$2,$3::jsonb)
      ON CONFLICT (clinic_id,key) DO UPDATE SET key=EXCLUDED.key RETURNING value`, [row.clinic_id, `clinic_inbox:${thread.id}`, JSON.stringify(thread)]);
    publish(row.clinic_id, 'inbox-updated');
    res.json(ownerThread(result.rows[0].value, row.clinic_name));
  } catch (error) { next(error); }
};
exports.update = async (req, res, next) => {
  const email = identity(req, res); if (!email) return;
  if (!/^pet-\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid conversation.' });
  const text = req.body.text === undefined ? null : req.body.text;
  const attachment = req.body.sharedRecord;
  if (attachment !== undefined && (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)
    || typeof attachment.shareId !== 'string' || typeof attachment.recordId !== 'string'
    || !attachment.shareId || !attachment.recordId || attachment.shareId.length > 200 || attachment.recordId.length > 200
    || Object.keys(attachment).some(key => !['shareId', 'recordId'].includes(key)))) return res.status(400).json({ error: 'Choose a shared record.' });
  if (text !== null && (typeof text !== 'string' || (!text.trim() && !attachment) || text.trim().length > 4000)) return res.status(400).json({ error: 'Enter a message of up to 4000 characters.' });
  if (Object.keys(req.body).some(key => !['text', 'read', 'sharedRecord'].includes(key)) || (req.body.read !== undefined && req.body.read !== true)) return res.status(400).json({ error: 'Invalid conversation update.' });
  if (text === null && !attachment && req.body.read !== true) return res.status(400).json({ error: 'Enter a message or mark this conversation read.' });
  try {
    const pet = (await db.query(`SELECT p.clinic_id,p.metadata,cl.name AS clinic_name ${ownedPets} WHERE ${ownership} AND p.id=$2`, [email, Number(req.params.id.slice(4))])).rows[0];
    if (!pet) return res.status(404).json({ error: 'Conversation not found.' });
    let sharedRecord;
    if (attachment) {
      const shares = Array.isArray(pet.metadata?.owner_shared_records) ? pet.metadata.owner_shared_records : [];
      const share = shares.find(row => row.id === attachment.shareId);
      const record = (Array.isArray(share?.records) ? share.records : []).find(row => String(row.id) === attachment.recordId);
      if (!record) return res.status(404).json({ error: 'Shared record not found for this patient.' });
      sharedRecord = { shareId: share.id, recordId: String(record.id), title: record.title || 'Patient record', type: record.type,
        category: record.category, detail: record.detail || '', date: record.date };
    }
    const time = new Date().toISOString();
    const message = text === null && !sharedRecord ? null : { text: text?.trim() || `Shared record: ${sharedRecord.title}`, time, source: 'Owner', outgoing: false,
      kind: 'reply', visibility: 'owner', author: req.user.name || 'Pet owner', ...(sharedRecord ? { sharedRecord } : {}) };
    const patch = message ? { preview: message.text, time, unread: true, ownerUnread: false, status: 'Open' } : { ownerUnread: false };
    const history = message ? { type: 'Owner message received', time, text: message.text } : null;
    const result = await db.query(`UPDATE settings SET value=value || $3::jsonb ||
      CASE WHEN $4::jsonb IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('messages',COALESCE(value->'messages','[]'::jsonb) || jsonb_build_array($4::jsonb),
      'history',jsonb_build_array($5::jsonb) || COALESCE(value->'history','[]'::jsonb)) END,
      updated_at=now() WHERE clinic_id=$1 AND key=$2 RETURNING value`, [pet.clinic_id, `clinic_inbox:${req.params.id}`, JSON.stringify(patch), message ? JSON.stringify(message) : null, history ? JSON.stringify(history) : null]);
    if (!result.rows.length) return res.status(404).json({ error: 'Conversation not found.' });
    publish(pet.clinic_id, 'inbox-updated');
    res.json(ownerThread(result.rows[0].value, pet.clinic_name));
  } catch (error) { next(error); }
};

exports.archives = async (req, res, next) => {
  if (!identity(req, res)) return;
  try {
    const result = await db.query("SELECT COALESCE(metadata->'inbox_archives','{}'::jsonb) AS archives FROM users WHERE id=$1", [req.user.id]);
    res.json(Object.keys(result.rows[0]?.archives || {}));
  } catch (error) { next(error); }
};
exports.setArchive = async (req, res, next) => {
  if (!identity(req, res)) return;
  const { key, archived } = req.body;
  if (typeof key !== 'string' || key.length > 300 || !/^(thread:pet-\d+|share:[^:]+:.+|notification:.+)$/.test(key) || typeof archived !== 'boolean')
    return res.status(422).json({ error: 'Choose a valid inbox item and archive action.' });
  try {
    await db.query(archived
      ? "UPDATE users SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{inbox_archives}',COALESCE(metadata->'inbox_archives','{}'::jsonb) || jsonb_build_object($2::text,true)) WHERE id=$1"
      : "UPDATE users SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{inbox_archives}',COALESCE(metadata->'inbox_archives','{}'::jsonb) - $2::text) WHERE id=$1",
      [req.user.id, key]);
    res.json({ success: true, key, archived });
  } catch (error) { next(error); }
};
