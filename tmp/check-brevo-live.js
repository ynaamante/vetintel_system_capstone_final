require('dotenv').config({quiet:true});
const db=require('../config/db');
const {signUserToken}=require('../middleware/auth');
(async()=>{
 const actor=(await db.query("SELECT u.id,u.clinic_id,u.email,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.clinic_id=11 AND lower(r.name)='doctor' LIMIT 1")).rows[0];
 const headers={Authorization:'Bearer '+signUserToken({...actor,exp:Date.now()+60000})};
 const list=await (await fetch('http://localhost:3000/api/clinic-records/reminders?include_filters=true',{headers})).json();
 const row=list.reminders.find(r=>String(r.pet||r.pet_name||'').toLowerCase().includes('pearly'))||list.reminders[0];
 const key=row.reminder_key||row.id;
 const response=await fetch('http://localhost:3000/api/clinic-records/reminders/'+encodeURIComponent(key),{headers});
 const body=await response.json();
 console.log(JSON.stringify({status:response.status,channels:body.channels}));
 if(!body.channels?.find(c=>c.id==='email'&&c.available))throw new Error('Email still unavailable');
 await db.pool.end();
})().catch(async e=>{console.error(e.message);await db.pool.end();process.exitCode=1});

