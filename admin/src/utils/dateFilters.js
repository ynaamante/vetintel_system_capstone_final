export const CLINIC_TIME_ZONE = 'Asia/Manila';
export function dateFilterValue(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function dateInRange(value, from, to) {
  if (!from && !to) return true;
  const day = dateFilterValue(value);
  return Boolean(day && (!from || day >= from) && (!to || day <= to));
}
