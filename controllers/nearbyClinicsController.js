const db = require('../config/db');
const { coordinate, directoryClinic } = require('../utils/nearbyClinics');

exports.list = async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    const latitude = coordinate(lat, 90);
    const longitude = coordinate(lon, 180);
    if ((lat !== undefined || lon !== undefined) && (latitude === null || longitude === null)) {
      return res.status(400).json({ error: 'Provide valid latitude and longitude.' });
    }
    const origin = latitude !== null && longitude !== null ? { latitude, longitude } : null;
    const result = await db.query(`
      SELECT id, name, address, phone, metadata FROM clinics
      WHERE COALESCE(archived, false) = false
        AND lower(COALESCE(metadata->>'status', 'active')) = 'active'
      ORDER BY name ASC
    `);
    const rows = result.rows.map(row => directoryClinic(row, origin));
    rows.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity) || a.name.localeCompare(b.name));
    res.json(rows);
  } catch (error) { next(error); }
};
