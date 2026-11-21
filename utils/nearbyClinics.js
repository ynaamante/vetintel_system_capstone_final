const coordinate = (value, limit) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
};
const distanceKm = (a, b) => {
  const radians = degrees => degrees * Math.PI / 180;
  const deltaLat = radians(b.latitude - a.latitude);
  const deltaLon = radians(b.longitude - a.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
};
const enabled = value => value === true || value === 'true';
const directoryClinic = (row, origin) => {
  const metadata = row.metadata || {};
  const latitude = coordinate(metadata.latitude ?? metadata.location?.latitude ?? metadata.lat, 90);
  const longitude = coordinate(metadata.longitude ?? metadata.location?.longitude ?? metadata.lng ?? metadata.lon, 180);
  return {
    id: row.id, name: row.name, address: row.address, phone: row.phone,
    is_connected: true,
    emergency_care: enabled(metadata.emergency_care) || enabled(metadata.emergencyCare) || enabled(metadata.is_emergency),
    latitude, longitude,
    distance_km: origin && latitude !== null && longitude !== null ? distanceKm(origin, { latitude, longitude }) : null,
  };
};
module.exports = { coordinate, distanceKm, directoryClinic };
