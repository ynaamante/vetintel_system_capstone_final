const bcrypt = require('bcryptjs');
const db = require('../config/db');
const userModel = require('../models/userModel');
const audit = require('../utils/audit');

exports.list = async (req, res, next) => {
  try {
    const explicitClinicId = req.query.clinic_id ? parseInt(req.query.clinic_id, 10) : null;
    const userClinicId = req.user && req.user.clinic_id ? parseInt(req.user.clinic_id, 10) : null;
    let clinicId = userClinicId || null;

    if (explicitClinicId && req.user && req.user.role === 'super_admin') {
      clinicId = explicitClinicId;
    }

    const users = await userModel.getAll(clinicId);
    res.json(users);
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, email, password, clinic_id, clinic_name, role_id, role_name } = req.body;
    const normalizedEmail = String(email || '').trim();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ error: 'name, email and password required' });
    }

    let resolvedClinicId = clinic_id;
    if (!resolvedClinicId) {
      if (!clinic_name) {
        return res.status(400).json({ error: 'clinic_id or clinic_name is required' });
      }

      const clinicResult = await db.query('SELECT id FROM clinics WHERE name = $1', [clinic_name]);
      if (clinicResult.rows.length === 0) {
        return res.status(400).json({
          error: 'Clinic must be created first before assigning a role to the user',
        });
      }
      resolvedClinicId = clinicResult.rows[0].id;
    } else {
      const clinicResult = await db.query('SELECT id FROM clinics WHERE id = $1', [resolvedClinicId]);
      if (clinicResult.rows.length === 0) {
        return res.status(400).json({
          error: 'Clinic not found. Create the clinic first before assigning a user to it.',
        });
      }
    }

    let resolvedRoleId = role_id;
    if (!resolvedRoleId) {
      if (!role_name) {
        return res.status(400).json({ error: 'role_id or role_name is required' });
      }

      const roleResult = await db.query(
        'SELECT id FROM roles WHERE lower(name) = lower($1) LIMIT 1',
        [role_name]
      );
      if (roleResult.rows.length === 0) {
        return res.status(400).json({ error: 'Role does not exist. Please create the role before assigning it.' });
      }
      resolvedRoleId = roleResult.rows[0].id;
    } else {
      const roleResult = await db.query('SELECT id FROM roles WHERE id = $1', [resolvedRoleId]);
      if (roleResult.rows.length === 0) {
        return res.status(400).json({ error: 'Role not found. Create the role before assigning it.' });
      }
    }

    const selectedRole = await db.query('SELECT name FROM roles WHERE id = $1', [resolvedRoleId]);
    const selectedRoleName = String(selectedRole.rows[0]?.name || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (selectedRoleName === 'owner' || selectedRoleName === 'clinic_owner' || selectedRoleName === 'super_admin') {
      return res.status(400).json({ error: 'Staff accounts must use an approved staff role' });
    }

    const user = await userModel.create({
      name,
      email: normalizedEmail,
      password,
      clinic_id: resolvedClinicId,
      role_id: resolvedRoleId,
    });

    const auditUserId = req.user && req.user.id ? parseInt(req.user.id, 10) : null;
    audit.logAudit({
      user_id: auditUserId,
      action: 'Created user',
      table_name: 'users',
      record_id: user.id,
      new_data: user,
      ip_address: req.ip || req.connection.remoteAddress,
    });

    res.status(201).json(user);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'email already exists' });
    next(e);
  }
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role_name } = req.body;

    if (!name || !email || !password || String(password).length < 8) {
      return res.status(400).json({
        error: 'Name, email, and a password of at least 8 characters are required',
      });
    }

    let roleId = null;
    if (role_name === 'clinic_owner') {
      const roleResult = await db.query(
        'SELECT id FROM roles WHERE lower(name) = $1 LIMIT 1',
        ['clinic_owner']
      );
      roleId = roleResult.rows[0] ? roleResult.rows[0].id : null;
    }

    const user = await userModel.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password,
      role_id: roleId,
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      message: 'Account created successfully',
    });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'email already exists' });
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);

    if (Number.isNaN(numericId)) {
      return res.status(400).json({ error: 'invalid user id' });
    }

    const { name, email, clinic_id, clinic_name, role_id, role_name, is_active, password } = req.body;

    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [numericId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let resolvedClinicId = clinic_id;
    if (!resolvedClinicId && clinic_name) {
      const clinicResult = await db.query('SELECT id FROM clinics WHERE name = $1', [clinic_name]);
      if (clinicResult.rows.length === 0) {
        return res.status(400).json({
          error: 'Clinic must be created first before assigning a role to the user',
        });
      }
      resolvedClinicId = clinicResult.rows[0].id;
    }

    let resolvedRoleId = role_id;
    if (!resolvedRoleId && role_name) {
      const roleResult = await db.query(
        'SELECT id FROM roles WHERE lower(name) = lower($1) LIMIT 1',
        [role_name]
      );
      if (roleResult.rows.length === 0) {
        return res.status(400).json({
          error: 'Role does not exist. Please create the role before assigning it.',
        });
      }
      resolvedRoleId = roleResult.rows[0].id;
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await db.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           clinic_id = COALESCE($3, clinic_id),
           role_id = COALESCE($4, role_id),
           is_active = COALESCE($5, is_active),
           password_hash = COALESCE($6, password_hash),
           updated_at = now()
       WHERE id = $7
       RETURNING id`,
      [name, email, resolvedClinicId, resolvedRoleId, is_active, passwordHash, numericId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await db.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.is_active,
              u.created_at,
              u.updated_at,
              c.name AS clinic,
              r.name AS role
       FROM users u
       LEFT JOIN clinics c ON u.clinic_id = c.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [numericId]
    );

    const auditUserId = req.user && req.user.id ? parseInt(req.user.id, 10) : null;
    audit.logAudit({
      user_id: auditUserId,
      action: 'Updated user',
      table_name: 'users',
      record_id: numericId,
      old_data: userResult.rows[0],
      new_data: updatedUser.rows[0],
      ip_address: req.ip || req.connection.remoteAddress,
    });

    res.json(updatedUser.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'email already exists' });
    next(e);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);

    if (Number.isNaN(numericId)) {
      return res.status(400).json({ error: 'invalid user id' });
    }

    const before = await db.query('SELECT * FROM users WHERE id = $1', [numericId]);
    const result = await db.query(
      `UPDATE users
       SET is_active = false,
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('deleted_at', now()::text),
           updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [numericId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const auditUserId = req.user && req.user.id ? parseInt(req.user.id, 10) : null;
    audit.logAudit({
      user_id: auditUserId,
      action: 'Soft deleted user',
      table_name: 'users',
      record_id: numericId,
      old_data: before.rows[0] || null,
      new_data: { is_active: false },
      ip_address: req.ip || req.connection.remoteAddress,
    });

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

exports.restore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);

    if (Number.isNaN(numericId)) {
      return res.status(400).json({ error: 'invalid user id' });
    }

    const before = await db.query('SELECT * FROM users WHERE id = $1', [numericId]);
    const result = await db.query(
      `UPDATE users
       SET is_active = true,
           metadata = coalesce(metadata, '{}'::jsonb) - 'deleted_at',
           updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [numericId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await db.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.is_active,
              u.created_at,
              u.updated_at,
              c.name AS clinic,
              r.name AS role
       FROM users u
       LEFT JOIN clinics c ON u.clinic_id = c.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [numericId]
    );

    const auditUserId = req.user && req.user.id ? parseInt(req.user.id, 10) : null;
    audit.logAudit({
      user_id: auditUserId,
      action: 'Restored user',
      table_name: 'users',
      record_id: numericId,
      old_data: before.rows[0] || null,
      new_data: updatedUser.rows[0],
      ip_address: req.ip || req.connection.remoteAddress,
    });

    res.json(updatedUser.rows[0]);
  } catch (e) {
    next(e);
  }
};

exports.permanentDelete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);

    if (Number.isNaN(numericId)) {
      return res.status(400).json({ error: 'invalid user id' });
    }

    const before = await db.query('SELECT * FROM users WHERE id = $1', [numericId]);
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [numericId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const auditUserId = req.user && req.user.id ? parseInt(req.user.id, 10) : null;
    audit.logAudit({
      user_id: auditUserId,
      action: 'Permanently deleted user',
      table_name: 'users',
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

const auth = require('../middleware/auth');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const user = await userModel.getByEmail(normalizedEmail);
    if (!user || user.is_active === false) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = user.password_hash && await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const resolvedRole =
      (user.role_name || user.role) ||
      (process.env.SUPERADMIN_EMAIL && user.email === process.env.SUPERADMIN_EMAIL
        ? 'super_admin'
        : 'user');

    const token = auth.signUserToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: resolvedRole,
      clinic_id: user.clinic_id,
      clinic_name: user.clinic_name,
      must_change_password: user.must_change_password === true,
      exp: Date.now() + 1000 * 60 * 60 * 24,
      iat: Date.now(),
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: resolvedRole,
      clinic_id: user.clinic_id,
      clinic_name: user.clinic_name,
      must_change_password: user.must_change_password === true,
      token,
    });
  } catch (e) {
    next(e);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({
        error: 'Current password and a new password of at least 8 characters are required',
      });
    }

    const user = await userModel.getByEmail(req.user.email);
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [passwordHash, req.user.id]
    );

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

exports.me = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      clinic_id: req.user.clinic_id,
      clinic_name: req.user.clinic_name,
      permissions: req.user.permissions,
    });
  } catch (e) {
    next(e);
  }
};