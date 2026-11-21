const assert=require('node:assert/strict');
require('../config/db');
const auth=require('../middleware/auth');
const principals=require('../services/clinicPermissions');
async function check(token) {
  let status=200,body,next=false;
  await auth.required({headers:{authorization:`Bearer ${token}`}},{status(code){status=code;return this;},json(value){body=value;return this;}},()=>{next=true;});
  return {status,body,next};
}
(async()=>{
  const original=principals.loadPrincipal;
  try {
    principals.loadPrincipal=async id=>({id,email:'test@example.invalid',role:'user'});
    const expired=await check(auth.signUserToken({id:1,exp:Date.now()-1000}));
    assert.equal(expired.status,401);assert.equal(expired.body.code,'SESSION_INVALID');assert.equal(expired.next,false);
    const invalid=await check('not-a-valid-session');assert.equal(invalid.status,401);assert.equal(invalid.body.code,'SESSION_INVALID');
    const valid=await check(auth.signUserToken({id:1,exp:Date.now()+60000}));assert.equal(valid.next,true);
    console.log('PASS: expired and invalid sessions receive a clear 401 code; a valid owner session remains authorized.');
  }finally{principals.loadPrincipal=original;await require('../config/db').pool.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
