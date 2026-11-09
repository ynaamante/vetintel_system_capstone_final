import { dateFilterValue } from '../../utils/dateFilters';
import { useEffect, useMemo, useRef, useState } from 'react';
import RecordActionsModal from '../../components/RecordActionsModal';
import StatusIndicator from '../../components/StatusIndicator';
import DateRangePopoverFields from '../../components/DateRangePopoverFields';
import { appointmentActions, appointmentStage, actionDefinitions } from '../../utils/appointmentActions';
import AppointmentWorkflowDialog, { appointmentRequest } from './AppointmentWorkflowDialog';
import Topbar from '../../components/Topbar';
import LabDateTimePicker, { getUnavailableAppointmentTimes } from '../../components/LabDateTimePicker';
import { Icons } from '../../icons';
import { canViewFeature } from '../../utils/permissionUtils';

const localDateValue = (value = new Date()) => dateFilterValue(value);

function formatSelectedDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatClock(value) {
  return value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
}

function appointmentDuration(appointment) {
  const recorded = Number(appointment.duration_minutes || appointment.duration);
  if (Number.isFinite(recorded) && recorded > 0) return recorded;
  const duration = (new Date(appointment.end_time) - new Date(appointment.start_time)) / 60000;
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;
}

function isAppointmentRequest(appointment) {
  const status = normalizeStatus(appointment.status);
  const workflow = normalizeStatus(appointment.workflow_type);
  return status.includes('request') || workflow.includes('request');
}

function getStatusLabel(appointment) {
  const status = normalizeStatus(appointment.status);
  if (status === 'checked_in') return 'Checked In';
  if (status === 'in_consultation') return 'In Consultation';
  if (appointmentStage(appointment) === 'pending_confirmation') return 'Pending Confirmation';
  if (appointmentStage(appointment) === 'expected') return 'Expected';
  if (status === 'complete' || status === 'completed') return 'Completed';
  if (status === 'no_show') return 'No Show';
  if (status === 'cancel_request' || status === 'cancellation_request' || status === 'cancellation_requested') return 'Cancellation Requested';
  if (status === 'reschedule_request' || status === 'reschedule_requested') return 'Reschedule Requested';
  return String(appointment.status || 'Scheduled').replace(/_/g, ' ');
}

function getStatusColors(label) {
  const status = normalizeStatus(label);
  if (status.includes('check') || status.includes('consultation')) return ['#e7f4ec', '#086b50'];
  if (status.includes('await') || status === 'pending' || status === 'due') return ['#fff6df', '#a76500'];
  if (status.includes('reschedule')) return ['#f1eaff', '#6639b8'];
  if (status.includes('cancel') || status.includes('no_show')) return ['#fdeceb', '#bf3e39'];
  if (status.includes('complete')) return ['#edf0f2', '#4b5c55'];
  return ['#e7f4ec', '#086b50'];
}

const appointmentStatusFilters = [
  { id: 'all', label: 'All' },
  { id: 'pending_confirmation', label: 'Pending Confirmation' },
  { id: 'expected', label: 'Expected' },
  { id: 'checked_in', label: 'Checked In' },
  { id: 'in_consultation', label: 'In Consultation' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no_show', label: 'No Show' },
];

const requestStatusFilters = [
  { id: 'all', label: 'All' },
  { id: 'reschedule_request', label: 'Reschedule Requested' },
  { id: 'cancellation_request', label: 'Cancellation Requested' },
];

function matchesStatusFilter(appointment, filter) {
  const status = normalizeStatus(appointment.status);
  const workflow = normalizeStatus(appointment.workflow_type);
  if (filter === 'all') return true;
  if (filter === 'pending_confirmation') return appointmentStage(appointment) === 'pending_confirmation';
  if (filter === 'expected') return appointmentStage(appointment) === 'expected';
  if (filter === 'checked_in') return status === 'checked_in';
  if (filter === 'in_consultation') return status === 'in_consultation';
  if (filter === 'completed') return ['completed', 'complete'].includes(status);
  if (filter === 'cancelled') return ['cancelled', 'canceled'].includes(status);
  if (filter === 'no_show') return ['no_show', 'noshow'].includes(status);
  if (filter === 'reschedule_request') return status.includes('reschedule_request') || workflow.includes('reschedule_request');
  if (filter === 'cancellation_request') return status.includes('cancel_request') || status.includes('cancellation_request')
    || workflow.includes('cancel_request') || workflow.includes('cancellation_request');
  return true;
}

function AppointmentActionsModal({ appointment, user, onClose, onAction }) {
  useEffect(() => {
    if (!appointment) return undefined;
    const previous = document.activeElement;
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [appointment?.id, onClose]);
  if (!appointment) return null;
  const label = appointmentStage(appointment).replace(/_/g, ' ').replace(/\b\w/g, value => value.toUpperCase());
  return <RecordActionsModal
    title="Appointment Actions"
    recordLabel={`Appointment #${appointment.id}`}
    recordName={appointment.pet || 'Patient'}
    recordMeta={<><span>{appointment.reason || 'Appointment'} &middot; {new Date(appointment.start_time).toLocaleDateString()} &middot; {formatTime(appointment.start_time)}</span><br /><span>Owner: {appointment.owner || 'Not recorded'} &middot; Assigned to: {appointment.practitioner || 'Unassigned'}</span></>}
    status={label}
    recordPhotoAttachmentId={appointment.pet_photo_attachment_id}
    user={user}
    showPetAvatar
    onClose={onClose}
    actions={appointmentActions(appointment).map(action => ({
      label: actionDefinitions[action][0], description: actionDefinitions[action][1],
      destructive: ['cancel', 'noshow'].includes(action),
      onClick: () => onAction(appointment, action),
    }))}
  />;
}

function NewAppointmentModal({ appointments, onClose, onSchedule }) {
  const pets = [...new Set(appointments.map((appointment) => appointment.pet).filter(Boolean))];
  const owners = [...new Set(appointments.map((appointment) => appointment.owner).filter(Boolean))];
  const [form, setForm] = useState({ pet: '', owner: '', date: '', time: '', type: '', notes: '' });
  const canSubmit = form.pet && form.owner && form.date && form.time && form.type;
  const unavailableTimes = getUnavailableAppointmentTimes(appointments, form.date);

  return (
    <div style={s.modalBackdrop} onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-appointment-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSchedule(form);
        }}
        style={s.newAppointmentDialog}
      >
        <button type="button" aria-label="Close new appointment" onClick={onClose} style={s.newAppointmentClose}>{Icons.close}</button>
        <h2 id="new-appointment-title" style={s.newAppointmentTitle}>New Appointment</h2>
        <p style={s.newAppointmentSubtitle}>Schedule a new appointment.</p>
        <div style={s.newAppointmentGrid}>
          <label style={s.newAppointmentLabel}>Pet<span className="system-required-star">*</span><select required value={form.pet} onChange={(event) => setForm({ ...form, pet: event.target.value })} style={s.newAppointmentInput}><option value="">Select pet</option>{pets.map((pet) => <option key={pet}>{pet}</option>)}</select></label>
          <label style={s.newAppointmentLabel}>Owner<span className="system-required-star">*</span><select required value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} style={s.newAppointmentInput}><option value="">Select owner</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</select></label>
          <label style={s.newAppointmentLabel}>Date<span className="system-required-star">*</span><LabDateTimePicker mode="date" required value={form.date} onChange={date => setForm(current => ({ ...current, date, time: getUnavailableAppointmentTimes(appointments, date).includes(current.time) ? '' : current.time }))} style={s.newAppointmentInput} /></label>
          <label style={s.newAppointmentLabel}>Time<span className="system-required-star">*</span><LabDateTimePicker mode="time" required value={form.time} unavailableTimes={unavailableTimes} unavailableLabel="another appointment" onChange={time => setForm({ ...form, time })} style={s.newAppointmentInput} /></label>
          <label style={{ ...s.newAppointmentLabel, gridColumn: '1 / -1' }}>Appointment Type<span className="system-required-star">*</span><select required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} style={s.newAppointmentInput}><option value="">Select type</option><option>General Checkup</option><option>Vaccination</option><option>Dental Cleaning</option><option>Follow-up</option><option>Surgery</option></select></label>
          <label style={{ ...s.newAppointmentLabel, gridColumn: '1 / -1' }}>Notes<textarea placeholder="Additional information..." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} style={s.newAppointmentNotes} /></label>
        </div>
        <div style={s.newAppointmentFooter}><button type="button" style={s.modalCancel} onClick={onClose}>Cancel</button><button type="submit" style={{ ...s.scheduleButton, ...(canSubmit ? {} : s.scheduleButtonDisabled) }} disabled={!canSubmit}>Schedule Appointment</button></div>
      </form>
    </div>
  );
}

export default function AppointmentManagementPage({ user }) {
  const [tab, setTab] = useState('all');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [openActionsId, setOpenActionsId] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [search, setSearch] = useState('');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [filterOptionsError, setFilterOptionsError] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateRangeSort, setDateRangeSort] = useState('newest');
  const [practitionerFilter, setPractitionerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dateRangeRef = useRef(null);
  const pageSize = 7;

  const tabs = [
    { id: 'all', label: 'All Appointments', icon: Icons.calendar },
    { id: 'today', label: "Today's Appointments", icon: Icons.users },
    { id: 'requests', label: 'Requests', icon: Icons.clipboard },
  ];

  const canView = canViewFeature(user.permissions, user.role, 'Appointment Management');

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!dateRangeOpen) return undefined;
    const closeDateRange = event => {
      if (event.type === 'keydown' && event.key === 'Escape') {
        setDateRangeOpen(false);
        return;
      }
      if (event.type !== 'keydown'
        && !dateRangeRef.current?.contains(event.target)
        && !event.target.closest?.('.lab-date-time-popover')) {
        setDateRangeOpen(false);
      }
    };
    document.addEventListener('mousedown', closeDateRange);
    document.addEventListener('keydown', closeDateRange);
    return () => {
      document.removeEventListener('mousedown', closeDateRange);
      document.removeEventListener('keydown', closeDateRange);
    };
  }, [dateRangeOpen]);

  useEffect(() => {
    if (!user || !user.token) return;
    if (!canView) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const params = new URLSearchParams();
    if (user.clinic_id) params.set('clinic_id', user.clinic_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    const headers = { Authorization: `Bearer ${user.token}` };

    let active = true;
    let refreshing = false;
    const loadAppointments = async (silent = false) => {
      if (refreshing) return;
      refreshing = true;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/clinic-records/appointments${query}`, { headers });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'Unable to load appointments.');
        }
        const data = await response.json();
        if (active) setAppointments(Array.isArray(data) ? data.filter(appointment => !appointment.archived) : []);
      } catch (err) {
        if (active) setError(err.message || 'Unable to load appointments.');
      } finally {
        refreshing = false;
        if (active) setLoading(false);
      }
    };

    loadAppointments();
    const refresh = () => { if (!document.hidden) loadAppointments(true); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user?.token, user?.clinic_id, canView]);

  const filteredAppointments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return appointments.filter((appt) => {
      const date = new Date(appt.start_time);
      const dateValue = Number.isNaN(date.getTime()) ? '' : localDateValue(date);
      const matchesDateRange = (!dateFrom || dateValue >= dateFrom) && (!dateTo || dateValue <= dateTo);
      const matchesTab = tab === 'all'
        ? matchesDateRange
        : tab === 'today'
          ? dateValue === localDateValue(currentTime)
          : isAppointmentRequest(appt) && matchesDateRange;
      const matchesSearch = !query || [appt.pet || appt.pet_name, appt.owner || appt.owner_name, appt.reason || appt.type, appt.practitioner || appt.veterinarian || appt.veterinarian_name, appt.id]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return matchesTab
        && matchesSearch
        && (!practitionerFilter || (appt.practitioner || appt.veterinarian || appt.veterinarian_name) === practitionerFilter)
        && matchesStatusFilter(appt, statusFilter);
    }).sort((first, second) => {
      const difference = new Date(first.start_time).getTime() - new Date(second.start_time).getTime();
      return dateRangeSort === 'newest' ? -difference : difference;
    });
  }, [appointments, search, tab, currentTime, dateFrom, dateTo, dateRangeSort, practitionerFilter, statusFilter]);
  useEffect(() => {
    if (!canView || !user?.token) return;
    const controller = new AbortController();
    const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    fetch(api + '/clinic-records/appointments/filters?clinic_id=' + encodeURIComponent(user.clinic_id || ''), { headers: { Authorization: 'Bearer ' + user.token }, signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load appointment filters.'); if (!controller.signal.aborted) { setDoctorOptions(data.doctors); setFilterOptionsError(''); } })
      .catch(failure => { if (!controller.signal.aborted) setFilterOptionsError(failure.message); });
    return () => controller.abort();
  }, [canView, user?.token, user?.clinic_id]);
  const practitioners = [...new Set([...doctorOptions, ...appointments.map(appt => appt.practitioner || appt.veterinarian || appt.veterinarian_name).filter(Boolean)])].sort((a,b) => a.localeCompare(b));
  const currentStatusFilters = tab === 'requests' ? requestStatusFilters : appointmentStatusFilters;
  const pageCount = Math.max(1, Math.ceil(filteredAppointments.length / pageSize));
  const pageAppointments = filteredAppointments.slice((page - 1) * pageSize, page * pageSize);
  const summaryAppointments = appointments.filter(appt => {
    const appointmentDate = localDateValue(appt.start_time);
    const matchesDateRange = (!dateFrom || appointmentDate >= dateFrom) && (!dateTo || appointmentDate <= dateTo);
    if (tab === 'today') return appointmentDate === localDateValue(currentTime);
    if (tab === 'requests') return isAppointmentRequest(appt) && matchesDateRange;
    return matchesDateRange;
  });
  const dateRangeHeading = dateFrom && dateTo
    ? `${formatSelectedDate(dateFrom)} – ${formatSelectedDate(dateTo)}`
    : dateFrom ? `From ${formatSelectedDate(dateFrom)}` : `Through ${formatSelectedDate(dateTo)}`;
  const checkedInCount = summaryAppointments.filter(appt => ['checked_in', 'in_consultation'].includes(normalizeStatus(appt.status))).length;
  const awaitingCount = summaryAppointments.filter(appt => ['scheduled', 'confirmed', 'pending', 'due'].includes(normalizeStatus(appt.status))).length;
  const requestCount = appointments.filter(isAppointmentRequest).length;
  const refreshAppointments = async () => {
    window.dispatchEvent(new Event('vetintel:appointment-updated'));
    try {
      const rows = await appointmentRequest(user, '');
      setAppointments(rows.filter(appointment => !appointment.archived));
      setError(null);
    } catch {
      setError('The action was saved, but the list could not refresh. Please refresh the page.');
    }
  };
  const handleAppointmentAction = (appointment, action) => {
    setOpenActionsId(null);
    setWorkflow({ appointment, action });
  };

  const handleScheduleAppointment = (form) => {
    const startTime = new Date(`${form.date}T${form.time}`).toISOString();
    setAppointments((current) => [{
      id: `local-${Date.now()}`,
      start_time: startTime,
      pet: form.pet,
      owner: form.owner,
      reason: form.type,
      notes: form.notes,
      status: 'Pending',
    }, ...current]);
    setShowNewAppointment(false);
    setDateFrom('');
    setDateTo('');
    setTab('all');
    setPage(1);
  };

  if (!canView) {
    return (
      <div className="appointment-management-page" style={s.main}>
        <Topbar user={user} title="Appointment Management" subtitle="Manage bookings, arrivals, and appointment requests for the clinic." />
        <div style={s.page}>
          <div className="appointment-access-denied">
            <h2>Access denied</h2>
            <p>Your role (<strong>{user.role}</strong>) does not currently have permission to view Appointment Management.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="appointment-management-page" style={s.main}>
      <Topbar
        user={user}
        className="appointment-management-topbar"
        headerContent={<div className="appointment-page-heading"><h1>Appointment Management</h1><p>Manage bookings, arrivals, and appointment requests for the clinic.</p></div>}
        actions={<div className="appointment-header-actions">
          <div className="appointment-date-display">
            <span className="appointment-date-display-icon">{Icons.calendar}</span>
            <span className="appointment-date-display-text"><strong>{formatSelectedDate(localDateValue(currentTime))}</strong><small>{currentTime.toLocaleDateString(undefined, { weekday: 'long' })} · {formatClock(currentTime)}</small></span>
          </div>
        </div>}
      />
      <div className="appointment-dashboard">
        <section className="appointment-stat-grid" aria-label="Appointment summary">
          <div className="appointment-stat-card appointment-stat-green"><span className="appointment-stat-icon">{Icons.calendar}</span><span className="appointment-stat-copy"><span>Appointments</span><strong>{loading ? '—' : summaryAppointments.length}</strong></span></div>
          <div className="appointment-stat-card appointment-stat-green"><span className="appointment-stat-icon">{Icons.users}</span><span className="appointment-stat-copy"><span>Checked In</span><strong>{loading ? '—' : checkedInCount}</strong></span></div>
          <div className="appointment-stat-card appointment-stat-amber"><span className="appointment-stat-icon">{Icons.clock}</span><span className="appointment-stat-copy"><span>Awaiting Arrival</span><strong>{loading ? '—' : awaitingCount}</strong></span></div>
          <button type="button" className="appointment-stat-card appointment-stat-red appointment-stat-action" onClick={() => { setTab('requests'); setStatusFilter('all'); setPage(1); }}>
            <span className="appointment-stat-icon">{Icons.list}</span><span className="appointment-stat-copy"><span>Requests Requiring Action</span><strong>{loading ? '—' : requestCount}</strong></span><span className="appointment-stat-chevron">{Icons.chevronRight}</span>
          </button>
        </section>

        <div className="appointment-view-toolbar">
          <nav className="appointment-tabs" aria-label="Appointment views">
            {tabs.map(item => (
              <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => { setTab(item.id); setStatusFilter('all'); setPage(1); }} className={`appointment-tab${tab === item.id ? ' is-active' : ''}`}>
                <span>{item.icon}</span>{item.label}{item.id === 'requests' && requestCount > 0 && <b>{requestCount}</b>}
              </button>
            ))}
          </nav>
          <button type="button" className="appointment-new-button" onClick={() => setShowNewAppointment(true)}><span>{Icons.plus}</span>New Appointment</button>
        </div>

        {error && <div className="appointment-error" role="alert">{error}</div>}

        <div className={`appointment-filter-row${tab === 'today' ? ' appointment-filter-row-today' : ''}`}>
          <label className="appointment-search"><span>{Icons.search}</span><input aria-label="Search appointments" placeholder="Search by pet name, owner, or doctor..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
          <select title={filterOptionsError || undefined} aria-label="Filter by doctor" value={practitionerFilter} onChange={event => { setPractitionerFilter(event.target.value); setPage(1); }}><option value="">All Doctors</option>{practitioners.map(name => <option key={name} value={name}>{name}</option>)}</select>
          {tab !== 'today' && <div className="lab-date-range appointment-history-date-range" ref={dateRangeRef}>
            <button type="button" className="lab-date-range-trigger" aria-label="Choose appointment date range" aria-expanded={dateRangeOpen} onClick={() => setDateRangeOpen(open => !open)}>
              <span className="lab-date-range-calendar">{Icons.calendar}</span>
              <span>{dateFrom || dateTo ? `${dateFrom || 'Any date'} – ${dateTo || 'Any date'}` : 'Date Range'}</span>
              <span className={`lab-date-range-chevron${dateRangeOpen ? ' open' : ''}`} aria-hidden="true" />
            </button>
            {dateRangeOpen && <div className="lab-date-range-popover system-date-range-popover" role="group" aria-label="Appointment date range">
              <DateRangePopoverFields
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={date => { setDateFrom(date); setPage(1); }}
                onDateToChange={date => { setDateTo(date); setPage(1); }}
                sortOrder={dateRangeSort}
                onSortOrderChange={order => { setDateRangeSort(order); setPage(1); }}
                onClear={() => { setDateFrom(''); setDateTo(''); setDateRangeSort('newest'); setPage(1); }}
                onDone={() => setDateRangeOpen(false)}
              />
            </div>}
          </div>}
        </div>

        <section className="appointment-status-filter" aria-label="Filter appointments by status">
          <div className="appointment-status-filter-options" role="group" aria-label="Appointment status">
            {currentStatusFilters.map(filter => (
              <button
                type="button"
                key={filter.id}
                aria-pressed={statusFilter === filter.id}
                className={`appointment-status-filter-option${statusFilter === filter.id ? ' is-active' : ''}`}
                onClick={() => { setStatusFilter(filter.id); setPage(1); }}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <p>{tab === 'requests'
            ? 'Choose a request type to filter appointment records requiring action.'
            : tab === 'today'
              ? "Choose a status to filter today's appointments."
              : 'Choose a status to filter all appointments.'}</p>
        </section>

        <section className="appointment-table-card">
          <header className="appointment-table-heading">
            <h2>{tab === 'all' ? (dateFrom || dateTo ? dateRangeHeading : 'All Appointments') : tab === 'today' ? "Today's Appointments" : 'Appointment Requests'} <span>({filteredAppointments.length})</span></h2>
            <div className="appointment-legend"><span><i className="legend-checked" />{checkedInCount} Checked In</span><span><i className="legend-awaiting" />{awaitingCount} Awaiting</span><span><i className="legend-completed" />{summaryAppointments.filter(appt => ['completed', 'complete'].includes(normalizeStatus(appt.status))).length} Completed</span></div>
          </header>
          <div className="lab-results-table-wrap clinic-appointments-table-wrap appointment-table-scroll">
            <table className="lab-results-table clinic-appointments-table">
              <thead><tr>{['Date & Time', 'Patient', 'Owner', 'Type', 'Veterinarian', 'Status', ''].map(label => <th key={label} aria-label={label || 'Appointment actions'}>{label}</th>)}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="appointment-table-empty">Loading appointments…</td></tr>
                  : pageAppointments.length === 0 ? <tr><td colSpan={7} className="appointment-table-empty">{error ? 'Appointments could not be loaded.' : 'No appointments found for this view.'}</td></tr>
                    : pageAppointments.map((appt, index) => {
                      const duration = appointmentDuration(appt);
                      return <tr key={appt.id || `${index}-${appt.start_time}`} className="clinic-action-row" tabIndex={0}
                        aria-label={`Open actions for ${appt.pet || 'appointment'}`} aria-haspopup="dialog"
                        onClick={() => setOpenActionsId(appt.id)}
                        onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); setOpenActionsId(appt.id); } }}>
                        <td data-label="Date & Time"><div className="lab-result-date"><strong>{new Date(appt.start_time).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</strong><span>{formatTime(appt.start_time)}</span></div></td>
                        <td data-label="Patient" className="lab-result-pet">{appt.pet || appt.pet_name || '—'}</td>
                        <td data-label="Owner">{appt.owner || appt.owner_name || '—'}</td>
                        <td data-label="Type"><div className="lab-result-test"><strong>{appt.reason || appt.type || 'Appointment'}</strong>{duration && <span>({duration} min)</span>}</div></td>
                        <td data-label="Veterinarian">{appt.practitioner || appt.veterinarian || appt.veterinarian_name || 'Unassigned'}</td>
                        <td data-label="Status"><StatusIndicator status={appointmentStage(appt) === 'pending_confirmation' ? 'pending' : appt.status} label={appointmentStage(appt) === 'pending_confirmation' ? 'Pending Confirmation' : undefined} /></td>
                        <td data-label="Actions" className="lab-result-actions">
                          <button type="button" className="lab-row-action-trigger clinic-record-actions-trigger" onClick={event => { event.stopPropagation(); setOpenActionsId(appt.id); }} aria-label={`Open actions for ${appt.pet || 'appointment'}`} aria-haspopup="dialog" title="Appointment actions">{Icons.chevronRight}</button>
                        </td>
                      </tr>;
                    })}
              </tbody>
            </table>
          </div>
          <footer className="appointment-table-footer">
            <span>Showing {filteredAppointments.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredAppointments.length)} of {filteredAppointments.length} appointments</span>
            {pageCount > 1 && <div className="appointment-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)} aria-label="Previous page">‹</button><span>{page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(current => current + 1)} aria-label="Next page">›</button></div>}
          </footer>
        </section>
      </div>
      <AppointmentActionsModal
        user={user}
        appointment={appointments.find((appointment) => appointment.id === openActionsId)}
        onClose={() => setOpenActionsId(null)}
        onAction={handleAppointmentAction}
      />
      {workflow && <AppointmentWorkflowDialog key={`${workflow.appointment.id}-${workflow.action}`} {...workflow} user={user} onClose={() => setWorkflow(null)} onSaved={refreshAppointments} />}
      {showNewAppointment && <NewAppointmentModal appointments={appointments} onClose={() => setShowNewAppointment(false)} onSchedule={handleScheduleAppointment} />}
    </div>
  );
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f4f7fa' },
  page: { padding: '22px 24px', maxWidth: 1500, margin: '0 auto' },
  pageActions: { display: 'flex', justifyContent: 'flex-end', marginBottom: 14 },
  pageHd: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  pageTitle: { fontFamily: "'DM Sans',sans-serif", fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-.02em', color: '#173d37' },
  pageSub: { fontSize: '.78rem', color: '#526b64', marginTop: 3 },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', background: '#086b50', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 14, marginBottom: 20 },
  statCard: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '16px 20px' },
  requestNotice: { display: 'flex', alignItems: 'center', gap: 12, background: '#fffdf2', border: '1px solid #f4e7b0', borderRadius: 10, padding: '12px 16px', marginBottom: 16 },
  requestIcon: { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', background: '#fef3c7', borderRadius: 8 },
  requestTitle: { fontSize: '.8rem', fontWeight: 600, color: '#713f12' },
  requestText: { fontSize: '.74rem', color: '#92400e', marginTop: 2 },
  requestLink: { border: 'none', background: 'transparent', color: '#92400e', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' },
  searchWrap: { position: 'relative', marginBottom: 16 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#64748b', display: 'flex' },
  search: { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '9px 10px', border: '1px solid #dce5e8', borderRadius: 7, fontSize: '.72rem', background: '#fff', outline: 'none', color: '#334155' },
  tabBar: { display: 'flex', alignItems: 'center', overflowX: 'auto', background: 'transparent', borderBottom: '1px solid #e1e9e7', padding: 0, marginBottom: 12, gap: 4, scrollbarWidth: 'none' },
  tabBtn: { flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 12px', border: 'none', borderBottom: '2px solid transparent', borderRadius: '7px 7px 0 0', fontSize: '.76rem', color: '#334155', background: 'transparent', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
  tabActive: { background: '#086b50', color: '#fff', borderBottomColor: '#013826' },
  tabCount: { color: 'inherit', fontSize: '.68rem', fontWeight: 600, opacity: .82 },
  filters: { display: 'grid', gridTemplateColumns: 'minmax(180px, 1.6fr) repeat(4, minmax(96px, 1fr))', gap: 8, marginBottom: 14, padding: 10, border: '1px solid #e5ecea', borderRadius: 10, background: '#fff' },
  filterControl: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, padding: '0 8px', border: '1px solid #dce5e8', borderRadius: 7, color: '#526b64', fontSize: '.67rem', whiteSpace: 'nowrap' },
  filterDateInput: { width: '100%', minWidth: 0, border: 0, outline: 0, background: 'transparent', color: '#334155', font: 'inherit', fontSize: '.7rem' },
  filterSelect: { width: '100%', minWidth: 0, padding: '9px 10px', border: '1px solid #dce5e8', borderRadius: 7, background: '#fff', color: '#334155', fontSize: '.72rem' },
  card: { background: '#fff', border: '1px solid #e5ecea', borderRadius: 11, padding: '0 12px' },
  tableScroll: { width: '100%', overflowX: 'auto' },
  table: { width: '100%', minWidth: 880, borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: { textAlign: 'left', fontSize: '.68rem', fontWeight: 700, color: '#38544d', textTransform: 'none', letterSpacing: 0, padding: '13px 9px', borderBottom: '1px solid #e9efed', whiteSpace: 'nowrap' },
  td: { padding: '12px 9px', fontSize: '.75rem', color: '#263b37', borderBottom: '1px solid #edf1f0', verticalAlign: 'middle', overflowWrap: 'anywhere' },
  tdMuted: { padding: '13px 0', fontSize: '.82rem', color: '#64748b', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, fontSize: '.75rem', color: '#0f1117', cursor: 'pointer' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6 },
  moreButton: { width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4, background: '#fff', color: '#294563', border: '1px solid #dbe3ee', borderRadius: 7, cursor: 'pointer', fontSize: '.9rem', letterSpacing: 1 },
  cellSubtext: { display: 'block', marginTop: 3, color: '#647b86', fontSize: '.67rem', fontWeight: 400 },
  statusPill: { display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 12, fontSize: '.66rem', fontWeight: 700, whiteSpace: 'nowrap' },
  emptyState: { padding: '24px 12px', color: '#64748b', fontSize: '.78rem', textAlign: 'center' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 2px', color: '#61766f', fontSize: '.68rem' },
  paginationControls: { display: 'flex', alignItems: 'center', gap: 8 },
  pageControl: { width: 28, height: 28, border: '1px solid #dce5e8', borderRadius: 7, background: '#fff', color: '#294563', fontSize: '1rem', cursor: 'pointer' },
  paginationButton: { display: 'flex', gap: 8 },
  modalBackdrop: { position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15, 23, 42, .38)' },
  actionsDialog: { position: 'relative', width: 610, maxWidth: 'calc(100vw - 32px)', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, overflow: 'hidden', boxShadow: '0 20px 45px rgba(15,23,42,.25)' },
  modalClose: { position: 'absolute', top: 18, right: 20, zIndex: 1, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 6, background: 'transparent', color: '#64748b', cursor: 'pointer' },
  actionsHeader: { display: 'flex', alignItems: 'center', gap: 11, padding: '14px 19px 12px', borderBottom: '1px solid #e2e8f0' },
  actionsHeaderIcon: { width: 43, height: 43, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', color: '#fff', background: '#087c58', borderRadius: 10 },
  actionsTitle: { margin: 0, color: '#18263a', fontSize: '1.02rem', fontWeight: 700 },
  actionsSubtitle: { marginTop: 2, color: '#5f718a', fontSize: '.72rem' },
  actionsList: { padding: '20px 24px 16px' },
  actionGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 },
  actionDivider: { display: 'block', height: 18 },
  modalActionButton: { minHeight: 84, display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', padding: '12px 10px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', color: '#34445b', textAlign: 'left', cursor: 'pointer' },
  modalActionIcon: { width: 29, height: 29, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', color: '#50617a', marginTop: 1 },
  modalActionText: { display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0, paddingTop: 1 },
  modalActionTextStrong: { fontSize: '.95rem' },
  modalActionChevron: { color: '#40536d', fontSize: '1.25rem', lineHeight: 1 },
  modalAction_positive: { borderColor: '#16a765', background: '#effaf4', color: '#08743d' },
  modalAction_primary: { borderColor: '#5b8ef0', background: '#f1f6ff', color: '#013826' },
  modalAction_neutral: { borderColor: '#cbd5e1', background: '#f8fafc', color: '#34445b' },
  modalAction_danger: { borderColor: '#ff6674', background: '#fff1f3', color: '#a91524' },
  modalAction_primary: { borderColor: '#86d7b4', background: '#f1f6ff', color: '#013826' },
  modalAction_positive: { borderColor: '#86d7b4', background: '#effaf4', color: '#08743d' },
  modalAction_warning: { borderColor: '#ffc65c', background: '#fff8e8', color: '#805300' },
  modalIcon_positive: { width: 29, height: 29, borderRadius: 50, background: '#139b5e', color: '#fff' },
  modalIcon_primary: { color: '#326cc2' },
  modalIcon_neutral: { color: '#50617a' },
  modalIcon_danger: { width: 29, height: 29, borderRadius: 50, background: '#c91628', color: '#fff' },
  modalIcon_warning: { width: 29, height: 29, borderRadius: 50, background: '#f59e0b', color: '#fff' },
  actionsNotice: { display: 'flex', gap: 7, paddingTop: 9, marginTop: 11, borderTop: '1px solid #e2e8f0', color: '#70829a', fontSize: '.56rem', lineHeight: 1.35 },
  noticeIcon: { width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', borderRadius: '50%', background: '#cbd7e8', color: '#fff', fontWeight: 700 },
  modalFooter: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '9px 13px', borderTop: '1px solid #e2e8f0' },
  modalCancel: { padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff', color: '#64748b', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' },
  newAppointmentDialog: { position: 'relative', width: 575, maxWidth: 'calc(100vw - 32px)', padding: '22px 25px 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 20px 45px rgba(15,23,42,.22)' },
  newAppointmentClose: { position: 'absolute', top: 14, right: 15, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer' },
  newAppointmentTitle: { margin: 0, color: '#0f172a', fontSize: '1.12rem', fontWeight: 700 },
  newAppointmentSubtitle: { margin: '6px 0 16px', color: '#64748b', fontSize: '.78rem' },
  newAppointmentGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  newAppointmentLabel: { display: 'flex', flexDirection: 'column', gap: 6, color: '#1f2937', fontSize: '.76rem', fontWeight: 600 },
  newAppointmentInput: { width: '100%', minHeight: 36, boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #f1f1f3', borderRadius: 8, background: '#f4f4f6', color: '#6b7280', fontSize: '.78rem', outline: 'none' },
  newAppointmentNotes: { width: '100%', height: 64, boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', border: '1px solid #f1f1f3', borderRadius: 8, background: '#f4f4f6', color: '#6b7280', fontFamily: 'inherit', fontSize: '.78rem', outline: 'none' },
  newAppointmentFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  scheduleButton: { padding: '9px 14px', border: 'none', borderRadius: 8, background: '#0f1117', color: '#fff', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' },
  scheduleButtonDisabled: { background: '#d1d5db', color: '#6b7280', cursor: 'not-allowed' },
};
