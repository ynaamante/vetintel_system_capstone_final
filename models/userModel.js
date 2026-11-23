const db = require('../config/db');
const bcrypt = require('bcryptjs');

module.exports = {
  async getAll(clinicId, includeInactive = false, userId = null) {
    const params = [];
    let where = includeInactive ? "WHERE u.metadata->>'deleted_at' IS NULL" : 'WHERE COALESCE(u.is_active, true) = true';

    if (clinicId) {
      params.push(clinicId);
      where += ` AND u.clinic_id = $${params.length}`;
    }
    if (userId !== null) {
      params.push(userId);
      where += ` AND u.id = $${params.length}`;
    }

    const res = await db.query(
      `SELECT u.id,
              u.name,
              u.email,
              ${includeInactive ? "u.phone, u.metadata->>'position' AS position," : ''}
              u.is_active,
              u.created_at,
              u.clinic_id,
              c.name AS clinic,
              r.name AS role
       FROM users u
       LEFT JOIN clinics c ON u.clinic_id = c.id
       LEFT JOIN roles r ON u.role_id = r.id
       ${where}
       ORDER BY u.id DESC`,
      params
    );

    return res.rows;
  },

  async getByEmail(email) {
    const res = await db.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.password_hash,
              u.password_reset_at,
              u.email_verification_required,
              u.email_verified_at,
              u.must_change_password,
              u.is_active,
              u.clinic_id,
              u.role_id,
              c.name AS clinic_name,
              r.name AS role_name
       FROM users u
       LEFT JOIN clinics c ON u.clinic_id = c.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE lower(trim(u.email)) = lower(trim($1))`,
      [String(email || '')]
    );

    return res.rows[0];
  },

  async create({ name, email, password, clinic_id, role_id, phone = null, position = null, is_active = true }) {
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const res = await db.query(
      `INSERT INTO users (name, email, password_hash, clinic_id, role_id, phone, metadata, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, jsonb_strip_nulls(jsonb_build_object('position', $7::text)), $8)
       RETURNING id, name, email, clinic_id, role_id, phone, metadata->>'position' AS position, is_active, created_at`,
      [name, String(email).trim(), passwordHash, clinic_id, role_id, phone, position, is_active]
    );

    return res.rows[0];
  },
};
