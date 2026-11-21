const crypto=require('crypto');
const bcrypt=require('bcryptjs');
const db=require('../config/db');
const mailer=require('../utils/mailer');
exports.ensureSchema=()=>db.query(require('fs').readFileSync(require('path').join(__dirname,'../scripts/owner_password_reset_schema.sql'),'utf8'));
const normalize=email=>String(email||'').trim().toLowerCase();
const digest=(id,code)=>crypto.createHmac('sha256',process.env.AUTH_SECRET).update(`password-reset:${id}:${code}`).digest('hex');
const ownerQuery=`SELECT u.* FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE lower(trim(u.email))=$1 AND u.is_active IS NOT FALSE
  AND COALESCE(lower(replace(replace(r.name,' ','_'),'-','_')),'user') IN ('user','pet_owner')`;
const notice={message:'If this email belongs to a pet-owner account, a reset code will be sent. Check your email.',retry_after:60};
exports.request=async(req,res,next)=>{
  const email=normalize(req.body.email);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(422).json({error:'Enter a valid email address.'});
  let client,user,code,hash;
  try {
    client=await db.pool.connect();await client.query('BEGIN');
    user=(await client.query(`${ownerQuery} FOR UPDATE OF u`,[email])).rows[0];
    if(!user){await client.query('ROLLBACK');return res.json(notice);}
    const existing=(await client.query('SELECT * FROM owner_password_resets WHERE user_id=$1 FOR UPDATE',[user.id])).rows[0];
    const withinWindow=existing&&Date.now()-new Date(existing.window_started_at).getTime()<3600000;
    if(existing?.sent_at&&Date.now()-new Date(existing.sent_at).getTime()<60000 || withinWindow&&existing.send_count>=5){await client.query('ROLLBACK');return res.json(notice);}
    code=String(crypto.randomInt(100000,1000000));hash=digest(user.id,code);
    await client.query(`INSERT INTO owner_password_resets(user_id,code_hash,expires_at,attempts,sent_at,send_count,window_started_at)
      VALUES($1,$2,now()+interval '10 minutes',0,now(),$3,$4) ON CONFLICT(user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,
      expires_at=EXCLUDED.expires_at,attempts=0,sent_at=now(),send_count=EXCLUDED.send_count,window_started_at=EXCLUDED.window_started_at`,
      [user.id,hash,withinWindow?existing.send_count+1:1,withinWindow?existing.window_started_at:new Date()]);
    await client.query('COMMIT');
  }catch(error){if(client)await client.query('ROLLBACK');return next(error);}finally{if(client)client.release();}
  try {
    const delivered=await mailer.sendPasswordResetCode({email:user.email,code});
    if(!delivered.sent){await db.query('UPDATE owner_password_resets SET sent_at=NULL WHERE user_id=$1 AND code_hash=$2',[user.id,hash]);console.warn('[Password reset] Email delivery unavailable.');}
    return res.json(notice);
  }catch(error){await db.query('UPDATE owner_password_resets SET sent_at=NULL WHERE user_id=$1 AND code_hash=$2',[user.id,hash]);return next(error);}
};
const completeReset=async(req,res,next,verifyOnly=false)=>{
  const email=normalize(req.body.email),code=String(req.body.code||''),password=req.body.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\d{6}$/.test(code))return res.status(422).json({error:'Enter your email and the six-digit reset code.'});
  if(!verifyOnly&&(typeof password!=='string'||password.length<8||password.length>72))return res.status(422).json({error:'Use a new password with 8–72 characters.'});
  let client;
  try {
    client=await db.pool.connect();await client.query('BEGIN');
    const user=(await client.query(`${ownerQuery} FOR UPDATE OF u`,[email])).rows[0];
    const fail=async(message,status=400)=>{await client.query('ROLLBACK');return res.status(status).json({error:message});};
    if(!user)return await fail('Invalid or expired reset code. Request a new code.');
    const stored=(await client.query('SELECT * FROM owner_password_resets WHERE user_id=$1 FOR UPDATE',[user.id])).rows[0];
    if(!stored||new Date(stored.expires_at)<=new Date())return await fail('Invalid or expired reset code. Request a new code.');
    if(stored.attempts>=5)return await fail('Too many incorrect attempts. Request a new code.',429);
    const actual=Buffer.from(digest(user.id,code),'hex'),expected=Buffer.from(stored.code_hash,'hex');
    if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected)){
      await client.query('UPDATE owner_password_resets SET attempts=attempts+1 WHERE user_id=$1',[user.id]);await client.query('COMMIT');
      return res.status(400).json({error:'The reset code is incorrect.'});
    }
    if(verifyOnly){await client.query('COMMIT');return res.json({message:'Code verified. Enter your new password.'});}
    const passwordHash=await bcrypt.hash(password,10);
    await client.query('UPDATE users SET password_hash=$2,password_reset_at=clock_timestamp(),must_change_password=false,updated_at=now() WHERE id=$1',[user.id,passwordHash]);
    await client.query('DELETE FROM owner_password_resets WHERE user_id=$1',[user.id]);
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) VALUES($1,'owner_password_reset','users',$1,'{"via":"email_reset_code"}'::jsonb)`,[user.id]);
    await client.query('COMMIT');res.json({message:'Password updated. Sign in with your new password.'});
  }catch(error){if(client)await client.query('ROLLBACK');next(error);}finally{if(client)client.release();}
};
exports.verify=(req,res,next)=>completeReset(req,res,next,true);
exports.reset=(req,res,next)=>completeReset(req,res,next);
