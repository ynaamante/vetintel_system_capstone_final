const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/db');
const sql = fs.readFileSync(path.join(__dirname, '../scripts/confirmed_surveillance_summary.sql'), 'utf8');
const roles = new Set(['doctor','assistant_doctor','veterinarian','owner','clinic_owner','super_admin']);
exports.catalog = async (req,res,next) => {
  try {
    const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g,'_');
    if (!roles.has(role)) return res.status(403).json({error:'Clinical staff access required.'});
    return res.json((await db.query('SELECT id,name FROM monitored_diseases WHERE active ORDER BY name')).rows);
  } catch(error) { return next(error); }
};

exports.summary = async (req,res,next) => {
  try {
    const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g,'_');
    if (!roles.has(role)) return res.status(403).json({error:'Disease Intelligence access required.'});
    const ownClinic = Number(req.user?.clinic_id);
    if (role !== 'super_admin' && (!Number.isInteger(ownClinic) || ownClinic<1)) return res.status(400).json({error:'Your account is not assigned to a clinic.'});
    const days = Number(req.query.days ?? 30);
    if (![30,60,90].includes(days)) return res.status(400).json({error:'Choose a 30, 60, or 90 day reporting period.'});
    const clinic = req.query.clinic_id == null ? null : Number(req.query.clinic_id);
    if (clinic !== null && (!Number.isInteger(clinic) || clinic<1)) return res.status(400).json({error:'Choose a valid reporting clinic.'});
    if (role !== 'super_admin') {
      const member = await db.query(`SELECT id FROM clinics WHERE id=$1 AND NOT COALESCE(archived,false)
        AND NOT COALESCE((metadata->>'archived')::boolean,false) AND lower(COALESCE(metadata->>'status','active'))='active'`,[ownClinic]);
      if (!member.rows.length) return res.status(403).json({error:'An active participating clinic is required.'});
    }
    // Configurable upward only: deployed configurations cannot disable suppression.
    const configured = Number(process.env.SURVEILLANCE_MIN_COUNT);
    const minimumCount = Number.isInteger(configured) && configured>=3 ? configured : 3;
    const result = await db.query(sql,[days,clinic,req.query.disease || null,minimumCount,Number.isInteger(ownClinic) ? ownClinic : null]);
    res.setHeader?.('Cache-Control','no-store');
    const monitoring=await require('../services/diseaseMonitoring').read(req.user,req.query);
    return res.json({...result.rows[0],...monitoring, privacy: {
      minimum_count: minimumCount, period_granularity:'month', visibility_scope:'own_clinic_and_protected_network',
      ...monitoring.privacy,
    }});
  } catch(error) {
    // No copied contribution can get out of sync: retry reads the committed source.
    console.error('Disease Intelligence aggregation failed', {code:error.code || 'UNKNOWN'});
    return next(error);
  }
};

exports.monitoring=async(req,res,next)=>{try{const {has}=require('../utils/rolePermissions');if(!has(req.user,'View Disease Monitoring')&&!has(req.user,'View Risk Monitoring'))return res.status(403).json({error:'Disease or Risk Monitoring permission required.'});if(req.path.endsWith('/monitoring-export')&&!has(req.user,'Export Reports'))return res.status(403).json({error:'Export Reports permission required.'});res.setHeader('Cache-Control','no-store');return res.json(await require('../services/diseaseMonitoring').read(req.user,req.query));}catch(error){if(error.status)return res.status(error.status).json({error:error.message});return next(error);}};
exports.saveRule=async(req,res,next)=>{
 const {profile,has}=require('../utils/rolePermissions');
 if(profile(req.user.role)!=='owner'||!has(req.user,'Configure Alert Rules'))return res.status(403).json({error:'Owner alert-rule configuration permission required.'});
 const {disease_key,area='*',threshold,growth_percent=null}=req.body;
 if(typeof disease_key!=='string'||typeof area!=='string'||!area.trim()||area.length>150||!Number.isInteger(threshold)||threshold<1||threshold>100000||(growth_percent!==null&&(!Number.isInteger(growth_percent)||growth_percent<1||growth_percent>10000)))return res.status(422).json({error:'Choose a disease, area, positive weekly threshold and optional positive growth percentage.'});
 try{const catalog=await db.query('SELECT id FROM monitored_diseases WHERE id=$1 AND active',[disease_key]);if(!catalog.rows.length)return res.status(422).json({error:'Choose an active monitored disease.'});
 const row=(await db.query(`WITH saved AS (INSERT INTO disease_alert_rules(clinic_id,disease_key,area,threshold,growth_percent,updated_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(clinic_id,disease_key,area) DO UPDATE SET threshold=EXCLUDED.threshold,growth_percent=EXCLUDED.growth_percent,active=true,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING *), logged AS (INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) SELECT $6,'configure_disease_alert_rule','disease_alert_rules',id,to_jsonb(saved) FROM saved RETURNING id) SELECT saved.* FROM saved CROSS JOIN logged`,[req.user.clinic_id,disease_key,area.trim(),threshold,growth_percent,req.user.id])).rows[0];return res.json(row);
 }catch(error){return next(error);}
};
exports.reviewAlert=async(req,res,next)=>{
 const {has}=require('../utils/rolePermissions');if(!has(req.user,'Review Disease Alerts'))return res.status(403).json({error:'Alert review permission required.'});
 const {status,review_notes,expected_status}=req.body;if(!['under_review','resolved'].includes(status)||(review_notes!==undefined&&(typeof review_notes!=='string'||review_notes.length>1000))||(expected_status!==undefined&&!['new','under_review','resolved'].includes(expected_status)))return res.status(422).json({error:'Choose Under Review or Resolved and notes up to 1000 characters.'});
 try{
  // Visibility is re-evaluated before review: removed/private source cases cannot
  // be recovered by guessing an old alert id.
  const visible=await require('../services/diseaseMonitoring').read(req.user,{days:90});
  if(!visible.alerts.some(a=>a.id===Number(req.params.id)))return res.status(404).json({error:'Alert is no longer visible in your clinic.'});
  const client=await db.pool.connect();try{await client.query('BEGIN');const before=(await client.query('SELECT * FROM disease_monitoring_alerts WHERE id=$1 AND clinic_id=$2 FOR UPDATE',[req.params.id,req.user.clinic_id])).rows[0];if(!before){await client.query('ROLLBACK');return res.status(404).json({error:'Alert not found.'});}
  if(expected_status!==undefined&&before.status!==expected_status){await client.query('ROLLBACK');return res.status(409).json({error:'This signal changed during review. Close and reopen it to load the latest status.'});}
  if(before.status==='resolved'||(before.status==='new'&&status!=='under_review')){await client.query('ROLLBACK');return res.status(409).json({error:before.status==='resolved'?'Resolved signals are read-only. View Review History for prior actions.':'Start Review before resolving a signal.'});}
  const row=(await client.query('UPDATE disease_monitoring_alerts SET status=$1,review_notes=$2,reviewed_by=COALESCE(reviewed_by,$3),updated_at=now() WHERE id=$4 AND clinic_id=$5 RETURNING id,status,review_notes,reviewed_by,updated_at,(SELECT name FROM users WHERE users.id=disease_monitoring_alerts.reviewed_by) AS reviewed_by_name',[status,(review_notes??before.review_notes??'').trim(),req.user.id,before.id,req.user.clinic_id])).rows[0];await client.query("INSERT INTO audit_trail(user_id,action,table_name,record_id,old_data,new_data) VALUES($1,'review_disease_alert','disease_monitoring_alerts',$2,$3::jsonb,$4::jsonb)",[req.user.id,row.id,JSON.stringify({clinic_id:req.user.clinic_id,status:before.status,review_notes:before.review_notes}),JSON.stringify({...row,clinic_id:req.user.clinic_id})]);await client.query('COMMIT');return res.json(row);
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }catch(error){return next(error);}
};
exports.alertHistory=async(req,res,next)=>{
 try {
  const {has}=require('../utils/rolePermissions');
  if(!has(req.user,'View Risk Monitoring')&&!has(req.user,'View Disease Monitoring'))return res.status(403).json({error:'Disease or Risk Monitoring permission required.'});
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Choose a valid signal.'});
  const visible=await require('../services/diseaseMonitoring').read(req.user,{days:90});
  if(!visible.alerts.some(row=>row.id===id))return res.status(404).json({error:'Signal is no longer visible in your clinic.'});
  const history=(await db.query(`SELECT a.id,a.created_at,u.name AS reviewer,
   a.old_data->>'status' AS previous_status,a.new_data->>'status' AS status,
   a.new_data->>'review_notes' AS review_notes
   FROM audit_trail a LEFT JOIN users u ON u.id=a.user_id
   WHERE a.table_name='disease_monitoring_alerts' AND a.action='review_disease_alert'
    AND a.record_id=$1 AND a.new_data->>'clinic_id'=$2
   ORDER BY a.created_at DESC,a.id DESC`,[id,String(req.user.clinic_id)])).rows;
  res.setHeader?.('Cache-Control','no-store');
  return res.json({history});
 }catch(error){return next(error);}
};
