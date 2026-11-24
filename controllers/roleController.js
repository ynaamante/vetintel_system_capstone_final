const db = require('../config/db');
const audit = require('../utils/audit');

const roleSynonymMap = new Map([
  ['clinic owner', 'clinic_owner'],
  ['clinicowner', 'clinic_owner'],
  ['clinic-owner', 'clinic_owner'],
  ['owner', 'clinic_owner'],
  ['clinic_owner', 'clinic_owner'],
  ['dr', 'doctor'],
  ['dr.', 'doctor'],
  ['doctor', 'doctor'],
  ['receptionist', 'receptionist'],
  ['super admin', 'super_admin'],
  ['super_admin', 'super_admin'],
]);

const canonicalRoleNames = new Set(['clinic_owner', 'doctor', 'receptionist', 'super_admin']);

function parsePermissions(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Invalid role permissions JSON:', error);
    return {};
  }
}

function normalizeRoleName(name) {
  if (!name) return '';
  return name.trim();
}

function roleCanonicalKey(name) {
  if (!name) return '';
  const lower = name.trim().toLowerCase();
  return roleSynonymMap.get(lower) || lower;
}

function dedupeRoles(rows) {
  const buckets = rows.reduce((acc, role) => {
    const key = roleCanonicalKey(role.name);
    if (!acc[key]) acc[key] = [];
    acc[key].push(role);
    return acc;
  }, {});

  return Object.values(buckets)
    .map((group) => {
      // Prefer a role whose canonical key is in the canonicalRoleNames set
      const canonicalRole = group.find((role) => canonicalRoleNames.has(roleCanonicalKey(role.name)));
      const selectedRole = canonicalRole || group[0];
      return {
        ...selectedRole,
        name: normalizeRoleName(selectedRole.name),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function roleNameExists(name, excludeId = null) {
  const canonicalKey = roleCanonicalKey(name);
  const excludedId = excludeId != null ? Number(excludeId) : null;
  const result = await db.query('SELECT id, name FROM roles');
  return result.rows.some((row) => {
    if (excludedId != null && row.id === excludedId) return false;
    return roleCanonicalKey(row.name) === canonicalKey;
  });
}

// Exact (case-insensitive) name collision check — ignores synonym canonicalization.
async function roleNameExistsExact(name, excludeId = null) {
  const lower = (name || '').trim().toLowerCase();
  const excludedId = excludeId != null ? Number(excludeId) : null;
  const result = await db.query('SELECT id, name FROM roles');
  return result.rows.some((row) => {
    if (excludedId != null && row.id === excludedId) return false;
    return (row.name || '').trim().toLowerCase() === lower;
  });
}

exports.list = async (req, res, next) => {
  try {
    const colRes = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='roles' AND column_name='description'`
    );
    const hasDescription = colRes.rows.length > 0;
    const selectFields = hasDescription ? 'r.id, r.name, r.description, r.permissions' : 'r.id, r.name, r.permissions';

    const result = await db.query(`
      SELECT ${selectFields}
      FROM roles r
      ORDER BY r.name ASC
    `);
    
    // Parse permissions JSON if stored as string
    const roles = await Promise.all(result.rows.map(async role => ({
      ...role,
      permissions: req.user?.role === 'super_admin' ? parsePermissions(role.permissions)
        : await require('../services/clinicPermissions').effectiveForRole(role, req.user?.clinic_id)
    })));
    
    const dedupedRoles = dedupeRoles(roles);
    res.json(dedupedRoles);
  } catch (e) {
    next(e);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);
    if (Number.isNaN(numericId)) return res.status(400).json({ error: 'invalid role id' });
    const colRes = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='roles' AND column_name='description'`
    );
    const hasDescription = colRes.rows.length > 0;
    const fields = hasDescription ? 'id, name, description, permissions' : 'id, name, permissions';

    const result = await db.query(`SELECT ${fields} FROM roles WHERE id = $1`, [numericId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Role not found' });
    
    const role = result.rows[0];
    role.permissions = req.user?.role === 'super_admin' ? parsePermissions(role.permissions)
      : await require('../services/clinicPermissions').effectiveForRole(role, req.user?.clinic_id);
    res.json(role);
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const normalizedName = normalizeRoleName(name);
    const canonicalName = roleCanonicalKey(name);
    if (canonicalName === 'super_admin' || canonicalName === 'admin') {
      return res.status(400).json({ error: 'Role super_admin is not allowed' });
    }
    if (await roleNameExists(canonicalName)) return res.status(409).json({ error: 'Role already exists' });
    const colRes = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='roles' AND column_name='description'`
    );
    const hasDescription = colRes.rows.length > 0;

    let result;
    if (hasDescription) {
      result = await db.query(
        `INSERT INTO roles (name, description, permissions)
         VALUES ($1, $2, $3)
         RETURNING id, name, description, permissions`,
        [normalizedName, description || '', JSON.stringify(permissions || {})]
      );
    } else {
      result = await db.query(
        `INSERT INTO roles (name, permissions)
         VALUES ($1, $2)
         RETURNING id, name, permissions`,
        [normalizedName, JSON.stringify(permissions || {})]
      );
    }
    
    const role = result.rows[0];
    role.permissions = parsePermissions(role.permissions);
    // audit
    const auditUserId = req.user && req.user.id ? parseInt(req.user.id, 10) : null;
    audit.logAudit({
      user_id: auditUserId,
      action: 'Created role',
      table_name: 'roles',
      record_id: role.id,
      new_data: role,
      ip_address: req.ip || req.connection.remoteAddress,
    });

    res.status(201).json(role);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Role already exists' });
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const policy=require('../utils/rolePermissions');
    if(policy.normalize(req.user?.role)!=='super_admin') {
      if(policy.profile(req.user?.role)!=='owner'||!Number.isInteger(Number(req.user?.clinic_id))||Number(req.user.clinic_id)<1)
        return res.status(403).json({error:'Clinic owner access required.'});
      if(Object.keys(req.body).some(key=>key!=='permissions')) return res.status(403).json({error:'Owners may configure staff permissions, not rename platform roles.'});
      if(!Number.isInteger(Number(req.params.id))||Number(req.params.id)<1)return res.status(400).json({error:'Invalid role id.'});
      const target=(await db.query('SELECT id,name,permissions FROM roles WHERE id=$1',[Number(req.params.id)])).rows[0];
      if(!target) return res.status(404).json({error:'Role not found.'});
      if(!['doctor','receptionist'].includes(policy.profile(target.name))) return res.status(403).json({error:'Only doctor and receptionist staff permissions can be configured.'});
      try {
        const permissions=await require('../services/clinicPermissions').saveOverride(req,target,req.body.permissions);
        return res.json({...target,permissions,clinic_id:req.user.clinic_id});
      } catch(error) {if(error.status)return res.status(error.status).json({error:error.message});throw error;}
    }
    const { id } = req.params;
    const numericId = parseInt(id, 10);
    if (Number.isNaN(numericId)) return res.status(400).json({ error: 'invalid role id' });
    const { name, description, permissions } = req.body;
    const colRes = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='roles' AND column_name='description'`
    );
    const hasDescription = colRes.rows.length > 0;

    const before = await db.query('SELECT * FROM roles WHERE id = $1', [numericId]);
    if (before.rows.length === 0) return res.status(404).json({ error: 'Role not found' });
    let result;
    const normalizedName = name ? normalizeRoleName(name) : null;
    const canonicalName = name ? roleCanonicalKey(name) : null;
    if (canonicalName === 'super_admin' || canonicalName === 'admin') {
      return res.status(400).json({ error: 'Role super_admin/admin is not allowed' });
    }
    // Only check for duplicate role names when the name is being changed.
const nameChanged = name && roleCanonicalKey(before.rows[0].name) !== roleCanonicalKey(name);   
    // are not blocked by canonical synonym collisions.
    if (canonicalName && nameChanged && await roleNameExistsExact(name, numericId)) {
      return res.status(409).json({ error: 'Role already exists' });
    }

    if (hasDescription) {
      result = await db.query(
        `UPDATE roles
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             permissions = COALESCE($3, permissions)
        WHERE id = $4
         RETURNING id, name, description, permissions`,
        [normalizedName || null, description, permissions ? JSON.stringify(permissions) : null, numericId]
      );
    } else {
      result = await db.query(
        `UPDATE roles
         SET name = COALESCE($1, name),
             permissions = COALESCE($2, permissions)
        WHERE id = $3
         RETURNING id, name, permissions`,
        [normalizedName || null, permissions ? JSON.stringify(permissions) : null, numericId]
      );
    }
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Role not found' });
    
    const role = result.rows[0];
    role.permissions = parsePermissions(role.permissions);
    // audit
    const auditUserId = req.user && req.user.id ? parseInt(req.user.id, 10) : null;
    audit.logAudit({
      user_id: auditUserId,
      action: 'Updated role',
      table_name: 'roles',
      record_id: numericId,
      old_data: before.rows[0] || null,
      new_data: role,
      ip_address: req.ip || req.connection.remoteAddress,
    });

    res.json(role);
 } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Role already exists' });
    next(e);
  }
};

exports.updatePermissions = async (req, res, next) => {
  try {
    const policy = require('../utils/rolePermissions');
    if (policy.profile(req.user?.role) !== 'owner' || !Number.isInteger(Number(req.user?.clinic_id)) || Number(req.user.clinic_id) < 1) {
      return res.status(403).json({ error: 'Clinic owner access required.' });
    }
    if (!req.body || Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, 'permissions')) {
      return res.status(400).json({ error: 'Provide only a permissions object.' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid role id.' });
    const target = (await db.query('SELECT id, name, permissions FROM roles WHERE id=$1', [id])).rows[0];
    if (!target) return res.status(404).json({ error: 'Role not found.' });
    if (!['doctor', 'receptionist'].includes(policy.profile(target.name))) {
      return res.status(403).json({ error: 'Only doctor and receptionist permissions can be configured.' });
    }
    const permissions = await require('../services/clinicPermissions').saveOverride(req, target, req.body.permissions);
    res.json({ ...target, permissions, clinic_id: Number(req.user.clinic_id) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);
    if (Number.isNaN(numericId)) return res.status(400).json({ error: 'invalid role id' });
    const before = await db.query('SELECT * FROM roles WHERE id = $1', [numericId]);
    const result = await db.query(`DELETE FROM roles WHERE id = $1 RETURNING id`, [numericId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Role not found' });
    const auditUserId = req.user && req.user.id ? parseInt(req.user.id, 10) : null;
    audit.logAudit({
      user_id: auditUserId,
      action: 'Deleted role',
      table_name: 'roles',
      record_id: numericId,
      old_data: before.rows[0] || null,
      new_data: null,
      ip_address: req.ip || req.connection.remoteAddress,
    });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};
