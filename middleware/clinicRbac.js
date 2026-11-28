const db=require('../config/db');
const {has,profile,normalize}=require('../utils/rolePermissions');
const read=req=>['GET','HEAD'].includes(req.method);
// Each entry is an OR list; all returned entries must pass (AND).
function requirements(req) {
 const p=req.path,b=req.body||{},get=read(req),one=item=>[[item]];
 if(p==='/me'||p==='/password/change'||p==='/clinic-records/events'||p==='/notifications'||p.startsWith('/notifications/')) return [];
 if(/^\/roles(?:\/|$)/.test(p)) return one(get?'View Roles':'Assign Permissions');
 if(/^\/users(?:\/|$)/.test(p)) return one(get?'View Users':req.method==='POST'?'Create Users':b.is_active===false||req.method==='DELETE'?'Deactivate Users':'Edit Users');
 if(p.startsWith('/disease-intelligence/')) {
   if(/^\/disease-intelligence\/alerts\/\d+\/advisory$/.test(p))return [['View Risk Monitoring','View Disease Monitoring','View Intelligence Dashboard'],['Alert Clinics']];
   if(p==='/disease-intelligence/alert-rules')return one('Configure Alert Rules');
   if(/^\/disease-intelligence\/alerts\/\d+\/review$/.test(p))return [['View Disease Monitoring','View Risk Monitoring','View Intelligence Dashboard'],['Review Disease Alerts']];
   if(/^\/disease-intelligence\/alerts\/\d+\/history$/.test(p))return [['View Disease Monitoring','View Risk Monitoring','View Intelligence Dashboard']];
   if(p.endsWith('/monitoring-export'))return [['View Disease Monitoring','View Risk Monitoring'],['Export Reports']];
   if(p.endsWith('/report-data'))return [['View Reports'],['Generate Reports']];
   if(p.endsWith('/export-data'))return [['View Intelligence Dashboard','View Disease Monitoring','View Risk Monitoring','View Community Analytics','View Reports'],['Export Reports']];
   if(!get)return one(({'/disease-intelligence/clinic-alerts':'Alert Clinics','/disease-intelligence/follow-up-flags':'Flag for Follow-up'})[p]||'__unmapped_surveillance_operation__');
   return p.endsWith('/catalog')?one('View Diagnoses'):[['View Intelligence Dashboard','View Disease Monitoring','View Risk Monitoring','View Community Analytics','View Reports']];
 }
 if(p.startsWith('/owner-monitoring/')) return one(p.endsWith('/report')?'View Reports':p.endsWith('/data-status')?'View Data Sync Status':'View Clinic Overview');
 if(p.startsWith('/audit-trail')) return one('View Audit Trail');
 if(p.startsWith('/my-role-requests')) return one('View Roles');
 if(!p.startsWith('/clinic-records/')) return null;
 if(p.includes('/restock-requests'))return get?[['View Inventory','View Clinic Overview']]:one(req.method==='POST'?'Request Restock':'Restock Inventory');
 if(/\/diagnoses(?:\/|$)/.test(p)) {
   if(get)return one('View Diagnoses');
   const needed=one(req.method==='POST'&&!p.endsWith('/observations')?'Create Diagnosis':'Edit Diagnosis');
   if(!p.includes('/observations')&&(b.record_status??'finalized')==='finalized') needed.push(['Finalize Diagnosis']);
   if(b.case_classification==='confirmed')needed.push(['Confirm Diagnosis']);
   return needed;
 }
 if(/\/lab-test/.test(p)) {
   if(get&&p.endsWith('/lab-test-types'))return [['View Services','View Laboratory Results']];
   if(get)return one('View Laboratory Results');
   if(p.endsWith('/report'))return one('Manage Laboratory Reports');
   if(req.method==='POST'&&p==='/clinic-records/lab-tests')return one('Order Laboratory Tests');
   const needed=one('Record Laboratory Results');if(b.verifyResults===true)needed.push(['Verify Laboratory Results']);return needed;
 }
 if(p.includes('/attachments/')) return [['View Laboratory Results','View Inpatient Care','View Medical History']];
 if(p.includes('/registration-doctors'))return [['View Registrations','Create Pet Records','View Patient Intakes','View Own Schedule','Manage Follow-ups']];
 if(p.includes('/registration-screening/'))return [['Create Pet Records','View Patient Intakes']];
 if(p.includes('/registration-intakes') && get && !p.endsWith('/patient-record')) return [['View Patient Intakes','View Registrations']];
 if(p.includes('/registration-intakes')) return one(get?p.endsWith('/patient-record')?'View Medical History':'View Patient Intakes':/\/review$|\/return$|\/screening$/.test(p)?'Manage Patient Intakes':'Create Pet Records');
 if(p.includes('/intake-summary'))return one('View Medical History');
 if(p.includes('/patient-queue'))return one(get?'View Patient Queue':p.endsWith('/walk-in')?'Manage Walk-ins':'Manage Patient Queue');
 if(p.includes('/appointments')) {
   if(get&&(/\/consultation$|\/visit-workflow$/.test(p)))return one('View Medical History');
   if(get)return [['View Appointments','View Own Schedule','Manage Follow-ups']];
   if(p.endsWith('/reception-action'))return one(({confirm:'Approve Appointment',cancel:'Cancel Appointment',checkin:'Manage Patient Queue',noshow:'Manage No-shows'})[b.action]||'Manage Patient Queue');
   if(p.endsWith('/visit-workflow'))return one(({administer:'Manage Vaccination Records',save_vaccination_draft:'Manage Vaccination Records',record_vaccination:'Manage Vaccination Records',complete:'Complete Appointment',complete_service:'Complete Appointment',end:'Complete Appointment',start:'Create Consultation'})[b.action]||'Edit Consultation');
   if(p.endsWith('/start-consultation'))return one('Create Consultation');
   if(p.endsWith('/complete-consultation'))return one('Complete Appointment');
   if(p.endsWith('/consultation'))return one('Edit Consultation');
   if(p.endsWith('/transfer'))return one('Reschedule Appointment');
   if(p.endsWith('/archive'))return one('Cancel Appointment');
   return one(req.method==='POST'?'Create Appointment':'Reschedule Appointment');
 }
 if(p.includes('/reminders'))return one(get?'View Reminders':'Manage Follow-ups');
 if(p.includes('/billing-catalog'))return one(get?'View Services':req.method==='POST'?'Create Services':'Edit Services');
 if(p.includes('/invoices')||p.includes('/payments')||p.includes('/billing-review')||p.includes('/payment-qr')) {
   if(get)return [['View Billing','View Financial Reports','Create Prescription','Manage Treatment Plans']];
   return one(p.includes('/payments')?'Process Payment':'Create Invoice');
 }
 if(p.includes('/vaccine-inventory')||p.includes('/inventory'))return one(get?'View Inventory':req.method==='POST'?'Add Inventory':'Edit Inventory');
 if(p.includes('/vaccinations'))return one(get?'View Vaccinations':'Manage Vaccination Records');
 if(p.includes('/treatments'))return one(get?'View Treatment Plans':'Create Prescription');
 if(p.includes('/treatment'))return one(get?'View Treatment Plans':'Manage Treatment Plans');
 if(p.includes('/inpatient'))return one(get?'View Inpatient Care':'Manage Inpatient Care');
 if(p.includes('/inbox')) {
   if(get)return one('View Pet Owner Messages');
   if(req.method==='POST')return one('Send Pet Owner Messages');
   const needed=[];
   if(b.text!==undefined && (!b.kind || b.kind==='reply'))needed.push(['Send Pet Owner Messages']);
   if(b.text===undefined || (b.kind && b.kind!=='reply') || ['status','assignedTo','unread'].some(key=>b[key]!==undefined))needed.push(['Manage Conversations']);
   return needed;
 }
 if(/^\/clinic-records\/owners(?:\/|$)/.test(p))return one(get?'View Owners':p.endsWith('/archive')?'Archive Owner':req.method==='POST'?'Create Owner':'Edit Owner');
 if(p.includes('/clients'))return one(get?'View Clients':req.method==='POST'?'Create Client':'Edit Client');
 if(p.includes('/pets'))return one(get?p.endsWith('/documents')||p.endsWith('/clinical-alerts')?'View Medical History':'View Pet Records':p.endsWith('/archive')?'Archive Pet Records':req.method==='POST'&&!p.endsWith('/photo')?'Create Pet Records':'Edit Pet Records');
 if(p.includes('/dashboard'))return one('View Clinic Dashboard');
 if(p.includes('/visits'))return one('View Visits');
 if(p.includes('/shareable-records'))return one('View Medical History');
 return [['__unmapped_clinic_operation__']];
}
function securityContext(req, needed) {
 const path=String(req.path||'').toLowerCase();
 const targetModule=path.includes('audit-trail')?'Security':path.includes('billing')||path.includes('payment')||path.includes('invoice')?'Billing & Payments':path.includes('inventory')?'Inventory':path.includes('roles')||path.includes('users')||path.includes('permissions')?'Staff Management':path.includes('disease-intelligence')?'Disease Intelligence':path.includes('appointment')?'Appointments':'Clinic Web Dashboard';
 const requiredPermission=(needed||[]).flat().filter(item=>typeof item==='string'&&!item.startsWith('__')).join(' or ')||'Not recorded';
 const attemptedAction=read(req)?`View ${targetModule}`:`Update ${targetModule}`;
 return {target_module:targetModule,attempted_action:attemptedAction,required_permission:requiredPermission};
}
exports.protectedPath=p=>/^\/(clinic-records|roles|users|permissions|role-permissions|audit-trail|disease-intelligence|owner-monitoring|my-role-requests)(\/|$)/.test(p);
exports.requirements=requirements;
exports.guard=async(req,res,next)=>{
 try {
   const role=normalize(req.user?.role),p=req.path;
   if(role==='super_admin')return next();
   if(!Number.isInteger(Number(req.user?.clinic_id))||Number(req.user.clinic_id)<1)return res.status(403).json({error:'An assigned clinic is required.'});
   if(/^\/(permissions|role-permissions)(\/|$)/.test(p))return res.status(403).json({error:'Platform permission definitions require super-admin access.'});
   if(/^\/roles(?:\/|$)/.test(p)&&(!['owner','clinic_owner'].includes(role)||['POST','DELETE'].includes(req.method)))return res.status(403).json({error:'Only clinic owners can configure existing staff roles.'});
   if(/^\/users(?:\/|$)/.test(p)) {
     if(profile(role)!=='owner')return res.status(403).json({error:'Clinic owner access required.'});
     const match=p.match(/^\/users\/(\d+)/);
     if(match) {
       const target=(await db.query('SELECT u.clinic_id,r.name AS role FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[Number(match[1])])).rows[0];
       if(!target||Number(target.clinic_id)!==Number(req.user.clinic_id)||['owner','super_admin'].includes(profile(target.role)))return res.status(403).json({error:'Only staff in your own clinic can be managed.'});
     }
     if(!read(req)) {
       if(req.body.clinic_id!=null&&Number(req.body.clinic_id)!==Number(req.user.clinic_id))return res.status(403).json({error:'Cross-clinic staff changes are not allowed.'});
       req.body.clinic_id=req.user.clinic_id;delete req.body.clinic_name;
       if(req.body.role_id||req.body.role_name) {
         const target=(await db.query(req.body.role_id?'SELECT name FROM roles WHERE id=$1':'SELECT name FROM roles WHERE lower(name)=lower($1)',[req.body.role_id||req.body.role_name])).rows[0];
         if(!target||!['doctor','receptionist'].includes(profile(target.name)))return res.status(403).json({error:'Only approved clinical or receptionist staff roles can be assigned.'});
       }
     }
   }
   const needed=requirements(req);
   if(needed&&!needed.every(options=>options.some(item=>has(req.user,item)))){
     try{await require('../utils/audit').logAudit({user_id:req.user?.id,role:req.user?.role,action:'unauthorized_access_attempt',table_name:'security_events',new_data:{clinic_id:req.user?.clinic_id||null,result:'Failed',source:'Clinic Web Dashboard',event_type:'Unauthorized access attempt',attempted_method:req.method,...securityContext(req,needed)},reason:'Insufficient permissions for this role.',ip_address:req.ip||req.connection?.remoteAddress||null});}catch(error){console.error('Could not record denied access audit event:',error.message);}
     return res.status(403).json({error:'Your clinic role does not permit this action.'});
   }
   return next();
 }catch(error){return next(error);}
};
