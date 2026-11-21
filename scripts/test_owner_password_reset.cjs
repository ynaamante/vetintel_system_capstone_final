const assert=require('node:assert/strict'),crypto=require('node:crypto'),bcrypt=require('bcryptjs');
const db=require('../config/db'),mailer=require('../utils/mailer');
const reset=require('../controllers/ownerPasswordResetController'),users=require('../controllers/userController'),auth=require('../middleware/auth');
async function call(handler,body){let status=200,data;await handler({body},{status(code){status=code;return this;},json(value){data=value;return this;}},e=>{throw e;});return{status,data};}
async function allowed(token){let status=200,next=false;await auth.required({headers:{authorization:`Bearer ${token}`}},{status(code){status=code;return this;},json(){return this;}},()=>{next=true;});return{status,next};}
(async()=>{
  await reset.ensureSchema();
  const client=await db.pool.connect(),query=client.query.bind(client),originalQuery=db.query,originalConnect=db.pool.connect,originalSend=mailer.sendPasswordResetCode;
  let code,sends=0,sequence=0;const stack=[];
  try{
    await query('BEGIN');db.query=query;
    db.pool.connect=async()=>({query:(sql,args)=>{if(sql==='BEGIN'){const name=`reset_test_${++sequence}`;stack.push(name);return query(`SAVEPOINT ${name}`);}if(sql==='COMMIT')return query(`RELEASE SAVEPOINT ${stack.pop()}`);if(sql==='ROLLBACK')return query(`ROLLBACK TO SAVEPOINT ${stack.pop()}`);return query(sql,args);},release(){}});
    mailer.sendPasswordResetCode=async data=>{code=data.code;sends++;return{sent:true};};
    const email=`reset-${crypto.randomBytes(8).toString('hex')}@example.invalid`,oldPassword='Old-Test-Password-123',newPassword='New-Test-Password-456';
    const id=(await query(`INSERT INTO users(name,email,password_hash,is_active,email_verification_required,email_verified_at)
      VALUES('Reset Test',$1,$2,true,true,now()) RETURNING id`,[email,await bcrypt.hash(oldPassword,10)])).rows[0].id;
    const previous=await call(users.login,{email,password:oldPassword});assert.equal(previous.status,200);assert.ok(previous.data.token);
    const unknown=await call(reset.request,{email:'unknown-reset@example.invalid'});assert.equal(unknown.status,200);assert.equal(sends,0);
    const requested=await call(reset.request,{email:` ${email.toUpperCase()} `});assert.equal(requested.status,200);assert.equal(sends,1);assert.equal(requested.data.message,unknown.data.message);
    const stored=(await query('SELECT * FROM owner_password_resets WHERE user_id=$1',[id])).rows[0];assert.notEqual(stored.code_hash,code);assert.equal(stored.code_hash.length,64);
    await call(reset.request,{email});assert.equal(sends,1,'Resend cooldown prevents another email.');
    assert.equal((await call(reset.reset,{email,code:'000000',password:newPassword})).status,400);
    assert.equal((await query('SELECT attempts FROM owner_password_resets WHERE user_id=$1',[id])).rows[0].attempts,1);
    assert.equal((await call(reset.reset,{email,code,password:'short'})).status,422);
    await query('UPDATE owner_password_resets SET attempts=5 WHERE user_id=$1',[id]);assert.equal((await call(reset.reset,{email,code,password:newPassword})).status,429);
    await query(`UPDATE owner_password_resets SET attempts=0,expires_at=now()-interval '1 second' WHERE user_id=$1`,[id]);assert.equal((await call(reset.reset,{email,code,password:newPassword})).status,400);
    await query(`UPDATE owner_password_resets SET expires_at=now()+interval '10 minutes' WHERE user_id=$1`,[id]);
    assert.equal((await call(reset.reset,{email,code,password:newPassword})).status,200);
    assert.equal((await allowed(previous.data.token)).status,401,'Password reset invalidates the old session.');
    assert.equal((await call(users.login,{email,password:oldPassword})).status,401);
    const login=await call(users.login,{email,password:newPassword});assert.equal(login.status,200);assert.equal((await allowed(login.data.token)).next,true,'Fresh login works after reset.');
    assert.equal((await call(reset.reset,{email,code,password:newPassword})).status,400,'Code is single-use.');
    assert.ok(await bcrypt.compare(newPassword,(await query('SELECT password_hash FROM users WHERE id=$1',[id])).rows[0].password_hash));
    console.log('PASS: reset-code delivery, generic account response, hashed codes, cooldown, attempt limits, expiry, single use, password update, old-session invalidation, and new login. Fixtures rolled back; no real emails sent.');
  }finally{await query('ROLLBACK');db.query=originalQuery;db.pool.connect=originalConnect;mailer.sendPasswordResetCode=originalSend;client.release();await db.pool.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
