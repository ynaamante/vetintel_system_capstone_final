import ReminderDetailsModal from './ReminderDetailsModal';
import FilterSelect from '../../components/FilterSelect';
import { reminderFilterOptions } from '../../utils/reminderFilterOptions';
import { dateFilterValue, dateInRange } from '../../utils/dateFilters';
import { Fragment, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Topbar from '../../components/Topbar';
import DateRangeFilter from '../../components/DateRangeFilter';
import ClinicAttachmentImage from '../../components/ClinicAttachmentImage';
import StatusIndicator from '../../components/StatusIndicator';
import { canViewFeature } from '../../utils/permissionUtils';
import { formatDateText, formatDateTimeText } from '../../utils/dateFormatting';
import './remindersPage.css';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REMINDERS_PAGE_SIZE = 5;

function reminderStatus(reminder, now = new Date()) {
  if (reminder.sent_at || reminder.delivered) return 'completed';

  const dueDate = reminder.scheduled_at ? new Date(reminder.scheduled_at) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime())) return 'scheduled';

  const today = Date.parse(dateFilterValue(now) + 'T00:00:00Z');
  const dueDay = Date.parse(dateFilterValue(dueDate) + 'T00:00:00Z');
  const daysUntilDue = Math.round((dueDay - today) / DAY_IN_MS);

  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 7) return 'due-soon';
  return 'upcoming';
}

function reminderTypeLabel(type) {
  return String(type || 'Reminder')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

function dateDistance(value) {
  if (!value) return '';
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return '';
  const today = new Date();
  const todayDay = Date.parse(dateFilterValue(today) + 'T00:00:00Z');
  const dueDay = Date.parse(dateFilterValue(dueDate) + 'T00:00:00Z');
  const days = Math.round((dueDay - todayDay) / DAY_IN_MS);

  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

export default function RemindersPage({ user, onNavigate }) {
  const [reminders, setReminders] = useState([]);
  const [activeView, setActiveView] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [appointmentFilter, setAppointmentFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [filterOptions, setFilterOptions] = useState({ doctors: [], appointment_types: [] });
  const [filterError, setFilterError] = useState('');
  const [metadata, setMetadata] = useState({ counts: { all: 0, overdue: 0, 'due-soon': 0, upcoming: 0, completed: 0 }, filters: { doctors: [], appointment_types: [] }, total: 0 });

  const canView = canViewFeature(user.permissions, user.role, 'Due Dates & Reminders');

  useEffect(() => {
    if (!user?.token || !canView) return;
    const controller = new AbortController();
    const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const query = '?clinic_id=' + encodeURIComponent(user.clinic_id || '');
    const get = async path => {
      const response = await fetch(api + path + query, { headers: { Authorization: 'Bearer ' + user.token }, signal: controller.signal });
      const rows = await response.json(); if (!response.ok) throw new Error(rows.error || 'Unable to load reminder filter options.');
      if (!Array.isArray(rows)) throw new Error('Invalid reminder filter options response.'); return rows;
    };
    Promise.allSettled([get('/users'), get('/clinic-records/billing-catalog'), get('/clinic-records/appointments')]).then(results => {
      if (controller.signal.aborted) return;
      const arrays = results.map(result => result.status === 'fulfilled' ? result.value : []);
      setFilterOptions(reminderFilterOptions(...arrays));
      setFilterError(results.some(result => result.status === 'rejected') ? 'Some filter options could not be loaded. Refresh to try again.' : '');
    });
    return () => controller.abort();
  }, [user?.token, user?.clinic_id, canView, revision]);

  useEffect(() => {
    const refresh = () => { if (!document.hidden) setRevision(value => value + 1); };
    window.addEventListener('vetintel:appointment-updated', refresh);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('vetintel:appointment-updated', refresh); };
  }, []);
  useEffect(() => {
    if (!user?.token || !canView) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ include_filters: 'true', status: statusFilter, doctor: doctorFilter, appointment_type: appointmentFilter });
    if (user.clinic_id) params.set('clinic_id', user.clinic_id);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    if (search.trim()) params.set('search', search.trim());
    const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    setLoading(true); setError('');
    const timer = window.setTimeout(() => {
      fetch(api + '/clinic-records/reminders?' + params, { headers: { Authorization: 'Bearer ' + user.token }, signal: controller.signal })
        .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load reminders.'); if (!controller.signal.aborted) {
          const rows = Array.isArray(data) ? data : data.reminders;
          if (!Array.isArray(rows)) throw new Error('Invalid reminders response.');
          setReminders(rows);
          const counts = rows.reduce((values,row) => { values.all++; const status = reminderStatus(row); values[status] = (values[status] || 0) + 1; return values; }, {all:0,overdue:0,'due-soon':0,upcoming:0,completed:0});
          setMetadata({ counts: data.counts || counts, filters: data.filters || {doctors:[],appointment_types:[]}, total: data.total ?? rows.length });
        } })
        .catch(failure => { if (!controller.signal.aborted) { setError(failure.message); setReminders([]); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 150);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [user?.token, user?.clinic_id, canView, statusFilter, doctorFilter, appointmentFilter, fromDate, toDate, search, revision]);
  const counts = metadata.counts;
  const doctors = [...new Set([...filterOptions.doctors, ...(metadata.filters?.doctors || []), ...reminders.map(row => row.doctor).filter(Boolean)])].sort((a,b) => a.localeCompare(b));
  const appointmentTypes = [...new Set([...filterOptions.appointment_types, ...(metadata.filters?.appointment_types || []), ...reminders.map(row => row.appointment_type).filter(Boolean)])].sort((a,b) => a.localeCompare(b));

  const filteredReminders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reminders.filter(reminder => {
      const status = reminderStatus(reminder);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (doctorFilter !== 'all' && reminder.doctor !== doctorFilter) return false;
      if (appointmentFilter !== 'all' && reminder.appointment_type !== appointmentFilter) return false;
      if (!dateInRange(reminder.scheduled_at, fromDate, toDate)) return false;
      if (!query) return true;

      return [
        reminder.pet,
        reminder.owner,
        reminder.email,
        reminder.phone,
        reminder.doctor,
        reminder.appointment_type,
        reminder.message,
      ].some(value => String(value || '').toLowerCase().includes(query));
    });
  }, [reminders, statusFilter, doctorFilter, appointmentFilter, fromDate, toDate, search]);

  const statusTabs = [
    { id: 'all', label: 'All Reminders' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'due-soon', label: 'Due Soon' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'completed', label: 'Completed' },
  ];

  const viewReminders = useMemo(() => (
    activeView === 'history'
      ? filteredReminders.filter(reminder => reminder.last_reminder_at || reminder.sent_at || reminder.delivered)
      : filteredReminders
  ), [activeView, filteredReminders]);
  const pageCount = Math.max(1, Math.ceil(viewReminders.length / REMINDERS_PAGE_SIZE));
  const pageStart = viewReminders.length ? (currentPage - 1) * REMINDERS_PAGE_SIZE : 0;
  const pageReminders = viewReminders.slice(pageStart, pageStart + REMINDERS_PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeView, statusFilter, doctorFilter, appointmentFilter, fromDate, toDate, search]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  if (!canView) {
    return (
      <div className="reminders-page">
        <Topbar user={user} title="Due Dates & Reminders" />
        <main className="reminders-content">
          <section className="reminders-card reminders-access-denied">
            <h2>Access denied</h2>
            <p>Your role ({user.role}) does not currently have permission to view reminders.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="reminders-page">
      <Topbar user={user} title="Due Dates & Reminders" />
      <main className="reminders-content">
        <p className="reminders-intro">Monitor and manage vaccination, medication, and follow-up reminders.</p>
        <div className="reminders-toolbar">
          <div className="reminders-view-tabs" role="tablist" aria-label="Reminder views">
            {[
              { id: 'all', label: 'All Reminders' },
              { id: 'history', label: 'Reminder History' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={activeView === item.id}
                className={`reminders-view-tab${activeView === item.id ? ' is-active' : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="reminders-bulk-button" disabled title="Bulk reminder sending is not available yet.">
            Send Bulk Reminders
          </button>
        </div>

        <section className="reminders-filters" aria-label="Reminder filters">
          <label className="reminders-search">
            <svg className="reminders-search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by pet, owner, or description..."
              aria-label="Search reminders"
            />
          </label>
          <span className="reminders-filter-divider" aria-hidden="true" />
          <div className="reminders-select-wrap"><FilterSelect className="reminders-filter-select" label="Filter by doctor" value={doctorFilter} onChange={setDoctorFilter} options={[{value:'all',label:'All Doctors'}, ...doctors.map(doctor => ({value:doctor,label:doctor}))]} /></div>
          <div className="reminders-select-wrap"><FilterSelect className="reminders-filter-select" label="Filter by appointment type" value={appointmentFilter} onChange={setAppointmentFilter} options={[{value:'all',label:'All Appointment Types'}, ...appointmentTypes.map(type => ({value:type,label:reminderTypeLabel(type)}))]} /></div>
          <DateRangeFilter
            dateFrom={fromDate}
            dateTo={toDate}
            onDateFromChange={setFromDate}
            onDateToChange={setToDate}
            label="Filter reminders by due date"
            emptyLabel="Date Range"
            className="reminders-date-range"
          />
        </section>

        <div className="reminders-status-filters" role="group" aria-label="Filter reminders by status">
          {statusTabs.map(item => (
            <button
              key={item.id}
              type="button"
              aria-pressed={statusFilter === item.id}
              className={`reminders-status-filter${statusFilter === item.id ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(item.id)}
            >
              {item.label} ({counts[item.id]})
            </button>
          ))}
        </div>

        {filterError && <p className="reminders-filter-error" role="status">{filterError}</p>}
        <section className="reminders-card">
          <div className="reminders-card-heading">
            <h2>{activeView === 'history' ? 'Reminder History' : 'All Reminders'} ({viewReminders.length})</h2>
          </div>
          {error ? (
            <div className="reminders-message is-error" role="alert">{error}</div>
          ) : loading ? (
            <div className="reminders-message" role="status">Loading reminders…</div>
          ) : (
            <div className="reminders-table-scroll">
              <table className="reminders-table">
                <thead>
                  <tr>
                    <th scope="col">Pet &amp; Owner</th>
                    <th scope="col">Reminder Type</th>
                    <th scope="col">Description</th>
                    <th scope="col">Due Date</th>
                    <th scope="col">Status</th>
                    <th scope="col">Last Reminder</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageReminders.map((reminder, index) => {
                    const status = reminderStatus(reminder);
                    return (
                      <Fragment key={reminder.id || `${reminder.pet}-${index}`}>
                      <tr
                        className="reminders-clickable-row"
                        tabIndex={0}
                        aria-label={`View ${reminder.pet || 'pet'} reminder details`}
                        onClick={event => { if (!event.target.closest('button, a, input, select, textarea')) setSelectedReminderId(reminder.id); }}
                        onKeyDown={event => {
                          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            setSelectedReminderId(reminder.id);
                          }
                        }}
                      >
                        <td>
                          <div className="reminders-pet-cell">
                            <span className="reminders-avatar">
                              <ClinicAttachmentImage
                                attachmentId={reminder.pet_photo_attachment_id}
                                user={user}
                                alt=""
                                style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }}
                                fallback={<span className="reminders-avatar-fallback">{String(reminder.pet || '?').trim().slice(0, 1).toUpperCase()}</span>}
                              />
                            </span>
                            <span className="reminders-pet-copy">
                              <strong>{reminder.pet || 'Unknown pet'}</strong>
                              <span>{reminder.owner || 'Owner not listed'}</span>
                              {reminder.phone && <span>{reminder.phone}</span>}
                            </span>
                          </div>
                        </td>
                        <td>
                          <StatusIndicator
                            status="active"
                            label={reminderTypeLabel(reminder.type)}
                            className="reminders-system-indicator reminders-type-indicator"
                          />
                        </td>
                        <td className="reminders-description">{reminder.message || reminder.appointment_type || 'No description provided'}</td>
                        <td className="reminders-due-date">
                          <strong>{formatDateText(reminder.scheduled_at, undefined, 'Date not set')}</strong>
                          {dateDistance(reminder.scheduled_at) && (
                            <StatusIndicator
                              status={status}
                              label={dateDistance(reminder.scheduled_at)}
                              className="reminders-system-indicator reminders-date-status"
                            />
                          )}
                        </td>
                        <td>
                          <StatusIndicator
                            status={status}
                            label={status === 'due-soon' ? 'Due Soon' : reminderTypeLabel(status)}
                            className="reminders-system-indicator"
                          />
                        </td>
                        <td className="reminders-last-sent">
                          {reminder.last_reminder_at ? <><span>{formatDateTimeText(reminder.last_reminder_at)}</span><span>{reminderTypeLabel(reminder.last_reminder_channel)} &middot; {reminderTypeLabel(reminder.notification_status)}</span></> : reminder.sent_at ? formatDateTimeText(reminder.sent_at) : reminder.delivered ? 'Delivered' : 'Not sent'}
                        </td>
                        <td className="reminders-actions">
                          <button
                            type="button"
                            aria-label={`View ${reminder.pet || 'pet'} reminder details`}
                            aria-haspopup="dialog"
                            onClick={() => setSelectedReminderId(reminder.id)}
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                      </Fragment>
                    );
                  })}
                  {!viewReminders.length && (
                    <tr><td className="reminders-empty" colSpan={7}>{activeView === 'history' ? 'No reminder history matches these filters.' : reminders.length ? 'No reminders match these filters.' : 'No reminders to show yet.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="reminders-pagination">
            <span>
              Showing {viewReminders.length ? pageStart + 1 : 0}–{Math.min(pageStart + REMINDERS_PAGE_SIZE, viewReminders.length)} of {viewReminders.length} reminders
            </span>
            <div className="reminders-pagination-controls">
              <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}>‹</button>
              <span>{currentPage}</span>
              <button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))}>›</button>
            </div>
          </div>
        </section>
      </main>
      {selectedReminderId !== null && <ReminderDetailsModal key={selectedReminderId} reminderId={selectedReminderId} user={user} onClose={() => setSelectedReminderId(null)} onSaved={() => setRevision(value => value + 1)} onViewPatient={petId => { setSelectedReminderId(null); onNavigate?.('patient-records', {pet_id:petId}); }} onOpenSchedule={() => { setSelectedReminderId(null); onNavigate?.('schedule'); }} />}
    </div>
  );
}

RemindersPage.propTypes = {
  onNavigate: PropTypes.func,
  user: PropTypes.shape({
    clinic_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    permissions: PropTypes.object,
    role: PropTypes.string,
    token: PropTypes.string,
  }).isRequired,
};
