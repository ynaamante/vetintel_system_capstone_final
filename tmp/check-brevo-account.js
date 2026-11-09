require('dotenv').config({quiet:true});
(async()=>{
 const r=await fetch('https://api.brevo.com/v3/account',{headers:{'api-key':process.env.BREVO_API_KEY,accept:'application/json'},signal:AbortSignal.timeout(15000)});
 const b=await r.json().catch(()=>({}));
 console.log(JSON.stringify({status:r.status,code:b.code||null,message:r.ok?'Brevo account authenticated':b.message}));
})().catch(()=>{console.error('Brevo account check could not connect');process.exitCode=1});
