export const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not available';
};
export const statusLabel = (status: string) => ({ pending: 'Awaiting confirmation', pending_confirmation: 'Awaiting confirmation', scheduled: 'Confirmed', confirmed: 'Confirmed', checked_in: 'Checked in', in_consultation: 'In consultation', completed: 'Completed', cancelled: 'Cancelled', canceled: 'Cancelled', no_show: 'Missed', rescheduled: 'Rescheduled' }[status] || status.replace(/_/g, ' '));
export function upcomingAppointments(rows: any[], now = Date.now()): any[] {
  return rows.filter(a => !a.archived && !['completed', 'cancelled', 'canceled', 'no_show', 'rescheduled'].includes(a.status)
    && (new Date(a.start_time).getTime() >= now || ['checked_in', 'in_consultation'].includes(a.status)))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}
