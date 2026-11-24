const db=require('../config/db');
const policy=require('../utils/rolePermissions');
exports.ensureSchema=()=>db.query(require('fs').readFileSync(require('path').join(__dirname,'../scripts/clinic_role_permissions_schema.sql'),'utf8'));
exports.loadPrincipal=async id=>{
  const result=await db.query(`SELECT u.id,u.name,u.email,u.is_active,u.clinic_id,u.email_verification_required,u.email_verified_at,u.password_reset_at,r.name AS role,c.name AS clinic_name,
    r.permissions AS base_permissions,p.permissions AS clinic_permissions
    FROM users u LEFT JOIN roles r ON r.id=u.role_id LEFT JOIN clinics c ON c.id=u.clinic_id
    LEFT JOIN clinic_role_permissions p ON p.clinic_id=u.clinic_id
      AND p.role_key=lower(regexp_replace(trim(r.name),'[[:space:]-]+','_','g')) WHERE u.id=$1`,[id]);
  const row=result.rows[0];
  if(!row || row.is_active===false || (row.email_verification_required && !row.email_verified_at)) return null;
  const {base_permissions,clinic_permissions,is_active,...user}=row;
  user.role=policy.normalize(user.role);
  return {...user,permissions:policy.resolve(user.role,base_permissions,clinic_permissions)};
};
exports.effectiveForRole=async(role,clinic)=>{
  const stored=clinic?(await db.query('SELECT permissions FROM clinic_role_permissions WHERE clinic_id=$1 AND role_key=$2',[clinic,policy.normalize(role.name)])).rows[0]:null;
  return policy.resolve(role.name,role.permissions,stored?.permissions);
};
exports.saveOverride=async(req,role,permissions)=>{
  const input=permissions;
  if(!input || typeof input!=='object' || Array.isArray(input)) throw Object.assign(new Error('Permissions must be an object.'),{status:422});
  const expected=new Map(policy.catalog.groups);
  for(const [group,items] of Object.entries(input)) {
    if(!expected.has(group)||!items||typeof items!=='object'||Array.isArray(items)) throw Object.assign(new Error('Unknown permission group.'),{status:422});
    for(const [item,value] of Object.entries(items)) {
      if(!expected.get(group).includes(item)||typeof value!=='boolean') throw Object.assign(new Error(`Invalid permission in ${group}.`),{status:422});
      if(value&&!policy.allowed(role.name,item)) throw Object.assign(new Error(`“${item}” is not available to the ${role.name} role.`),{status:422});
    }
  }
  const resolved=policy.resolve(role.name,{},input),client=await db.pool.connect();
  try {
    await client.query('BEGIN');
    const before=(await client.query('SELECT permissions FROM clinic_role_permissions WHERE clinic_id=$1 AND role_key=$2 FOR UPDATE',[req.user.clinic_id,policy.normalize(role.name)])).rows[0];
    await client.query(`INSERT INTO clinic_role_permissions(clinic_id,role_key,permissions,updated_by) VALUES($1,$2,$3::jsonb,$4)
      ON CONFLICT(clinic_id,role_key) DO UPDATE SET permissions=EXCLUDED.permissions,updated_by=EXCLUDED.updated_by,updated_at=now()`,[req.user.clinic_id,policy.normalize(role.name),JSON.stringify(resolved),req.user.id]);
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,old_data,new_data)
      VALUES($1,'configure_clinic_role','clinic_role_permissions',$2,$3::jsonb,$4::jsonb)`,[req.user.id,role.id,JSON.stringify({clinic_id:req.user.clinic_id,role:role.name,permissions:before?.permissions||null}),JSON.stringify({clinic_id:req.user.clinic_id,role:role.name,permissions:resolved})]);
    await client.query('COMMIT');
    require('../utils/clinicEvents').publish(req.user.clinic_id,'permissions');
    return resolved;
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
};
