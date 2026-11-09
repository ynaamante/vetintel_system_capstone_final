export const normalizeAppointmentStatus = value => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
export function appointmentStage(appointment) {
  const status = normalizeAppointmentStatus(appointment.status);
  const workflow = normalizeAppointmentStatus(appointment.workflow_type);
  if ([status, workflow].some(value => /cancel(lation)?_request/.test(value))) return 'cancellation_requested';
  if ([status, workflow].some(value => value.includes('reschedule_request'))) return 'reschedule_requested';
  if (['pending', 'pending_confirmation'].includes(status) || workflow === 'pending_confirmation') return 'pending_confirmation';
  if (['scheduled', 'confirmed', 'due', 'expected'].includes(status)) return 'expected';
  if (status === 'complete') return 'completed';
  if (status === 'canceled') return 'cancelled';
  if (status === 'noshow') return 'no_show';
  return status;
}
export const actionDefinitions = {
  confirm: ['Confirm Appointment', 'Confirm this pending booking.'],
  checkin: ['Check In', 'Record arrival and notify the assigned veterinarian.'],
  noshow: ['Mark as No Show', 'Verify attendance after the clinic grace period.'],
  reschedule: ['Reschedule', 'Choose a new appointment date and time.'],
  cancel: ['Cancel Appointment', 'Cancel this appointment and record the reason.'],
  view: ['View Details', 'See the appointment, pet, owner, and doctor information.'],
  queue: ['View Queue', 'See the patient’s position and waiting status.'],
  visit: ['View Visit', 'See permitted visit information and consultation status.'],
  follow_up: ['Schedule Follow-up', 'Create a future booking linked to this visit.'],
  rebook: ['Rebook Appointment', 'Create a new booking using this appointment’s information.'],
  request: ['Review Request', 'Track the request reason and approval status.'],
  history: ['Audit History', 'Review recorded activity and changes for this appointment.'],
};
export function appointmentActions(appointment) {
  return ({
    pending_confirmation: ['confirm', 'reschedule', 'cancel', 'view', 'history'],
    expected: ['checkin', 'noshow', 'reschedule', 'cancel', 'view', 'history'],
    checked_in: ['view', 'queue', 'reschedule', 'history'],
    in_consultation: ['visit', 'view', 'history'],
    completed: ['visit', 'view', 'follow_up', 'history'],
    cancelled: ['view', 'rebook', 'history'],
    no_show: ['view', 'rebook', 'history'],
    reschedule_requested: ['request', 'view', 'history'],
    cancellation_requested: ['request', 'view', 'history'],
  })[appointmentStage(appointment)] || ['view', 'history'];
}
