import defaults from '../../../data/appointmentDurationDefaults.json';

// Catalog durations are minutes, optionally expressed in hours and minutes.
export function parseServiceDuration(value) {
  const text = String(value ?? '').trim().toLowerCase();
  const match = text.match(/^(?:(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*)?(?:(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)?)?$/);
  if (!match || (!match[1] && !match[2])) return null;
  const minutes = Number(match[1] || 0) * 60 + Number(match[2] || 0);
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 1440 ? minutes : null;
}

export function appointmentDuration(service, type) {
  return parseServiceDuration(service?.duration) ?? defaults[type] ?? 30;
}
