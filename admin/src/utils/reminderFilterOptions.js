const roleName = value => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
// Supported workflow categories are reference options, even before a clinic has appointments.
export const SUPPORTED_APPOINTMENT_TYPES = ['Check-up', 'Follow-up', 'Vaccination', 'Treatment', 'Laboratory', 'Surgery', 'Dental', 'Confinement', 'Grooming', 'General'];
export function appointmentCategory(value) {
  const raw = String(value || '').trim();
  const key = roleName(raw);
  return ({ consultation: 'Check-up', check_up: 'Check-up', inpatient: 'Confinement', lab_test: 'Laboratory', medication: 'Treatment', vaccination: 'Vaccination', treatment: 'Treatment', follow_up: 'Follow-up' })[key] || raw;
}
export function reminderFilterOptions(staff = [], catalog = [], appointments = []) {
  const doctors = staff.filter(row => row.is_active !== false && ['doctor','assistant_doctor','veterinarian'].includes(roleName(row.role || row.role_name))).map(row => row.name).filter(Boolean);
  const types = [...SUPPORTED_APPOINTMENT_TYPES, ...catalog.filter(row => row.active !== false && row.item_type !== 'product' && !['product','inventory'].includes(row.catalog_kind))
    .map(row => appointmentCategory(row.category || row.item_type)).filter(Boolean)];
  for (const row of appointments) {
    if (row.archived) continue;
    if (row.practitioner) doctors.push(row.practitioner);
    let notes = row.notes || {};
    if (typeof notes === 'string') { try { notes = JSON.parse(notes); } catch { notes = {}; } }
    const type = row.appointment_type || notes.service_category || notes.appointment_type;
    if (type) types.push(appointmentCategory(type));
  }
  return { doctors: [...new Set(doctors)].sort((a,b) => a.localeCompare(b)), appointment_types: [...new Set(types)].sort((a,b) => a.localeCompare(b)) };
}
