const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const db=require('../config/db');
const details=require('../controllers/reminderDetailsController');
const reminders=require('../controllers/reminderController');
const mailer=require('../utils/mailer');
async function call(handler,req){let code=200,body;await handler(req,{status(value){code=value;return this;},json(value){body=value;return this;}},error=>{throw error;});return{code,body};}
(async()=>{
  const client=await db.pool.connect(),originalQuery=db.query,originalConnect=db.pool.connect,originalConfigured=mailer.reminderEmailConfigured,originalSend=mailer.sendClinicReminder;
  let queue=Promise.resolve(),sends=0;
  try{
    await client.query('BEGIN');
    db.query=(sql,values)=>{const result=queue.then(()=>client.query(sql,values));queue=result.catch(()=>{});return result;};
    await details.ensureSchema();
    const actor=(await db.query(`SELECT u.id,u.clinic_id,u.name FROM users u JOIN roles r ON r.id=u.role_id WHERE LOWER(r.name)='doctor' AND COALESCE(u.is_active,true) ORDER BY u.id LIMIT 1`)).rows[0];assert.ok(actor);
    const owner=(await db.query(`INSERT INTO clients(clinic_id,name,email,phone) VALUES($1,'Rollback reminder owner','reminder-test@example.invalid','+630000000000') RETURNING id`,[actor.clinic_id])).rows[0];
    const pet=(await db.query(`INSERT INTO pets(clinic_id,client_id,name,species,breed,notes) VALUES($1,$2,'Rollback reminder pet','Dog','Test breed','Recorded patient note') RETURNING id`,[actor.clinic_id,owner.id])).rows[0];
    const appointment=(await db.query(`INSERT INTO appointments(clinic_id,pet_id,client_id,practitioner_id,status,start_time,reason,notes)
      VALUES($1,$2,$3,$4,'scheduled',now()+interval '1 day','Vaccination follow-up','{"service_category":"Vaccination","clinical_notes":"Recorded appointment note"}') RETURNING id`,[actor.clinic_id,pet.id,owner.id,actor.id])).rows[0];
    const vaccine=(await db.query(`INSERT INTO vaccinations(clinic_id,pet_id,vaccine_name,date_given,next_due,administered_by,status,notes)
      VALUES($1,$2,'Rollback vaccine',CURRENT_DATE,CURRENT_DATE+14,$3,'administered','Recorded vaccine note') RETURNING id`,[actor.clinic_id,pet.id,actor.id])).rows[0];
    const plan=(await db.query(`INSERT INTO treatment_plans(clinic_id,pet_id,title,diagnosis,follow_up,issued_by)
      VALUES($1,$2,'Rollback follow-up','Recorded diagnosis',CURRENT_DATE+5,$3) RETURNING id`,[actor.clinic_id,pet.id,actor.id])).rows[0];
    mailer.reminderEmailConfigured=()=>true;
    mailer.sendClinicReminder=async input=>{sends++;assert.equal(input.email,'reminder-test@example.invalid');assert.ok(input.message.includes('Rollback reminder pet'));return{sent:true,messageId:'mock-provider-id'};};
    const req={user:{...actor,role:'doctor'},query:{},params:{id:`appointment:${appointment.id}`},body:{}};
    const initial=await call(details.get,req);assert.equal(initial.code,200);assert.equal(initial.body.patient.id,pet.id);assert.equal(initial.body.patient.owner,'Rollback reminder owner');assert.equal(initial.body.clinical_notes,'Recorded appointment note');assert.equal(initial.body.history.length,0);assert.equal(initial.body.notified,false);assert.equal(initial.body.can_reschedule,true);
    const vaccination=await call(details.get,{...req,params:{id:`vaccination:${vaccine.id}`}});assert.equal(vaccination.body.vaccination.vaccine_name,'Rollback vaccine');assert.equal(vaccination.body.clinical_notes,'Recorded vaccine note');
    const followup=await call(details.get,{...req,params:{id:`plan:${plan.id}`}});assert.equal(followup.body.treatment_plan.id,plan.id);assert.equal(followup.body.clinical_notes,'Recorded diagnosis');
    const requestId=randomUUID();const sendReq={...req,body:{channels:['email'],request_id:requestId}};
    const sent=await call(details.send,sendReq);assert.equal(sent.code,200);assert.equal(sent.body.sent,true);assert.equal(sends,1);
    const duplicate=await call(details.send,sendReq);assert.equal(duplicate.body.sent,true);assert.equal(sends,1,'Retrying the same request must not send another email.');
    const after=await call(details.get,req);assert.equal(after.body.history.length,1);assert.equal(after.body.history[0].status,'sent');assert.equal(after.body.notified,true);assert.equal(after.body.reminder.status,initial.body.reminder.status,'Sending does not complete clinical care.');
    const listRow=await reminders.findReminder(actor.clinic_id,req.params.id);assert.equal(listRow.notification_status,'sent');assert.ok(listRow.last_reminder_at);
    mailer.sendClinicReminder=async()=>{sends++;throw new Error('Mock provider failure');};
    const failed=await call(details.send,{...req,body:{channels:['email'],request_id:randomUUID()}});assert.equal(failed.body.results[0].status,'failed');
    const history=(await call(details.get,req)).body.history;assert.equal(history[0].status,'failed');assert.equal(history[0].sent_at,null);
    assert.equal((await call(details.send,{...req,body:{channels:['sms'],request_id:randomUUID()}})).code,400);
    assert.equal((await call(details.send,{...req,body:{channels:['whatsapp'],request_id:randomUUID()}})).code,400);
    assert.equal((await call(details.send,{...req,body:{channels:['email'],request_id:'invalid'}})).code,400);
    assert.equal((await call(details.send,{...sendReq,user:{...req.user,role:'receptionist'}})).code,403);
    assert.equal((await call(details.get,{...req,user:{...req.user,clinic_id:actor.clinic_id+100000}})).code,404);
    mailer.reminderEmailConfigured=()=>false;
    assert.equal((await call(details.send,{...req,body:{channels:['email'],request_id:randomUUID()}})).code,503);
    const unavailable=(await call(details.get,req)).body;assert.equal(unavailable.channels.find(row=>row.id==='email').available,false);
    assert.deepEqual(unavailable.channels.map(row=>row.id),['email','in_app']);
    assert.equal(unavailable.channels.find(row=>row.id==='in_app').available,true);
    const notificationApi=require('../controllers/ownerNotificationController');
    const inAppRequest=randomUUID(),sendCount=sends;
    const appSent=await call(details.send,{...req,body:{channels:['in_app'],request_id:inAppRequest}});assert.equal(appSent.body.sent,true);assert.equal(sends,sendCount,'In-app sends must not use the email provider.');
    const ownerReq={user:{id:actor.id,email:'reminder-test@example.invalid',role:'pet_owner'},params:{},body:{}};
    const inbox=(await call(notificationApi.list,ownerReq)).body;
    assert.equal(inbox.length,1);assert.equal(inbox[0].petId,pet.id);assert.equal(inbox[0].read,false);assert.equal(inbox[0].received,false);
    const stranger={...ownerReq,user:{...ownerReq.user,email:'different-owner@example.invalid'}};
    assert.equal((await call(notificationApi.list,stranger)).body.length,0);
    assert.equal((await call(notificationApi.markRead,{...stranger,params:{id:inbox[0].id}})).code,404);
    await call(notificationApi.acknowledge,{...stranger,body:{ids:[inbox[0].id]}});
    assert.equal((await call(details.get,req)).body.history.find(row=>row.channel==='in_app').status,'sent');
    await call(notificationApi.acknowledge,{...ownerReq,body:{ids:[inbox[0].id]}});
    assert.equal((await call(details.get,req)).body.history.find(row=>row.channel==='in_app').status,'delivered');
    await call(notificationApi.markRead,{...ownerReq,params:{id:inbox[0].id}});
    assert.equal((await call(notificationApi.list,ownerReq)).body[0].read,true);
    assert.ok((await call(details.get,req)).body.history.find(row=>row.channel==='in_app').read_at);
    const retry=await call(details.send,{...req,body:{channels:['in_app'],request_id:inAppRequest}});assert.equal(retry.body.sent,true);assert.equal((await call(notificationApi.list,ownerReq)).body.length,1,'Retrying after delivery must not create a duplicate app notification.');
    await call(details.send,{...req,body:{channels:['in_app'],request_id:randomUUID()}});
    await call(notificationApi.markRead,ownerReq);
    assert.ok((await call(notificationApi.list,ownerReq)).body.every(row=>row.read));
    assert.equal((await reminders.findReminder(actor.clinic_id,req.params.id)).status,initial.body.reminder.status);
    db.pool.connect=async()=>({query:(sql,values)=>client.query(sql==='BEGIN'?'SAVEPOINT reminder_reschedule':sql==='COMMIT'?'RELEASE SAVEPOINT reminder_reschedule':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT reminder_reschedule':sql,values),release(){}});
    const rescheduled=await call(require('../controllers/clinicRecordController').createRelatedAppointment,{...req,params:{id:String(appointment.id)},ip:'127.0.0.1',connection:{remoteAddress:'127.0.0.1'},body:{action:'reschedule',start_time:new Date(Date.now()+3*86400000).toISOString(),visit_type:'Vaccination',reason:'Rollback reminder reschedule check'}});
    assert.ok([200,201].includes(rescheduled.code),'The existing reschedule workflow must accept the modal request.');
    const moved=(await db.query('SELECT status FROM appointments WHERE id=$1',[appointment.id])).rows[0];assert.equal(moved.status,'rescheduled');
    assert.ok((await db.query('SELECT id FROM appointments WHERE parent_appointment_id=$1 AND clinic_id=$2',[appointment.id,actor.clinic_id])).rows.length);
    console.log('PASS: linked records, email/in-app channels, owner inbox delivery and read receipts, owner isolation, duplicate-send prevention, mocked email success/failure, SMTP availability, clinical status preservation, rescheduling, and last-reminder updates. No real owners notified.');
  }finally{await queue;await client.query('ROLLBACK');db.query=originalQuery;db.pool.connect=originalConnect;mailer.reminderEmailConfigured=originalConfigured;mailer.sendClinicReminder=originalSend;client.release();}
  console.log('PASS: all test records rolled back.');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.pool.end());
