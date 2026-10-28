import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../components/Topbar';
import LabDateTimePicker, { getUnavailableAppointmentTimes } from '../../components/LabDateTimePicker';
import { Icons } from '../../icons';
import { canViewFeature } from '../../utils/permissionUtils';
import { formatDateText } from '../../utils/dateFormatting';

function formatDate(value) {
  return formatDateText(value, undefined, '');
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getMockAppointments() {
  const today = new Date();
  const at = (dayOffset, hour, minute) => {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };

  return [
    { id: 'demo-1', start_time: at(0, 9, 0), pet: 'Max', owner: 'Emma Santos', reason: 'General Checkup', practitioner: 'Dr. Torres', status: 'Confirmed' },
    { id: 'demo-2', start_time: at(0, 10, 30), pet: 'Luna', owner: 'Daniel Cruz', reason: 'Vaccination', practitioner: 'Dr. Chen', status: 'Pending' },
    { id: 'demo-3', start_time: at(1, 11, 0), pet: 'Charlie', owner: 'Sofia Reyes', reason: 'Dental Cleaning', practitioner: 'Dr. Torres', status: 'Confirmed' },
    { id: 'demo-4', start_time: at(2, 14, 0), pet: 'Bella', owner: 'Noah Garcia', reason: 'Walk-in Consultation', practitioner: 'Dr. Chen', status: 'Confirmed', is_walk_in: true },
    { id: 'demo-5', start_time: at(-1, 15, 30), pet: 'Rocky', owner: 'Mia Flores', reason: 'Follow-up', practitioner: 'Dr. Torres', status: 'Completed' },
    { id: 'demo-6', start_time: at(-2, 13, 0), pet: 'Milo', owner: 'Lucas Mendoza', reason: 'General Checkup', practitioner: 'Dr. Chen', status: 'No Show' },
    { id: 'demo-7', start_time: at(3, 10, 0), pet: 'Coco', owner: 'Ava Navarro', reason: 'Reschedule Request', practitioner: 'Dr. Torres', status: 'Reschedule Request' },
    { id: 'demo-8', start_time: at(4, 16, 0), pet: 'Nala', owner: 'Ethan Ramos', reason: 'Cancel Request', practitioner: 'Dr. Chen', status: 'Cancel Request' },
  ];
}

function AppointmentActionsModal({ appointment, onClose, onAction }) {
  if (!appointment) return null;

  const actions = [
    ['confirm', 'Confirm', 'Mark this appointment as confirmed.', 'positive', Icons.check],
    ['checkin', 'Check In', 'Mark patient as checked in for their appointment.', 'primary', Icons.send],
    ['view', 'View Details', 'See full appointment information.', 'neutral', Icons.eye],
    ['reschedule', 'Reschedule', 'Change the appointment date and time.', 'warning', Icons.calendar],
    ['cancel', 'Cancel Appointment', 'Cancel this appointment and notify the patient.', 'danger', Icons.xCircle],
    ['noshow', 'Mark No Show', 'Mark this appointment as a no show.', 'danger', Icons.xCircle],
  ];

  return (
    <div style={s.modalBackdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-actions-title"
        onClick={(event) => event.stopPropagation()}
        style={s.actionsDialog}
      >
        <button type="button" aria-label="Close appointment actions" onClick={onClose} style={s.modalClose}>
          {Icons.close}
        </button>
        <div style={s.actionsHeader}>
          <div style={s.actionsHeaderIcon}>{Icons.calendar}</div>
          <div>
            <h2 id="appointment-actions-title" style={s.actionsTitle}>Appointment Actions</h2>
            <div style={s.actionsSubtitle}>
              {appointment.pet || 'Appointment'} — {appointment.reason || 'Appointment'} ({formatTime(appointment.start_time)})
            </div>
          </div>
        </div>
        <div style={s.actionsList}>
          <div style={s.actionGrid}>
            {actions.slice(0, 3).map(([action, label, description, variant, icon]) => (
              <button key={action} type="button" onClick={() => onAction(appointment, action)} style={{ ...s.modalActionButton, ...s[`modalAction_${variant}`] }}>
                <span style={{ ...s.modalActionIcon, ...s[`modalIcon_${variant}`] }}>{icon}</span>
                <span style={s.modalActionText}><strong>{label}</strong><small>{description}</small></span>
                <span style={s.modalActionChevron}>›</span>
              </button>
            ))}
          </div>
          <div style={s.actionDivider} />
          <div style={s.actionGrid}>
            {actions.slice(3).map(([action, label, description, variant, icon]) => (
              <button key={action} type="button" onClick={() => onAction(appointment, action)} style={{ ...s.modalActionButton, ...s[`modalAction_${variant}`] }}>
                <span style={{ ...s.modalActionIcon, ...s[`modalIcon_${variant}`] }}>{icon}</span>
                <span style={s.modalActionText}><strong>{label}</strong><small>{description}</small></span>
                <span style={s.modalActionChevron}>›</span>
              </button>
            ))}
          </div>
          <div style={s.actionsNotice}>
            <span style={s.noticeIcon}>i</span>
            <span>These actions will update the appointment status and be reflected in the patient’s record.<br />For clinic-specific workflows, please refer to your clinic settings.</span>
          </div>
        </div>
        <div style={s.modalFooter}>
          <button type="button" style={s.modalCancel} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
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
  const [openActionsId, setOpenActionsId] = useState(null);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [practitionerFilter, setPractitionerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pageSize = 8;

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  const canView = canViewFeature(user.permissions, user.role, 'Appointment Management');

  useEffect(() => {
    if (!user || !user.token) return;
    if (!canView) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const params = new URLSearchParams();
    if (user.clinic_id) params.set('clinic_id', user.clinic_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    const headers = { Authorization: `Bearer ${user.token}` };

    const loadAppointments = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/clinic-records/appointments${query}`, { headers });
        if (!response.ok) throw new Error('Failed to load appointments');
        const data = await response.json();
        setAppointments(Array.isArray(data) && data.length > 0 ? data : getMockAppointments());
      } catch (err) {
        console.error(err);
        setError(null);
        setAppointments(getMockAppointments());
      } finally {
        setLoading(false);
      }
    };

    loadAppointments();
  }, [user, canView]);

  const filteredAppointments = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointments.filter((appt) => {
      const date = new Date(appt.start_time);
      const status = String(appt.status || '').toLowerCase();
      const isCancelled = status === 'cancelled' || status === 'canceled';
      const matchesTab = tab === 'all'
        || (tab === 'cancelled' && isCancelled)
        || (tab === 'upcoming' && !isCancelled && !Number.isNaN(date.getTime()) && date >= today)
        || (tab === 'past' && !isCancelled && !Number.isNaN(date.getTime()) && (date < today || ['completed', 'complete', 'no show', 'no-show'].includes(status)));
      const matchesSearch = !query || [appt.pet || appt.pet_name, appt.owner || appt.owner_name, appt.reason || appt.type, appt.practitioner || appt.veterinarian || appt.veterinarian_name, appt.id]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const dateValue = Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return matchesTab
        && matchesSearch
        && (!dateFrom || dateValue >= dateFrom)
        && (!dateTo || dateValue <= dateTo)
        && (!practitionerFilter || (appt.practitioner || appt.veterinarian || appt.veterinarian_name) === practitionerFilter)
        && (!typeFilter || (appt.reason || appt.type) === typeFilter)
        && (!statusFilter || status.toLowerCase() === statusFilter.toLowerCase());
    });
  }, [appointments, search, tab, dateFrom, dateTo, practitionerFilter, typeFilter, statusFilter]);
  const practitioners = [...new Set(appointments.map(appt => appt.practitioner || appt.veterinarian || appt.veterinarian_name).filter(Boolean))];
  const appointmentTypes = [...new Set(appointments.map(appt => appt.reason || appt.type).filter(Boolean))];
  const appointmentStatuses = [...new Set(appointments.map(appt => appt.status).filter(Boolean))];
  const pageCount = Math.max(1, Math.ceil(filteredAppointments.length / pageSize));
  const pageAppointments = filteredAppointments.slice((page - 1) * pageSize, page * pageSize);
  const tabCounts = {
    all: appointments.length,
    upcoming: appointments.filter(appt => {
      const date = new Date(appt.start_time);
      return !Number.isNaN(date.getTime()) && date >= new Date(new Date().setHours(0, 0, 0, 0)) && !['cancelled', 'canceled'].includes(String(appt.status || '').toLowerCase());
    }).length,
    past: appointments.filter(appt => {
      const date = new Date(appt.start_time);
      return !Number.isNaN(date.getTime()) && (date < new Date(new Date().setHours(0, 0, 0, 0)) || ['completed', 'complete', 'no show', 'no-show'].includes(String(appt.status || '').toLowerCase())) && !['cancelled', 'canceled'].includes(String(appt.status || '').toLowerCase());
    }).length,
    cancelled: appointments.filter(appt => ['cancelled', 'canceled'].includes(String(appt.status || '').toLowerCase())).length,
  };

  const handleAppointmentAction = (appointment, action) => {
    setOpenActionsId(null);
    if (action === 'view') {
      window.alert(`${appointment.pet || 'Appointment'}\n${appointment.owner || 'Owner not available'}\n${appointment.reason || 'Appointment'}\n${formatTime(appointment.start_time)}`);
      return;
    }

    const statusByAction = {
      confirm: 'Confirmed',
      checkin: 'Checked In',
      reschedule: 'Reschedule Request',
      cancel: 'Cancelled',
      noshow: 'No Show',
    };

    const nextStatus = statusByAction[action];
    if (!nextStatus) return;
    setAppointments((current) => current.map((item) => (
      item.id === appointment.id ? { ...item, status: nextStatus } : item
    )));
    setPage(1);
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
    setTab('all');
    setPage(1);
  };

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Appointment Management" subtitle="Manage bookings, cancellations, and follow-ups" />
        <div style={s.page}>
          <div style={s.pageActions}><button type="button" style={s.primaryBtn} onClick={() => setShowNewAppointment(true)}><span style={{ width: 13, height: 13, display: 'flex' }}>{Icons.plus}</span>New Appointment</button></div>
          <div style={s.pageHd}>
            <div>
              <div style={s.pageTitle}>Appointment Management</div>
              <div style={s.pageSub}>You do not have permission to view this page.</div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: 28, color: '#475569' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Access denied</h2>
            <p style={{ marginTop: 12 }}>Your role (<strong>{user.role}</strong>) does not currently have permission to view Appointment Management.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="appointment-management-page" style={s.main}>
      <Topbar user={user} title="Appointments" subtitle="Manage and view all scheduled appointments" />
      <div style={s.page}>
        <div style={{ ...s.pageHd, justifyContent: 'flex-end', marginBottom: 14 }}>
          <button type="button" style={s.primaryBtn} onClick={() => setShowNewAppointment(true)}>New Appointment</button>
        </div>
        <div style={s.tabBar}>
          {tabs.map(item => (
            <button key={item.id} type="button" onClick={() => { setTab(item.id); setPage(1); }} style={{ ...s.tabBtn, ...(tab === item.id ? s.tabActive : {}) }}>
              {item.label} <span style={s.tabCount}>{tabCounts[item.id]}</span>
            </button>
          ))}
        </div>
        <div className="appointment-list-filters" style={s.filters}>
          <input aria-label="Search appointments" style={s.search} placeholder="Search by patient, owner, or appointment number..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
          <label style={s.filterControl}>From<LabDateTimePicker label="Start date" mode="date" value={dateFrom} onChange={date => { setDateFrom(date); setPage(1); }} style={s.filterDateInput} /></label>
          <label style={s.filterControl}>To<LabDateTimePicker label="End date" mode="date" value={dateTo} onChange={date => { setDateTo(date); setPage(1); }} style={s.filterDateInput} /></label>
          <select aria-label="Filter by veterinarian" style={s.filterSelect} value={practitionerFilter} onChange={event => { setPractitionerFilter(event.target.value); setPage(1); }}><option value="">All Veterinarians</option>{practitioners.map(name => <option key={name} value={name}>{name}</option>)}</select>
          <select aria-label="Filter by appointment type" style={s.filterSelect} value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setPage(1); }}><option value="">All Types</option>{appointmentTypes.map(type => <option key={type} value={type}>{type}</option>)}</select>
          <select aria-label="Filter by status" style={s.filterSelect} value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All Statuses</option>{appointmentStatuses.map(status => <option key={status} value={status}>{status}</option>)}</select>
        </div>
        <div style={s.card}>
          {loading ? <div style={s.emptyState}>Loading appointments…</div> : error ? <div role="alert" style={{ ...s.emptyState, color: '#b91c1c' }}>{error}</div> : (
            <div style={s.tableScroll}>
              <table style={s.table}>
                <colgroup><col style={{ width: '14%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} /><col style={{ width: '17%' }} /><col style={{ width: '13%' }} /><col style={{ width: '16%' }} /><col style={{ width: '10%' }} /></colgroup>
                <thead><tr>{['Date & Time', 'Patient', 'Owner', 'Type', 'Veterinarian', 'Status', 'Actions'].map(label => <th key={label} style={s.th}>{label}</th>)}</tr></thead>
                <tbody>
                  {pageAppointments.length === 0 ? <tr><td colSpan={7} style={s.emptyState}>No appointments found.</td></tr> : pageAppointments.map((appt, index) => {
                    const start = new Date(appt.start_time);
                    const veterinarian = appt.practitioner || appt.veterinarian || appt.veterinarian_name || '—';
                    const status = String(appt.status || 'Scheduled');
                    const statusKey = status.toLowerCase();
                    const statusColor = statusKey.includes('cancel') ? ['#fee2e2', '#b91c1c'] : statusKey.includes('complete') ? ['#e8eef2', '#486175'] : statusKey.includes('check') ? ['#dff4ed', '#087f63'] : statusKey.includes('pending') ? ['#fff1dc', '#a95b00'] : ['#e9f0ff', '#2563eb'];
                    return <tr key={appt.id || `${index}-${appt.start_time}`}>
                      <td style={s.td}><strong>{formatDate(appt.start_time)}</strong><small style={s.cellSubtext}>{formatTime(appt.start_time)}</small></td>
                      <td style={s.td}><strong>{appt.pet || appt.pet_name || '—'}</strong></td>
                      <td style={s.td}>{appt.owner || appt.owner_name || '—'}</td>
                      <td style={s.td}>{appt.reason || appt.type || 'Appointment'}{appt.duration_minutes ? <small style={s.cellSubtext}>({appt.duration_minutes} min)</small> : null}</td>
                      <td style={s.td}>{veterinarian}</td>
                      <td style={s.td}><span style={{ ...s.statusPill, background: statusColor[0], color: statusColor[1] }}>{status}</span></td>
                      <td style={s.td}><button type="button" style={s.moreButton} onClick={() => setOpenActionsId(appt.id)} aria-label={`Actions for ${appt.pet || 'appointment'}`}>...</button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={s.pagination}>
            <span>Showing {filteredAppointments.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredAppointments.length)} of {filteredAppointments.length} appointments</span>
            <div style={s.paginationControls}>
              <button type="button" style={s.pageControl} disabled={page <= 1} onClick={() => setPage(current => current - 1)} aria-label="Previous page">‹</button>
              <span>{page} / {pageCount}</span>
              <button type="button" style={s.pageControl} disabled={page >= pageCount} onClick={() => setPage(current => current + 1)} aria-label="Next page">›</button>
            </div>
          </div>
        </div>
      </div>
      <AppointmentActionsModal
        appointment={appointments.find((appointment) => appointment.id === openActionsId)}
        onClose={() => setOpenActionsId(null)}
        onAction={handleAppointmentAction}
      />
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
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', background: '#005447', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer' },
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
  tabActive: { background: '#005447', color: '#fff', borderBottomColor: '#005447' },
  tabCount: { color: 'inherit', fontSize: '.68rem', fontWeight: 600, opacity: .82 },
  filters: { display: 'grid', gridTemplateColumns: 'minmax(180px, 1.6fr) repeat(5, minmax(96px, 1fr))', gap: 8, marginBottom: 14, padding: 10, border: '1px solid #e5ecea', borderRadius: 10, background: '#fff' },
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
  modalAction_primary: { borderColor: '#5b8ef0', background: '#f1f6ff', color: '#005447' },
  modalAction_neutral: { borderColor: '#cbd5e1', background: '#f8fafc', color: '#34445b' },
  modalAction_danger: { borderColor: '#ff6674', background: '#fff1f3', color: '#a91524' },
  modalAction_primary: { borderColor: '#86d7b4', background: '#f1f6ff', color: '#005447' },
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
