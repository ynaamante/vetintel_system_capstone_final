require('dotenv').config({quiet:true});
(async()=>{
 const r=await fetch('https://api.brevo.com/v3/senders',{headers:{'api-key':process.env.BREVO_API_KEY,accept:'application/json'},signal:AbortSignal.timeout(15000)});
 const b=await r.json().catch(()=>({}));
 console.log(JSON.stringify({status:r.status,code:b.code||null,message:r.ok?'Sender lookup succeeded':b.message,configuredSenderVerified:r.ok?b.senders?.some(s=>s.email===process.env.SENDER_EMAIL&&s.active):undefined}));
})().catch(()=>{console.error('Brevo sender check could not connect');process.exitCode=1});
