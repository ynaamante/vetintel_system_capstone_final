const assert = require('node:assert/strict');
const { test } = require('node:test');
const { coordinate, distanceKm, directoryClinic } = require('../utils/nearbyClinics');

test('coordinates accept the equator and reject incomplete or out-of-range values', () => {
  assert.equal(coordinate('0', 90), 0);
  for (const value of ['', ' ', null, undefined, 'NaN', Infinity, '91', '-91']) assert.equal(coordinate(value, 90), null);
  assert.equal(coordinate('180', 180), 180);
});
test('distance handles identical points and crossing the international date line', () => {
  assert.equal(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  const km = distanceKm({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 });
  assert.ok(km > 22 && km < 23);
});
test('directory keeps missing contact details and unknown location without inventing distance or emergency care', () => {
  const row = directoryClinic({ id: 1, name: 'Clinic', address: null, phone: null, metadata: {} }, { latitude: 0, longitude: 0 });
  assert.equal(row.distance_km, null);
  assert.equal(row.latitude, null);
  assert.equal(row.emergency_care, false);
  assert.equal(row.phone, null);
  assert.equal(directoryClinic({ metadata: { emergency_care: 'false' } }).emergency_care, false);
});
test('directory reads stored location and explicitly recorded emergency service', () => {
  const row = directoryClinic({ id: 2, name: 'Emergency Clinic', metadata: { emergency_care: true, location: { latitude: 0, longitude: 0 } } }, { latitude: 0, longitude: 0 });
  assert.equal(row.emergency_care, true);
  assert.equal(row.distance_km, 0);
});

test('nearby API validates input, orders known distances first, and forwards database errors', async () => {
  const db = require('../config/db');
  const original = db.query;
  const controller = require('../controllers/nearbyClinicsController');
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  try {
    let queried = false;
    db.query = async () => { queried = true; return { rows: [{ id: 1, name: 'Unknown', metadata: {} }, { id: 2, name: 'Farther', metadata: { latitude: 1, longitude: 0 } }, { id: 3, name: 'Closer', metadata: { latitude: 0, longitude: 0 } }] }; };
    const invalid = response();
    await controller.list({ query: { lat: '91', lon: '0' } }, invalid, error => { throw error; });
    assert.equal(invalid.statusCode, 400);
    assert.equal(queried, false);
    const valid = response();
    await controller.list({ query: { lat: '0', lon: '0' } }, valid, error => { throw error; });
    assert.deepEqual(valid.body.map(row => row.id), [3, 2, 1]);
    const failure = new Error('Database unavailable');
    db.query = async () => { throw failure; };
    let forwarded;
    await controller.list({ query: {} }, response(), error => { forwarded = error; });
    assert.equal(forwarded, failure);
  } finally { db.query = original; await db.pool.end(); }
});
