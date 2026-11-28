const doctorRoles = new Set(['doctor', 'assistant_doctor', 'veterinarian']);
const normalize = role => String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const clinicDate = value => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const parsed = new Date(date + 'T00:00:00+08:00');
  return Number.isFinite(parsed.getTime()) && clinicDate(parsed) === date;
}
async function loadAvailability(db, clinicId, date, now = Date.now()) {
  if (!validDate(date)) throw Object.assign(new Error('Choose a valid preferred date.'), { status: 422 });
  const doctors = (await db.query(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
    WHERE u.clinic_id=$1 AND COALESCE(u.is_active,true)=true
      AND lower(regexp_replace(trim(r.name),'[[:space:]-]+','_','g')) IN ('doctor','assistant_doctor','veterinarian')
    ORDER BY u.id`, [clinicId])).rows;
  const from = new Date(date + 'T00:00:00+08:00');
  const to = new Date(from.getTime() + 86400000);
  const appointments = (await db.query(`SELECT id,practitioner_id,start_time,end_time FROM appointments
    WHERE clinic_id=$1 AND COALESCE(archived,false)=false
      AND status::text NOT IN ('completed','cancelled','canceled','no_show','rescheduled')
      AND start_time < $3 AND COALESCE(end_time,start_time + interval '30 minutes') > $2`,
    [clinicId, from.toISOString(), to.toISOString()])).rows;
  const slots = [];
  for (let minute = 8 * 60; minute < 20 * 60; minute += 30) {
    const hour = Math.floor(minute / 60), mins = minute % 60;
    const start = new Date(date + 'T' + String(hour).padStart(2,'0') + ':' + String(mins).padStart(2,'0') + ':00+08:00');
    const end = new Date(start.getTime() + 1800000);
    if (start.getTime() <= now) continue;
    const freeDoctors = doctors.filter(doctor => !appointments.some(row =>
      (row.practitioner_id == null || Number(row.practitioner_id) === Number(doctor.id))
      && new Date(row.start_time) < end && new Date(row.end_time || new Date(row.start_time).getTime() + 1800000) > start));
    if (freeDoctors.length) slots.push({
      start_time: start.toISOString(), end_time: end.toISOString(),
      label: (hour % 12 || 12) + ':' + String(mins).padStart(2,'0') + (hour < 12 ? ' AM' : ' PM'),
      doctor_id: freeDoctors[0].id,
    });
  }
  return slots;
}
module.exports = { loadAvailability, clinicDate, validDate, doctorRoles, normalize };
