const db = require('../config/db');

exports.list = async (req, res, next) => {
  try {
    // Join users to include a friendly user display name for the frontend
    const result = await db.query(`
      SELECT a.id, a.user_id, a.action, a.table_name, a.record_id, a.old_data, a.new_data, a.ip_address, a.created_at,
             u.name, u.email
      FROM audit_trail a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE COALESCE(a.archived, false) = false
      ORDER BY a.created_at DESC
      LIMIT 100
    `);

    const rows = result.rows.map((row) => {
      const newData = row.new_data || {};
      const oldData = row.old_data || {};
      const userDisplay = row.name || row.email || null;

      // Build friendly fields expected by frontend
      const details = newData.title || newData.name || newData.key || JSON.stringify(newData || {});
      const clinic = newData.clinic_id || oldData.clinic_id || null;

      return {
        id: row.id,
        user_id: row.user_id,
        user: userDisplay,
        action: row.action,
        details,
        clinic,
        category: row.table_name,
        timestamp: row.created_at,
        ip_address: row.ip_address,
        record_id: row.record_id,
        old_data: oldData,
        new_data: newData,
        severity: 'info',
        role: newData._audit?.role || null,
        reason: newData._audit?.reason || null,
        previousValue: oldData.status ?? oldData.value ?? null,
        newValue: newData.status ?? newData.value ?? null,
      };
    });

    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.getByFilter = async (req, res, next) => {
  try {
    const { user_id, action, table_name, record_id, days, clinic_id } = req.query;
        let query = `
          SELECT a.id, a.user_id, a.action, a.table_name, a.record_id, a.old_data, a.new_data, a.ip_address, a.created_at,
            u.name, u.email
          FROM audit_trail a
          LEFT JOIN users u ON u.id = a.user_id
          WHERE COALESCE(a.archived, false) = false`;
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

    if (clinic_id) {
      paramCount++;
      query += ` AND (
        a.new_data->>'clinic_id' = $${paramCount}
        OR a.old_data->>'clinic_id' = $${paramCount}
        OR (
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
      query += ` AND a.created_at > now() - interval '${parseInt(days, 10)} days'`;
    }

    query += ' ORDER BY a.created_at DESC LIMIT 500';
    const result = await db.query(query, params);

    const rows = result.rows.map((row) => {
      const newData = row.new_data || {};
      const oldData = row.old_data || {};
      const userDisplay = row.name || row.email || null;
      const details = newData.title || newData.name || newData.key || JSON.stringify(newData || {});
      const clinic = newData.clinic_id || oldData.clinic_id || null;
      return {
        id: row.id,
        user_id: row.user_id,
        user: userDisplay,
        action: row.action,
        details,
        clinic,
        category: row.table_name,
        timestamp: row.created_at,
        ip_address: row.ip_address,
        record_id: row.record_id,
        old_data: oldData,
        new_data: newData,
        severity: 'info',
        role: newData._audit?.role || null,
        reason: newData._audit?.reason || null,
        previousValue: oldData.status ?? oldData.value ?? null,
        newValue: newData.status ?? newData.value ?? null,
      };
    });

    res.json(rows);
  } catch (e) {
    next(e);
  }
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
