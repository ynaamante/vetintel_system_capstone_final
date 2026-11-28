const db = require('../config/db');
const { requirements: permissionsForRequest } = require('../middleware/clinicRbac');

const MEDICAL_TABLE = /diagnos|medical|treatment|consultation|laboratory|lab_result|lab_test|vaccin|prescription|inpatient|patient_record/i;
const MEDICAL_FIELDS = new Set(['diagnosis','case_classification','clinical_status','record_status','recorded_at','medication','dosage','frequency','duration','status','result','test_name','vaccine_name','vaccine_date','next_due_date']);
const SECRET_FIELD = /password|token|secret|authorization|clinical_assessment|medical_history|notes|email|phone/i;
const moduleFor = (table='', action='') => {
  const key = `${table} ${action}`.toLowerCase();
  if (/login|logout|unauthorized|security|password|auth/.test(key)) return 'Security';
  if (/appointment|schedule|consultation/.test(key)) return 'Appointments';
  if (/lab|test_result/.test(key)) return 'Laboratory';
  if (/vaccin/.test(key)) return 'Vaccination';
  if (/prescription|medication|treatment_plan/.test(key)) return 'Prescription';
  if (/invoice|payment|billing|refund/.test(key)) return 'Billing';
  if (/inventory|restock|stock/.test(key)) return 'Inventory';
  if (/user|role|staff|permission/.test(key)) return 'Staff Management';
  if (/report|export|document|attachment|upload/.test(key)) return 'Data Management';
  if (/diagnos|medical|clinic_record|visit|patient/.test(key)) return 'Medical Records';
  if (/pet|client|owner/.test(key)) return 'Patient Management';
  return 'Other';
};
const MODULE_SQL = `CASE
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE ANY(ARRAY['%login%','%logout%','%unauthorized%','%security%','%password%','%auth%']) THEN 'Security'
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE ANY(ARRAY['%appointment%','%schedule%','%consultation%']) THEN 'Appointments'
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE ANY(ARRAY['%lab%','%test_result%']) THEN 'Laboratory'
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE '%vaccin%' THEN 'Vaccination'
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE ANY(ARRAY['%prescription%','%medication%','%treatment_plan%']) THEN 'Prescription'
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE ANY(ARRAY['%invoice%','%payment%','%billing%','%refund%']) THEN 'Billing'
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE ANY(ARRAY['%inventory%','%restock%','%stock%']) THEN 'Inventory'
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE ANY(ARRAY['%user%','%role%','%staff%','%permission%']) THEN 'Staff Management'
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE ANY(ARRAY['%report%','%export%','%document%','%attachment%','%upload%']) THEN 'Data Management'
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE ANY(ARRAY['%diagnos%','%medical%','%clinic_record%','%visit%','%patient%']) THEN 'Medical Records'
  WHEN lower(concat_ws(' ',a.table_name,a.action)) ILIKE ANY(ARRAY['%pet%','%client%','%owner%']) THEN 'Patient Management'
  ELSE 'Other' END`;
const resultFor = (action='', newData={}) => {
  const value = String(newData?._audit?.result || newData?.result || newData?._audit?.status || '').toLowerCase();
  return /fail|denied|unauthorized|error|rejected/.test(`${action} ${value}`) ? 'Failed' : 'Successful';
};
const requiredPermissionFor = (eventData={}) => {
  const stored=String(eventData.required_permission||'').trim();
  if(stored&&stored!=='Not recorded')return stored;
  // Older denied-access events kept the route but predate the permission field.
  // Derive a display-safe permission name without returning the route itself.
  const path=String(eventData.attempted_path||'').trim();
  if(!path)return null;
  try {
    const needed=permissionsForRequest({path,method:eventData.attempted_method||'GET',body:{}});
    const permissions=(needed||[]).flat().filter(value=>typeof value==='string'&&!value.startsWith('__'));
    return permissions.length?permissions.join(' or '):null;
  } catch { return null; }
};
const changedFields = (oldData={}, newData={}) => [...new Set([...Object.keys(oldData||{}),...Object.keys(newData||{})])]
  .filter(key=>key!=='_audit' && JSON.stringify(oldData?.[key])!==JSON.stringify(newData?.[key]));
const isSafeField = (key,table) => !SECRET_FIELD.test(key) && !['clinic_id','user_id','pet_id','patient_id','client_id','veterinarian_id','recorded_by','source','device','attempted_path','attempted_method'].includes(key) && (key!=='result'||MEDICAL_TABLE.test(table||'')) && (!MEDICAL_TABLE.test(table||'')||MEDICAL_FIELDS.has(key));
const descriptionFor = row => {
  const data=row.new_data||{};
  if(data._audit?.description)return data._audit.description;
  if(data.permissions&&data.role)return `Updated ${String(data.role).replace(/[_-]+/g,' ')} permissions`;
  if(!MEDICAL_TABLE.test(row.table_name||'')&&(data.description||data.title))return data.description||data.title;
  const action=String(row.action||'activity').toLowerCase().replace(/[_-]+/g,' '),table=String(row.table_name||'').toLowerCase();
  const subject=/security|auth/.test(table)?'to the clinic system':table.includes('diagnos')?'a diagnosis':table.includes('appointment')?'an appointment':table.includes('lab')?'a laboratory report':table.includes('vaccin')?'a vaccination record':table.includes('invoice')||table.includes('payment')?'a billing record':table.includes('inventory')||table.includes('restock')?'an inventory record':table.includes('prescription')?'a prescription':table.includes('pet')?'a patient record':table.includes('user')||table.includes('role')?'staff permissions':'a clinic record';
  if(action.includes('unauthorized'))return 'Attempted restricted access';
  if(action.includes('login')&&action.includes('fail'))return 'Failed sign-in attempt';
  if(action.includes('login')&&action.includes('success'))return 'Signed in to the clinic system';
  if(action.includes('logout'))return 'Signed out of the clinic system';
  const verb=action.includes('fail')?'Failed to':action.includes('upload')?'Uploaded':action.includes('create')||action==='register pet'?'Created':action.includes('update')||action.includes('edit')?'Updated':action.includes('archive')?'Archived':action.includes('delete')?'Deleted':action.includes('cancel')?'Cancelled':action.includes('complete')?'Completed':action.includes('confirm')?'Confirmed':action.includes('record')||action.includes('administer')||action.includes('vaccination')?'Recorded':action.includes('generate')?'Generated':action.includes('login')?'Signed in':action.includes('logout')?'Signed out':action.includes('review')?'Reviewed':action.includes('request')?'Requested':action.charAt(0).toUpperCase()+action.slice(1);
  return `${verb} ${subject}`;
};
const safeChanges = (row) => {
  const oldData=row.old_data||{},newData=row.new_data||{};
  return changedFields(oldData,newData).filter(key=>isSafeField(key,row.table_name))
    .slice(0,30).map(key=>({field:key,previous:displayValue(oldData[key]),updated:displayValue(newData[key])}));
};
const displayValue = value => {
  if(value==null||value==='')return '—';
  if(typeof value==='object')return '[structured value updated]';
  const text=String(value);
  return text.length>180?`${text.slice(0,177)}…`:text;
};
const auditSummary = row => {
  const oldData=row.old_data||{},newData=row.new_data||{};
  const description=descriptionFor(row);
  const petId=newData.pet_id||oldData.pet_id||newData.patient_id||oldData.patient_id||null;
  return {
    id:row.id,user_id:row.user_id,user:row.name||row.email||'System',role:newData._audit?.role||row.role_name||null,
    action:row.action,description:String(description),module:moduleFor(row.table_name,row.action),category:row.table_name,
    timestamp:row.created_at,ip_address:row.ip_address||null,record_id:row.record_id,
    pet:row.pet_name?{id:row.pet_id||petId,name:row.pet_name,species:row.pet_species||null}:null,
    result:resultFor(row.action,newData),changed_fields:changedFields(oldData,newData).filter(key=>isSafeField(key,row.table_name)).slice(0,30),
    clinic:newData.clinic_id||oldData.clinic_id||row.clinic_id||null,
  };
};
const AUDIT_SELECT = `SELECT a.id,a.user_id,a.action,a.table_name,a.record_id,a.old_data,a.new_data,a.ip_address,a.created_at,
  u.name,u.email,r.name AS role_name,p.id AS pet_id,p.name AS pet_name,p.species AS pet_species,COALESCE(u.clinic_id::text,a.new_data->>'clinic_id',a.old_data->>'clinic_id') AS clinic_id
  FROM audit_trail a LEFT JOIN users u ON u.id=a.user_id LEFT JOIN roles r ON r.id=u.role_id
  LEFT JOIN appointments ap ON a.table_name='appointments' AND ap.id::text=a.record_id::text
  LEFT JOIN pets p ON p.id=CASE WHEN COALESCE(a.new_data->>'pet_id',a.old_data->>'pet_id',a.new_data->>'patient_id',a.old_data->>'patient_id') ~ '^[0-9]+$' THEN COALESCE(a.new_data->>'pet_id',a.old_data->>'pet_id',a.new_data->>'patient_id',a.old_data->>'patient_id')::int WHEN a.table_name='pets' AND a.record_id::text ~ '^[0-9]+$' THEN a.record_id::int ELSE ap.pet_id END
    AND p.clinic_id::text=COALESCE(a.new_data->>'clinic_id',a.old_data->>'clinic_id',u.clinic_id::text,ap.clinic_id::text)`;

exports.list = async (req, res, next) => {
  if (req.user?.role !== 'super_admin') return exports.getByFilter(req, res, next);
  try {
    // Join users to include a friendly user display name for the frontend
    const result = await db.query(`
      ${AUDIT_SELECT}
      WHERE COALESCE(a.archived, false) = false
      ORDER BY a.created_at DESC
      LIMIT 100
    `);

    res.json(result.rows.map(auditSummary));
  } catch (e) {
    next(e);
  }
};

exports.getByFilter = async (req, res, next) => {
  try {
    const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!['owner','clinic_owner','super_admin'].includes(role)) return res.status(403).json({error:'Clinic owner access required.'});
    const { user_id, action, table_name, record_id, days, search, staff_role, module: auditModule, status, from, to } = req.query;
    const clinic_id = role === 'super_admin' ? req.query.clinic_id : req.user?.clinic_id;
    if (days && (!/^\d+$/.test(String(days)) || Number(days)<1 || Number(days)>3650)) return res.status(422).json({error:'Days must be between 1 and 3650.'});
    if (req.query.before_id && !/^[1-9]\d*$/.test(String(req.query.before_id))) return res.status(422).json({error:'Invalid audit cursor.'});
    const validDate=value=>!value||/^\d{4}-\d{2}-\d{2}$/.test(String(value))&&Number.isFinite(Date.parse(`${value}T00:00:00Z`));
    if(!validDate(from)||!validDate(to))return res.status(422).json({error:'Dates must use YYYY-MM-DD.'});
    if(from&&to&&from>to)return res.status(422).json({error:'Start date must be on or before end date.'});
    if (req.user?.role !== 'super_admin' && !clinic_id) return res.status(400).json({ error: 'Your account must be assigned to a clinic.' });
    let query = `${AUDIT_SELECT} WHERE COALESCE(a.archived, false) = false`;
    const params = [];
    let paramCount = 0;

    if (user_id) {
      paramCount++;
      query += ` AND a.user_id = $${paramCount}`;
      params.push(user_id);
    }

    if (action) {
      paramCount++;
      query += ` AND a.action = $${paramCount}`;
      params.push(action);
    }

    if (table_name) {
      paramCount++;
      query += ` AND a.table_name = $${paramCount}`;
      params.push(table_name);
    }

    if (record_id) {
      paramCount++;
      query += ` AND a.record_id::text = $${paramCount}`;
      params.push(String(record_id));
    }

    if (search) {
      params.push(`%${String(search).trim().slice(0,120)}%`);
      query += ` AND (u.name ILIKE $${++paramCount} OR a.action ILIKE $${paramCount} OR a.table_name ILIKE $${paramCount}
        OR a.record_id::text ILIKE $${paramCount} OR ('AUD-'||lpad(a.id::text,4,'0')) ILIKE $${paramCount} OR COALESCE(a.new_data->>'name',a.new_data->>'title',a.new_data->>'description','') ILIKE $${paramCount}
        OR EXISTS(SELECT 1 FROM pets sp WHERE sp.id=CASE WHEN COALESCE(a.new_data->>'pet_id',a.old_data->>'pet_id',a.new_data->>'patient_id',a.old_data->>'patient_id') ~ '^[0-9]+$' THEN COALESCE(a.new_data->>'pet_id',a.old_data->>'pet_id',a.new_data->>'patient_id',a.old_data->>'patient_id')::int WHEN a.table_name='pets' AND a.record_id::text ~ '^[0-9]+$' THEN a.record_id::int END AND sp.name ILIKE $${paramCount}))`;
    }
    if (staff_role && staff_role !== 'All Staff') {
      const roles = staff_role === 'Veterinarians' ? ['doctor','veterinarian'] : staff_role === 'Assistants' ? ['assistant_doctor','assistant-doctor'] : staff_role === 'Receptionists' ? ['receptionist'] : null;
      if (!roles) return res.status(422).json({error:'Unknown staff filter.'});
      params.push(roles); query += ` AND lower(replace(COALESCE(r.name,a.new_data->'_audit'->>'role',''),' ','_'))=ANY($${++paramCount}::text[])`;
    }
    if (auditModule && auditModule !== 'All Activities') {
      const modules=['Patient Management','Medical Records','Appointments','Laboratory','Vaccination','Prescription','Billing','Inventory','Staff Management','Security','Data Management','Other'];
      if (!modules.includes(auditModule)) return res.status(422).json({error:'Unknown activity filter.'});
      params.push(auditModule); query += ` AND (${MODULE_SQL})=$${++paramCount}`;
    }
    if (status && status !== 'All Statuses') {
      if(!['Successful','Failed'].includes(status))return res.status(422).json({error:'Unknown status filter.'});
      const failed=`(a.action ILIKE '%fail%' OR a.action ILIKE '%denied%' OR a.action ILIKE '%unauthorized%' OR lower(COALESCE(a.new_data->'_audit'->>'result',a.new_data->>'result',a.new_data->'_audit'->>'status','')) IN ('failed','failure','denied','error'))`;
      query += status==='Failed'?` AND ${failed}`:` AND NOT ${failed}`;
    }

    if (clinic_id) {
      paramCount++;
      query += ` AND (
        a.new_data->>'clinic_id' = $${paramCount}
        OR a.old_data->>'clinic_id' = $${paramCount}
        OR (COALESCE(a.new_data->>'clinic_id', a.old_data->>'clinic_id') IS NULL
            AND u.clinic_id::text = $${paramCount})
        OR (COALESCE(a.new_data->>'clinic_id', a.old_data->>'clinic_id') IS NULL AND
          a.table_name = 'appointments'
          AND EXISTS (
            SELECT 1 FROM appointments appointment
            WHERE appointment.id::text = a.record_id::text
              AND appointment.clinic_id::text = $${paramCount}
          )
        )
      )`;
      params.push(String(clinic_id));
    }

    if (days) {
      params.push(Number(days));
      query += ` AND a.created_at > now() - ($${++paramCount}::int * interval '1 day')`;
    }
    if(from){params.push(from);query+=` AND (a.created_at AT TIME ZONE 'Asia/Manila')::date >= $${++paramCount}::date`;}
    if(to){params.push(to);query+=` AND (a.created_at AT TIME ZONE 'Asia/Manila')::date <= $${++paramCount}::date`;}
    if (req.query.before_id) {
      params.push(req.query.before_id);
      query += ` AND a.id < $${++paramCount}`;
    }
    query += req.query.paged === 'true' ? ' ORDER BY a.id DESC LIMIT 500' : ' ORDER BY a.created_at DESC,a.id DESC LIMIT 500';
    const result = await db.query(query, params);

    const rows = result.rows.map(auditSummary);

    res.json(req.query.paged === 'true' ? {rows, next_cursor:rows.length===500?rows[rows.length-1].id:null} : rows);
  } catch (e) {
    next(e);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const role=String(req.user?.role||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
    if(!['owner','clinic_owner','super_admin'].includes(role))return res.status(403).json({error:'Clinic owner access required.'});
    if(!/^[1-9]\d*$/.test(String(req.params.id)))return res.status(400).json({error:'Invalid audit ID.'});
    const clinicId=role==='super_admin'?null:req.user?.clinic_id;
    if(role!=='super_admin'&&!clinicId)return res.status(400).json({error:'Your account must be assigned to a clinic.'});
    const params=[Number(req.params.id)];
    let scope='';
    if(clinicId){params.push(String(clinicId));scope=` AND (a.new_data->>'clinic_id'=$2 OR a.old_data->>'clinic_id'=$2 OR (COALESCE(a.new_data->>'clinic_id',a.old_data->>'clinic_id') IS NULL AND u.clinic_id::text=$2) OR (a.table_name='appointments' AND EXISTS(SELECT 1 FROM appointments ap WHERE ap.id::text=a.record_id::text AND ap.clinic_id::text=$2)))`;}
    const row=(await db.query(`${AUDIT_SELECT} WHERE a.id=$1 AND COALESCE(a.archived,false)=false${scope}`,params)).rows[0];
    if(!row)return res.status(404).json({error:'Audit record not found.'});
    const summary=auditSummary(row);
    const eventData=row.new_data||{},metadata=eventData._audit||{};
    res.json({...summary,changes:safeChanges(row),source:metadata.source||eventData.source||null,device:metadata.device||eventData.device||null,reason:metadata.reason||eventData.reason||(summary.result==='Failed'?'The application prevented this action.':null),event_type:eventData.event_type||metadata.event_type||null,http_method:eventData.attempted_method||null,target_module:eventData.target_module||null,attempted_action:eventData.attempted_action||null,required_permission:requiredPermissionFor(eventData)});
  }catch(error){next(error);}
};

exports.create = async (req, res, next) => {
  try {
    const { action, table_name, record_id, old_data, new_data, reason } = req.body;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_id = req.user && req.user.id ? req.user.id : null;
    const auditData = {
      ...(new_data || {}),
      _audit: {
        user_id,
        role: req.user && req.user.role,
        recorded_at: new Date().toISOString(),
        ...(reason ? { reason: String(reason).trim() } : {}),
      },
    };

    const result = await db.query(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_data, new_data, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, action, table_name, record_id, old_data, new_data, ip_address, created_at`,
      [user_id, action, table_name, record_id, JSON.stringify(old_data || {}), JSON.stringify(auditData), ip_address]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    next(e);
  }
};
