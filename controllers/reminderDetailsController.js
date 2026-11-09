const db = require('../config/db');
const reminders = require('./reminderController');
const mailer = require('../utils/mailer');
const { publish } = require('../utils/clinicEvents');

exports.ensureSchema = () => db.query(`CREATE TABLE IF NOT EXISTS clinic_reminder_deliveries (
  id BIGSERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), reminder_key TEXT NOT NULL,
  pet_id INTEGER REFERENCES pets(id), client_id INTEGER REFERENCES clients(id), actor_id INTEGER REFERENCES users(id),
  request_id UUID NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('email','sms','whatsapp','in_app')),
  recipient TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('sending','sent','delivered','failed')),
  provider_message_id TEXT, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), sent_at TIMESTAMPTZ,
  UNIQUE(clinic_id,reminder_key,request_id,channel));
  ALTER TABLE clinic_reminder_deliveries DROP CONSTRAINT IF EXISTS clinic_reminder_deliveries_channel_check;
  ALTER TABLE clinic_reminder_deliveries ADD CONSTRAINT clinic_reminder_deliveries_channel_check CHECK(channel IN ('email','sms','whatsapp','in_app'));
  CREATE INDEX IF NOT EXISTS clinic_reminder_deliveries_history_idx ON clinic_reminder_deliveries(clinic_id,reminder_key,created_at DESC);
  CREATE TABLE IF NOT EXISTS clinic_owner_notifications (
    id BIGSERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id),
    client_id INTEGER NOT NULL REFERENCES clients(id), pet_id INTEGER NOT NULL REFERENCES pets(id),
    delivery_id BIGINT NOT NULL UNIQUE REFERENCES clinic_reminder_deliveries(id),
    recipient_email TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'low',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_at TIMESTAMPTZ,read_at TIMESTAMPTZ);
  CREATE INDEX IF NOT EXISTS clinic_owner_notifications_recipient_idx ON clinic_owner_notifications(recipient_email,created_at DESC);`);

function scope(req,res,send=false) {
  const role=String(req.user?.role||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
  const allowed=['doctor','assistant_doctor','veterinarian','owner','clinic_owner','super_admin',...(!send?['receptionist']:[])];
  if(!allowed.includes(role)){res.status(403).json({error:'Clinical staff access is required.'});return null;}
  const clinic=Number(role==='super_admin'?req.query.clinic_id||req.user.clinic_id:req.user.clinic_id);
  if(!Number.isInteger(clinic)||clinic<1){res.status(400).json({error:'A valid clinic is required.'});return null;}
  if(!/^(\d+|(appointment|vaccination|plan):\d+)$/.test(req.params.id)){res.status(400).json({error:'Invalid reminder.'});return null;}
  return clinic;
}
async function details(clinic,key) {
  const reminder=await reminders.findReminder(clinic,key);
  if(!reminder)return null;
  const sourceId=Number(String(key).split(':')[1])||null;
  const [patient,appointment,vaccine,plan,history,clinicRow]=await Promise.all([
    db.query(`SELECT p.id,p.client_id,p.name,p.species,p.breed,p.sex,p.birth_date,p.notes,
      p.metadata->>'weight' AS weight,c.name AS owner,c.email,c.phone FROM pets p
      LEFT JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id WHERE p.id=$1 AND p.clinic_id=$2`,[reminder.pet_id,clinic]),
    db.query(`SELECT a.id,a.reason,a.start_time,a.end_time,a.status,a.practitioner_id,u.name AS doctor,
      COALESCE(co.notes->>'plan',co.notes->>'diagnosis',a.notes->>'clinical_notes',a.notes->>'notes') AS clinical_notes
      FROM appointments a LEFT JOIN users u ON u.id=a.practitioner_id AND u.clinic_id=a.clinic_id
      LEFT JOIN consultations co ON co.appointment_id=a.id AND co.clinic_id=a.clinic_id WHERE a.id=$1 AND a.clinic_id=$2`,[reminder.appointment_id,clinic]),
    db.query(`SELECT id,vaccine_name,date_given,next_due,dose,manufacturer,notes FROM vaccinations
      WHERE clinic_id=$1 AND pet_id=$2 AND ((id=$3 AND $4='vaccination') OR (appointment_id=$5 AND $4<>'vaccination'))
      AND COALESCE(archived,false)=false ORDER BY date_given DESC NULLS LAST,id DESC LIMIT 1`,[clinic,reminder.pet_id,sourceId,reminder.source,reminder.appointment_id]),
    db.query('SELECT id,title,diagnosis,follow_up FROM treatment_plans WHERE clinic_id=$1 AND id=$2 AND $3=\'treatment_plan\'',[clinic,sourceId,reminder.source]),
    db.query(`SELECT d.id,d.channel,d.message,d.status,d.error,d.created_at,d.sent_at,u.name AS sent_by,n.received_at,n.read_at
      FROM clinic_reminder_deliveries d LEFT JOIN users u ON u.id=d.actor_id
      LEFT JOIN clinic_owner_notifications n ON n.delivery_id=d.id AND n.clinic_id=d.clinic_id
      WHERE d.clinic_id=$1 AND d.reminder_key=$2 ORDER BY d.created_at DESC,d.id DESC LIMIT 100`,[clinic,String(key)]),
    db.query('SELECT name FROM clinics WHERE id=$1',[clinic]),
  ]);
  const pet=patient.rows[0]; if(!pet)return null;
  const appointmentRow=appointment.rows[0]||null;
  const historyRows=history.rows;
  if(reminder.source==='reminder'&&(reminder.sent_at||reminder.delivered))historyRows.push({id:'legacy-'+reminder.id,channel:reminder.channel||'message',message:reminder.message,status:reminder.delivered?'delivered':'sent',created_at:reminder.sent_at||reminder.scheduled_at,sent_at:reminder.sent_at});
  historyRows.sort((first,second)=>new Date(second.sent_at||second.created_at)-new Date(first.sent_at||first.created_at));
  const emailPresent=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(pet.email||'').trim());
  const emailConfigured=mailer.reminderEmailConfigured();
  const channels=[{id:'email',label:'Email',available:emailPresent&&emailConfigured,reason:!emailPresent?'No owner email is recorded.':!emailConfigured?'Clinic email is not configured.':null},
    {id:'in_app',label:'In-App Notification',available:emailPresent,reason:emailPresent?null:'Record the owner\'s registered pet app email in their client profile.'}];
  const clinicName=clinicRow.rows[0]?.name||'Your veterinary clinic';
  const dueDate=reminder.scheduled_at?new Date(reminder.scheduled_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'long',day:'numeric',year:'numeric'}):'the scheduled date';
  const label=vaccine.rows[0]?.vaccine_name||plan.rows[0]?.title||reminder.appointment_type||reminder.type||'follow-up';
  const message=`Hello ${pet.owner||'pet owner'},\n\n${clinicName} reminder: ${label} for ${pet.name} is due on ${dueDate}. Please contact the clinic to confirm or arrange your appointment.\n\nThank you,\n${clinicName}`;
  return {reminder,patient:{...pet,photo_attachment_id:reminder.pet_photo_attachment_id},appointment:appointmentRow,vaccination:vaccine.rows[0]||null,treatment_plan:plan.rows[0]||null,
    clinical_notes:vaccine.rows[0]?.notes||appointmentRow?.clinical_notes||plan.rows[0]?.diagnosis||pet.notes||reminder.message||null,
    history:historyRows,notified:historyRows.some(row=>['sent','delivered'].includes(row.status)),channels,message,clinic_name:clinicName,
    can_reschedule:reminder.source==='appointment'&&appointmentRow&&['scheduled','confirmed','pending','checked_in','no_show','rescheduled'].includes(String(appointmentRow.status).toLowerCase())};
}
exports.get=async(req,res,next)=>{
  const clinic=scope(req,res);if(!clinic)return;
  try{const data=await details(clinic,req.params.id);if(!data)return res.status(404).json({error:'This reminder is no longer available in your clinic.'});res.json(data);}catch(error){next(error);}
};
exports.send=async(req,res,next)=>{
  const clinic=scope(req,res,true);if(!clinic)return;
  const channels=req.body.channels;
  if(!Array.isArray(channels)||!channels.length||channels.length>2||new Set(channels).size!==channels.length||channels.some(value=>!['email','in_app'].includes(value)))return res.status(400).json({error:'Choose Email or In-App Notification.'});
  const requestId=req.body.request_id;
  if(typeof requestId!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i).test(requestId))return res.status(400).json({error:'A valid request identifier is required.'});
  try{
    const data=await details(clinic,req.params.id);if(!data)return res.status(404).json({error:'This reminder is no longer available in your clinic.'});
    for(const channel of channels){const option=data.channels.find(row=>row.id===channel);if(!option?.available)return res.status(503).json({error:option?.reason||'This channel is unavailable.'});}
    const results=[];
    for(const channel of channels){
      const recipient=String(data.patient.email).trim().toLowerCase();
      const inserted=await db.query(`INSERT INTO clinic_reminder_deliveries(clinic_id,reminder_key,pet_id,client_id,actor_id,request_id,channel,recipient,message,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'sending') ON CONFLICT(clinic_id,reminder_key,request_id,channel) DO NOTHING RETURNING id`,[clinic,req.params.id,data.patient.id,data.patient.client_id,req.user.id,requestId,channel,recipient,data.message]);
      if(!inserted.rows.length){const previous=await db.query('SELECT id,status,channel FROM clinic_reminder_deliveries WHERE clinic_id=$1 AND reminder_key=$2 AND request_id=$3 AND channel=$4',[clinic,req.params.id,requestId,channel]);results.push(previous.rows[0]);continue;}
      const id=inserted.rows[0].id;
      let result;
      try{
        if(channel==='in_app'){
          await db.query(`WITH notification AS (
            INSERT INTO clinic_owner_notifications(clinic_id,client_id,pet_id,delivery_id,recipient_email,title,message,type,severity)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
          ) UPDATE clinic_reminder_deliveries SET status='sent',sent_at=now(),provider_message_id='notification:'||(SELECT id::text FROM notification)
            WHERE id=$4 AND clinic_id=$1`,[clinic,data.patient.client_id,data.patient.id,id,recipient,
            `${data.reminder.appointment_type||'Pet care'} reminder · ${data.patient.name}`,data.message,data.reminder.type==='vaccination'?'vaccination':'appointment',data.reminder.status==='overdue'?'moderate':'low']);
          result={sent:true};
        }else result=await mailer.sendClinicReminder({email:recipient,clinicName:data.clinic_name,message:data.message});
      }catch{result={sent:false};}
      const status=result.sent?'sent':'failed';
      const error=result.sent?null:channel==='in_app'?'The in-app notification could not be saved. Please try again.':result.reason||'The email provider did not accept this reminder. Check the clinic email configuration and try again.';
      if(channel==='email'||!result.sent)await db.query(`UPDATE clinic_reminder_deliveries SET status=$1,error=$2,provider_message_id=$3,sent_at=CASE WHEN $1='sent' THEN now() ELSE NULL END WHERE id=$4 AND clinic_id=$5`,[status,error,result.messageId||null,id,clinic]);
      await db.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data) VALUES($1,$2,'clinic_reminder_deliveries',$3,$4::jsonb)`,[req.user.id,'reminder_'+status,id,JSON.stringify({clinic_id:clinic,reminder_key:req.params.id,channel,status,pet_id:data.patient.id})]);
      results.push({id,status,channel});
    }
    publish(clinic,'reminder-updated');
    const successful=row=>['sent','delivered'].includes(row.status);
    res.json({results,sent:results.some(successful),message:results.every(successful)?'Reminder sent. Review the history for delivery status.':results.some(row=>row.status==='sending')?'This reminder is still being processed. Refresh the history before retrying.':results.some(successful)?'Some channels failed. Review the reminder history.':'The reminder could not be sent. See the history for details.'});
  }catch(error){next(error);}
};
