import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { formatDateText, formatDateTimeText } from '../../utils/dateFormatting';
import FilterSelect from '../../components/FilterSelect';
import LabDateTimePicker from '../../components/LabDateTimePicker';
import { Icons } from '../../icons';
import { TreatmentPlansTab } from './ClinicLayout';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 8, font: 'inherit', color: '#111827' };
const labelStyle = { display: 'grid', gap: 5, color: '#1f2937', fontSize: 15, fontWeight: 600 };
const buttonStyle = { padding: '9px 13px', border: 0, borderRadius: 8, background: '#005447', color: '#fff', fontWeight: 700, cursor: 'pointer' };

async function request(user, path, options = {}) {
  if (!user?.token || !user?.clinic_id) throw new Error('Clinic session is unavailable. Sign in again and retry.');
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${API_URL}${path}${separator}clinic_id=${encodeURIComponent(user.clinic_id)}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${user.token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (HTTP ${response.status}).`);
  return payload;
}

function PrescriptionForm({ user, patientId, plans, defaultPlanId, onSaved, onCancel }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const treatmentPlanId = String(form.get('treatment_plan_id') || '');
    const payload = Object.fromEntries(['medication', 'dosage', 'route', 'frequency', 'start_date', 'end_date', 'instructions'].map(key => [key, String(form.get(key) || '').trim()]));
    payload.pet_id = Number(patientId);
    if (treatmentPlanId) payload.treatment_plan_id = Number(treatmentPlanId);
    setSaving(true);
    setError('');
    try {
      await request(user, '/clinic-records/treatments', { method: 'POST', body: JSON.stringify(payload) });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };
  return <form onSubmit={save} style={{ display: 'grid', gap: 11, padding: 16, margin: '14px 0', border: '1px solid #dce7e3', borderRadius: 12, background: '#fff' }}>
    <strong>Prescribe medication</strong>
    <label style={labelStyle}>Medication<input name="medication" required style={inputStyle} /></label>
    <label style={labelStyle}>Dosage<input name="dosage" required style={inputStyle} /></label>
    <label style={labelStyle}>Route<input name="route" style={inputStyle} /></label>
    <label style={labelStyle}>Frequency<input name="frequency" style={inputStyle} /></label>
    <label style={labelStyle}>Start date<LabDateTimePicker name="start_date" mode="date" style={inputStyle} /></label>
    <label style={labelStyle}>End date<LabDateTimePicker name="end_date" mode="date" style={inputStyle} /></label>
    <label style={labelStyle}>Treatment plan (optional)<select name="treatment_plan_id" defaultValue={defaultPlanId || ''} style={inputStyle}><option value="">No linked plan</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label>
    <label style={labelStyle}>Instructions<textarea name="instructions" rows="2" style={inputStyle} /></label>
    {error && <div role="alert" style={{ color: '#b42318', fontSize: 13 }}>{error}</div>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={onCancel} style={{ ...buttonStyle, background: '#e5e7eb', color: '#334155' }}>Cancel</button><button disabled={saving} style={buttonStyle}>{saving ? 'Saving…' : 'Save prescription'}</button></div>
  </form>;
}

export function PatientMedicationsPanel({ user, patientId, patientName, onCountChange }) {
  const [medications, setMedications] = useState([]);
  const [plans, setPlans] = useState([]);
  const [treatmentRecords, setTreatmentRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [medicationSearch, setMedicationSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [datePopoverPosition, setDatePopoverPosition] = useState(null);
  const dateRangeRef = useRef(null);
  const dateRangeButtonRef = useRef(null);
  const datePopoverRef = useRef(null);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const load = useCallback(async () => {
    if (!patientId) { setMedications([]); setPlans([]); setTreatmentRecords([]); onCountChange?.(0); setLoading(false); return; }
    setLoading(true);
    try {
      const query = `?pet_id=${encodeURIComponent(patientId)}`;
      const [items, planItems, recordItems] = await Promise.all([
        request(user, `/clinic-records/treatments${query}&include_archived=true`),
        request(user, `/clinic-records/treatment-plans${query}`),
        request(user, `/clinic-records/treatment-records${query}`),
      ]);
      setMedications(items);
      onCountChange?.(items.length);
      setPlans(planItems);
      setTreatmentRecords(recordItems);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [user, patientId, patientName, onCountChange]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!dateRangeOpen) return undefined;
    const updatePopoverPosition = () => {
      const trigger = dateRangeButtonRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = Math.min(290, window.innerWidth - 16);
      const estimatedHeight = datePopoverRef.current?.offsetHeight || 205;
      const spaceBelow = window.innerHeight - trigger.bottom;
      const placeAbove = spaceBelow < estimatedHeight + 8 && trigger.top > spaceBelow;
      setDatePopoverPosition({
        left: Math.max(8, Math.min(trigger.right - width, window.innerWidth - width - 8)),
        ...(placeAbove
          ? { bottom: window.innerHeight - trigger.top + 6 }
          : { top: trigger.bottom + 6 }),
        width,
        maxHeight: Math.max(120, window.innerHeight - 16),
      });
    };
    const closeOnOutsideClick = event => {
      if (!dateRangeRef.current?.contains(event.target) && !datePopoverRef.current?.contains(event.target)) {
        setDateRangeOpen(false);
      }
    };
    updatePopoverPosition();
    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [dateRangeOpen]);
  const displayDate = value => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : formatDateText(date);
  };
  const medicationStatus = item => {
    if (item.archived) return 'archived';
    const status = String(item.status || 'active').toLowerCase().replace(/[\s-]+/g, '_');
    if (['on_hold', 'hold', 'paused'].includes(status)) return 'on_hold';
    if (['cancelled', 'canceled'].includes(status)) return 'discontinued';
    if (status === 'finalized') return 'completed';
    return status;
  };
  const filteredMedications = medications.filter(item => {
    const normalizedStatus = medicationStatus(item);
    const issuedDate = String(item.issued_at || item.start_date || '').slice(0, 10);
    const query = medicationSearch.trim().toLowerCase();
    const matchesSearch = !query || [
      item.medication,
      item.treatment_plan_diagnosis,
      item.treatment_plan,
      item.id,
    ].some(value => String(value || '').toLowerCase().includes(query));
    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
    const hasPlan = Boolean(item.treatment_plan_id || item.treatment_plan);
    const matchesType = typeFilter === 'all'
      || (typeFilter === 'linked' && hasPlan)
      || (typeFilter === 'standalone' && !hasPlan);
    const matchesDateFrom = !dateFrom || (issuedDate && issuedDate >= dateFrom);
    const matchesDateTo = !dateTo || (issuedDate && issuedDate <= dateTo);
    return matchesSearch && matchesStatus && matchesType && matchesDateFrom && matchesDateTo;
  });
  const medicationStatusOptions = [
    ['all', 'All status', medications.length],
    ['active', 'Active', medications.filter(item => !item.archived && medicationStatus(item) === 'active').length],
    ['completed', 'Completed', medications.filter(item => !item.archived && medicationStatus(item) === 'completed').length],
    ['discontinued', 'Discontinued', medications.filter(item => !item.archived && medicationStatus(item) === 'discontinued').length],
    ['on_hold', 'On hold', medications.filter(item => !item.archived && medicationStatus(item) === 'on_hold').length],
    ['archived', 'Archived', medications.filter(item => item.archived).length],
  ];
  const dateRangeLabel = dateFrom || dateTo
    ? `${dateFrom ? displayDate(dateFrom) : 'Start'} – ${dateTo ? displayDate(dateTo) : 'Present'}`
    : 'Date range';
  const duration = item => {
    if (!item.start_date || !item.end_date) return '—';
    const start = new Date(`${String(item.start_date).slice(0, 10)}T00:00:00`);
    const end = new Date(`${String(item.end_date).slice(0, 10)}T00:00:00`);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    return Number.isFinite(days) && days >= 0 ? `${days || 1} days` : '—';
  };
  const instructions = String(selectedMedication?.instructions || '').split(/\n|(?<=\.)\s+/).filter(Boolean);
  const selectedRelatedRecords = selectedMedication
    ? treatmentRecords.filter(record => record.medications?.some(medication => String(medication.id) === String(selectedMedication.id)))
    : [];
  const toggleArchived = async () => {
    if (!selectedMedication || selectedMedication.isMock) return;
    setArchiveSaving(true);
    setArchiveError('');
    try {
      const updated = await request(user, `/clinic-records/treatments/${selectedMedication.id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({
          archived: !selectedMedication.archived,
          reason: selectedMedication.archived ? 'Prescription restored from patient medication history.' : 'Prescription archived from patient medication history.',
        }),
      });
      setSelectedMedication(updated);
      await load();
    } catch (archiveError) {
      setArchiveError(archiveError.message);
    } finally {
      setArchiveSaving(false);
    }
  };

  return <section className="detail-panel">
    <div className="detail-panel-heading">
      <span>Medications</span>
    </div>
    {!patientId && <div className="detail-summary-note" role="alert">This patient is not connected to a saved clinic record, so prescriptions cannot be saved.</div>}
    {open && <PrescriptionForm user={user} patientId={patientId} plans={plans} onCancel={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    {error && <div className="detail-summary-note" role="alert">{error}</div>}
    <div className="lab-status-row patient-record-status-row">
      <div className="lab-status-filters" role="tablist" aria-label="Medication status">
        {medicationStatusOptions.map(([value, label, count]) => <button key={value} type="button" role="tab" aria-selected={statusFilter === value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>{value === 'all' ? 'All' : label}<span>{count}</span></button>)}
      </div>
      <button type="button" className="detail-edit patient-primary-add" disabled={!patientId} onClick={() => setOpen(!open)}>{Icons.plus} Add medication</button>
    </div>
    <div className="medication-filter-bar patient-record-filter-controls" role="search" aria-label="Search and filter medications">
      <label className="medication-search">
      {Icons.search}
        <input
          type="search"
          value={medicationSearch}
          onChange={event => setMedicationSearch(event.target.value)}
          placeholder="Search medication name, reason, or prescription ID..."
          aria-label="Search medication name, reason, or prescription ID"
        />
      </label>
      <FilterSelect label="Filter by type" className="medication-filter-select" value={typeFilter} onChange={setTypeFilter} options={[
        { value: 'all', label: 'All type' },
        { value: 'linked', label: 'Treatment plan' },
        { value: 'standalone', label: 'Standalone' },
      ]} />
      <div className="medication-date-filter" ref={dateRangeRef}>
        <button ref={dateRangeButtonRef} type="button" aria-expanded={dateRangeOpen} onClick={() => setDateRangeOpen(value => !value)}>
          <span className="medication-date-icon" aria-hidden="true">{Icons.calendar}</span>{dateRangeLabel}
        </button>
        {dateRangeOpen && datePopoverPosition && createPortal(<div ref={datePopoverRef} className="medication-date-popover" style={{ ...datePopoverPosition, position: 'fixed', zIndex: 2000, overflowY: 'auto' }}>
          <label>From<LabDateTimePicker mode="date" value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} /></label>
          <label>To<LabDateTimePicker mode="date" value={dateTo} min={dateFrom || undefined} onChange={setDateTo} /></label>
          <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear dates</button>
        </div>, document.body)}
      </div>
    </div>
    {loading ? <div className="detail-summary-note">Loading medication records…</div> : filteredMedications.length ? (
      <div className="vaccine-records-wrap medication-records-wrap">
        <table className="vaccine-records-table">
          <thead><tr><th>Prescribed</th><th>Medication</th><th>Dosage / Route</th><th>Frequency</th><th>Course</th><th>Treatment plan</th><th>Status</th><th aria-hidden="true"></th></tr></thead>
          <tbody>{filteredMedications.map(item => {
            const normalizedStatus = medicationStatus(item).replace(/_/g, ' ');
            return <tr
              key={item.id}
              tabIndex={0}
              aria-label={`View ${item.medication} prescription details`}
              aria-haspopup="dialog"
              onClick={() => setSelectedMedication(item)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedMedication(item);
                }
              }}
            >
              <td>{displayDate(item.issued_at || item.start_date)}</td>
              <td><strong className="vaccine-name">{item.medication || 'Medication'}</strong><span className="vaccine-secondary">{item.isMock ? item.issued_by : `Prescribed by ${item.issued_by || 'Clinic team'}`}</span></td>
              <td>{[item.dosage, item.route].filter(Boolean).join(' · ') || '—'}</td>
              <td>{item.frequency || '—'}</td>
              <td>{item.start_date || item.end_date ? `${displayDate(item.start_date)} – ${displayDate(item.end_date)}` : '—'}</td>
              <td>{item.treatment_plan || 'Not linked'}</td>
              <td><span className={`vaccine-due-state ${normalizedStatus === 'active' ? 'up-to-date' : 'unknown'}`}><span className="vaccine-status-dot" />{normalizedStatus}</span></td>
              <td aria-hidden="true"><span className="vaccine-row-arrow">›</span></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    ) : <div className="detail-summary-note">{medications.length ? `No prescriptions match these filters for ${patientName}.` : `No prescriptions recorded for ${patientName}.`}</div>}
    {selectedMedication && <div className="record-side-panel-backdrop" onClick={() => setSelectedMedication(null)} />}
    {selectedMedication && <aside className="visit-detail-panel medication-detail-panel" role="dialog" aria-modal="false" aria-label="Medication details">
      <header className="medication-detail-header">
        <div className="medication-detail-heading">
          <h2>Medication Details</h2>
          <button type="button" className="visit-detail-close" aria-label="Close medication details" onClick={() => setSelectedMedication(null)}>×</button>
        </div>
        <div className="medication-detail-summary">
          <div>
            <h3>{selectedMedication.medication || 'Prescription'}</h3>
            <p>{[selectedMedication.dosage, selectedMedication.route].filter(Boolean).join(' · ') || 'Dose and route not recorded'}</p>
          </div>
          <span className={`medication-status-pill ${medicationStatus(selectedMedication)}`}>{medicationStatus(selectedMedication).replace(/_/g, ' ')}</span>
        </div>
        {selectedMedication.isMock && <div className="medication-detail-example">Example only · not prescribed</div>}
      </header>
      <div className="medication-detail-body">
        <section className="medication-detail-section medication-diagnosis-section">
          <div className="medication-diagnosis-grid">
            <div><span>Reason / Diagnosis</span><strong>{selectedMedication.treatment_plan || selectedMedication.treatment_plan_diagnosis || 'Not recorded'}</strong><small>{selectedMedication.treatment_plan && selectedMedication.treatment_plan_diagnosis ? selectedMedication.treatment_plan_diagnosis : ' '}</small></div>
            <div><span>Prescribing Veterinarian</span><strong>{selectedMedication.issued_by || 'Clinic team'}</strong><small>Veterinarian</small></div>
          </div>
        </section>
        <section className="medication-detail-section medication-dosing-section">
          <div className="medication-dosing-grid">
            <div><span>Dosage &amp; Route</span><strong>{[selectedMedication.dosage, selectedMedication.route].filter(Boolean).join(' · ') || 'Not recorded'}</strong><small>{selectedMedication.quantity || ' '}</small></div>
            <div><span>Frequency</span><strong>{selectedMedication.frequency || 'Not recorded'}</strong><small>{selectedMedication.frequency ? 'Administration schedule' : ' '}</small></div>
          </div>
          <div className="medication-dates-grid">
            <div><span>Start Date</span><strong>{displayDate(selectedMedication.start_date)}</strong></div>
            <div><span>End Date</span><strong>{displayDate(selectedMedication.end_date)}</strong></div>
            <div><span>Duration</span><strong>{duration(selectedMedication)}</strong></div>
          </div>
        </section>
        <section className="medication-detail-section medication-plan-card">
          <div><h3>Treatment Plan</h3><span>{selectedMedication.treatment_plan ? `Linked to "${selectedMedication.treatment_plan}"` : 'No linked treatment plan'}</span></div>
        </section>
        <section className="medication-detail-section medication-instructions-section">
          <h3>Instructions</h3>
          {instructions.length
            ? <ul>{instructions.map((instruction, index) => <li key={`${index}-${instruction}`}>{instruction}</li>)}</ul>
            : <p>No additional instructions recorded.</p>}
        </section>
        <section className="medication-detail-section medication-status-history" id="medication-status-history">
          <h3>Status History</h3>
          <div className={`medication-history-entry current ${medicationStatus(selectedMedication)}`}><div><strong>{medicationStatus(selectedMedication).replace(/_/g, ' ')}</strong><small>{displayDate(selectedMedication.start_date || selectedMedication.issued_at)} — {selectedMedication.end_date ? displayDate(selectedMedication.end_date) : 'Present'}</small><small>{selectedMedication.issued_by ? `Prescribed by ${selectedMedication.issued_by}` : 'Prescription status'}</small></div></div>
          {selectedRelatedRecords.flatMap(record => (record.medications || [])
            .filter(medication => String(medication.id) === String(selectedMedication.id) && medication.administered)
            .map(medication => <div className="medication-history-entry" key={`administered-${record.id}`}><div><strong>Administered</strong><small>{displayDate(record.performed_at)}</small><small>{record.veterinarian || 'Treatment record'}</small></div></div>))}
          <div className="medication-history-entry created"><div><strong>Created</strong><small>{displayDate(selectedMedication.issued_at)}</small><small>{selectedMedication.issued_by || 'Clinic team'}</small></div></div>
        </section>
        <section className="medication-history-collapsible">
          <button
            type="button"
            className="medication-history-button"
            aria-expanded={historyOpen}
            aria-controls="full-medication-history"
            onClick={() => setHistoryOpen(value => !value)}
          >
            {historyOpen ? 'Hide full prescription history' : 'View full prescription history'}
          </button>
          {historyOpen && <div className="medication-history-expanded" id="full-medication-history">
            <div className="medication-history-entry created"><div><strong>Prescription created</strong><small>{displayDate(selectedMedication.issued_at)}</small><small>{selectedMedication.issued_by || 'Clinic team'}</small></div></div>
            {selectedMedication.start_date && <div className="medication-history-entry"><div><strong>Course started</strong><small>{displayDate(selectedMedication.start_date)}</small></div></div>}
            {selectedRelatedRecords.flatMap(record => (record.medications || [])
              .filter(medication => String(medication.id) === String(selectedMedication.id) && medication.administered)
              .map(medication => <div className="medication-history-entry" key={`history-administered-${record.id}`}><div><strong>Administered</strong><small>{displayDate(record.performed_at)}</small><small>{record.veterinarian || 'Treatment record'}</small></div></div>))}
            <div className="medication-history-entry current"><div><strong>Current status: {medicationStatus(selectedMedication).replace(/_/g, ' ')}</strong><small>{selectedMedication.end_date ? `Course ends ${displayDate(selectedMedication.end_date)}` : 'No end date recorded'}</small></div></div>
            {!selectedMedication.issued_at && !selectedMedication.start_date && selectedRelatedRecords.length === 0 && <p>No prescription history has been recorded yet.</p>}
          </div>}
        </section>
        <footer className="medication-detail-actions">
          {!selectedMedication.isMock && <>
            {archiveError && <p role="alert">{archiveError}</p>}
          <button
            type="button"
            className="detail-edit"
            disabled={archiveSaving}
            onClick={toggleArchived}
            style={selectedMedication.archived ? undefined : { color: '#b42318', borderColor: '#f0c9c7' }}
          >{archiveSaving ? 'Saving…' : selectedMedication.archived ? 'Restore prescription' : 'Archive prescription'}</button>
          </>}
        </footer>
      </div>
    </aside>}
  </section>;
}

export function PatientTreatmentRecordsPanel({ user, patientId, patientName, onCountChange }) {
  const [treatmentRecords, setTreatmentRecords] = useState([]);
  const [treatmentPlans, setTreatmentPlans] = useState([]);
  const [selectedTreatmentRecord, setSelectedTreatmentRecord] = useState(null);
  const [standalonePlanRequest, setStandalonePlanRequest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const load = useCallback(async () => {
    if (!patientId) { setTreatmentRecords([]); setTreatmentPlans([]); onCountChange?.(0); setLoading(false); return; }
    setLoading(true);
    try {
      const query = `?pet_id=${encodeURIComponent(patientId)}`;
      const [recordRows, planRows] = await Promise.all([
        request(user, `/clinic-records/treatment-records${query}`),
        request(user, `/clinic-records/treatment-plans${query}&include_archived=true`),
      ]);
      setTreatmentRecords(recordRows);
      setTreatmentPlans(planRows);
      onCountChange?.(recordRows.length + planRows.length);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [user, patientId, onCountChange]);
  useEffect(() => { load(); }, [load]);
  const visibleRows = [
    ...treatmentPlans.filter(plan => !plan.archived).map(plan => ({ kind: 'plan', id: plan.id, plan, date: plan.created_at, title: plan.title || 'Treatment plan', detail: plan.diagnosis || 'Diagnosis not recorded', status: plan.status || 'active' })),
    ...treatmentRecords.map(record => ({ kind: 'record', id: record.id, record, date: record.performed_at, title: record.procedure || 'Treatment', detail: record.diagnosis || 'Diagnosis not recorded', status: record.status || 'completed' })),
  ].filter(row => {
    const matchesSearch = [row.title, row.detail, row.status, ...(row.plan?.prescriptions || []).map(item => item.medication)]
      .some(value => String(value || '').toLowerCase().includes(search.toLowerCase()));
    const normalizedStatus = String(row.status).toLowerCase();
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' ? ['active', 'paused'].includes(normalizedStatus) : normalizedStatus === statusFilter);
    return matchesSearch && matchesStatus;
  }).sort((a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0));
  const createPlan = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const diagnosis = String(form.get('diagnosis') || '').trim();
    const step = String(form.get('step') || '').trim();
    if (!title || !diagnosis || !step) {
      setCreateError('Enter a plan title, diagnosis, and at least one treatment step.');
      return;
    }
    setSavingPlan(true);
    setCreateError('');
    try {
      await request(user, '/clinic-records/treatment-plans', {
        method: 'POST',
        body: JSON.stringify({
          pet_id: Number(patientId),
          title,
          diagnosis,
          steps: [{ title: step, done: false }],
        }),
      });
      setCreateOpen(false);
      await load();
    } catch (createPlanError) {
      setCreateError(createPlanError.message || 'Unable to create the care plan.');
    } finally {
      setSavingPlan(false);
    }
  };
  return <section className="detail-panel">
    {!patientId && <p role="alert" style={{ color: '#9a6700', fontSize: 13 }}>This patient is not connected to a saved clinic record, so treatments and plans cannot be saved yet.</p>}
    {error && <p role="alert" style={{ color: '#b42318', fontSize: 13 }}>{error}</p>}
    {loading ? <p style={{ color: '#1f2937', fontSize: 13 }}>Loading treatment records and care plans…</p> : <>
      <div className="lab-status-row patient-record-status-row">
        <div className="lab-status-filters" role="tablist" aria-label="Care plan status">
          {[
            ['all', 'All plans', treatmentPlans.filter(plan => !plan.archived).length],
            ['active', 'In progress', treatmentPlans.filter(plan => !plan.archived && !['completed', 'finalized'].includes(String(plan.status || '').toLowerCase())).length],
            ['completed', 'Completed', treatmentPlans.filter(plan => !plan.archived && ['completed', 'finalized'].includes(String(plan.status || '').toLowerCase())).length],
          ].map(([value, label, count]) => <button key={value} type="button" role="tab" aria-selected={statusFilter === value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>{label}<span>{count}</span></button>)}
        </div>
        <button type="button" className="detail-edit patient-primary-add" disabled={!patientId} onClick={() => { setCreateError(''); setCreateOpen(value => !value); }}>{createOpen ? 'Cancel' : 'New care plan'}</button>
      </div>
      <div style={{ marginBottom: 13 }}>
        <label className="medication-search">
          {Icons.search}
          <input type="search" aria-label="Search treatment records" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search care plans, procedures, or medications..." />
        </label>
      </div>
      {createOpen && <form onSubmit={createPlan} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14, padding: 13, border: '1px solid #dce7e3', borderRadius: 9, background: '#f8fbfa' }}>
        <label style={labelStyle}>Plan title<input name="title" required style={inputStyle} /></label>
        <label style={labelStyle}>Diagnosis<input name="diagnosis" required style={inputStyle} /></label>
        <label style={labelStyle}>Treatment step<input name="step" required style={inputStyle} /></label>
        {createError && <p role="alert" style={{ gridColumn: '1 / -1', margin: 0, color: '#b42318', fontSize: 13 }}>{createError}</p>}
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}><button type="submit" disabled={savingPlan} style={buttonStyle}>{savingPlan ? 'Saving…' : 'Save care plan'}</button></div>
      </form>}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 9 }}>
        <table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead><tr>{[['Care plan / Procedure', '30%'], ['Date created', '15%'], ['Progress', '17%'], ['Medication', '14%'], ['Status', '14%'], ['Actions', '10%']].map(([label, width]) => <th key={label} style={{ width, padding: '10px 9px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', color: '#1f2937', fontSize: 12, fontWeight: 700, textAlign: 'left' }}>{label}</th>)}</tr></thead>
          <tbody>{visibleRows.map(row => {
            const steps = Array.isArray(row.plan?.steps) ? row.plan.steps : [];
            const completed = row.plan?.status === 'completed' ? steps.length : steps.filter(step => step && typeof step === 'object' && step.done).length;
            const total = steps.length || 1;
            const medications = row.plan?.prescriptions || [];
            const isCompleted = ['completed', 'finalized'].includes(String(row.status).toLowerCase());
            return <tr key={`${row.kind}-${row.id}`}>
              <td style={{ padding: '11px 9px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ color: '#172b25', fontSize: 13, fontWeight: 700 }}>{row.title}</div>
                <small style={{ display: 'block', marginTop: 4, color: '#334155', fontSize: 12 }}>{row.detail}</small>
              </td>
              <td style={{ padding: '11px 9px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: 12 }}>{row.date ? formatDateText(row.date) : '—'}</td>
              <td style={{ padding: '11px 9px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: 12 }}>
                {row.kind === 'plan' ? <><div>{completed}/{total} steps</div><div style={{ height: 5, marginTop: 5, borderRadius: 5, background: '#e2e8f0', overflow: 'hidden' }}><div style={{ width: `${Math.round(completed / total * 100)}%`, height: '100%', background: '#0c8b6e' }} /></div></> : 'Completed'}
              </td>
              <td style={{ padding: '11px 9px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: 12 }}>{row.kind === 'plan' ? `${medications.length} prescribed` : '—'}</td>
              <td style={{ padding: '11px 9px', borderBottom: '1px solid #e2e8f0' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 14, background: isCompleted ? '#e7f7ef' : '#f1f5f9', color: isCompleted ? '#075c35' : '#334155', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{row.status}</span></td>
              <td style={{ padding: '11px 9px', borderBottom: '1px solid #e2e8f0' }}><button type="button" onClick={() => row.kind === 'plan' ? setStandalonePlanRequest({ planId: row.plan.id }) : setSelectedTreatmentRecord(row.record)} style={{ minHeight: 36, border: 0, background: 'transparent', color: '#005447', padding: '0 4px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{row.kind === 'plan' ? 'View plan' : 'View record'}</button></td>
            </tr>;
          })}{!visibleRows.length && <tr><td colSpan={6} style={{ padding: 18, color: '#334155', fontSize: 14, textAlign: 'center' }}>{search || statusFilter !== 'all' ? 'No records match these filters.' : 'No treatment plans or records for this patient.'}</td></tr>}</tbody>
        </table>
      </div>
    </>}
    {standalonePlanRequest && <TreatmentPlansTab user={user} patientName={patientName} standalonePlanRequest={standalonePlanRequest} onStandalonePlanClose={() => setStandalonePlanRequest(null)} />}
    {selectedTreatmentRecord && <div className="record-side-panel-backdrop" onClick={() => setSelectedTreatmentRecord(null)} />}
    {selectedTreatmentRecord && <aside className="visit-detail-panel" role="dialog" aria-modal="false" aria-label={`${selectedTreatmentRecord.procedure} treatment record`}>
      <header className="visit-detail-header">
        <div>
          <div className="visit-detail-title-row"><h2>{selectedTreatmentRecord.procedure || 'Treatment record'}</h2></div>
          <div className="visit-detail-meta">{patientName} · Treatment record</div>
        </div>
        <button type="button" className="visit-detail-close" aria-label="Close treatment record details" onClick={() => setSelectedTreatmentRecord(null)}>×</button>
      </header>
      <div className="visit-detail-body">
        <div className="visit-detail-intro">
          <div className="visit-detail-field"><span>Status</span><strong>{selectedTreatmentRecord.status || 'completed'}</strong></div>
          <div className="visit-detail-field"><span>Diagnosis</span><strong>{selectedTreatmentRecord.diagnosis || 'Not recorded'}</strong></div>
          <div className="visit-detail-field"><span>Date</span><strong>{selectedTreatmentRecord.performed_at ? formatDateTimeText(selectedTreatmentRecord.performed_at) : 'Not recorded'}</strong></div>
          <div className="visit-detail-field"><span>Veterinarian</span><strong>{selectedTreatmentRecord.veterinarian || 'Clinic team'}</strong></div>
          {selectedTreatmentRecord.treatment_plan && <div className="visit-detail-field"><span>Related plan</span><strong>{selectedTreatmentRecord.treatment_plan}</strong></div>}
          <div className="visit-detail-field"><span>Cost</span><strong>{selectedTreatmentRecord.cost != null ? Number(selectedTreatmentRecord.cost).toLocaleString(undefined, { style: 'currency', currency: 'PHP' }) : 'Not recorded'}</strong></div>
        </div>
        <section className="visit-detail-section"><h3>Outcome</h3><p className="visit-detail-empty">{selectedTreatmentRecord.outcome || 'No outcome recorded.'}</p></section>
        <section className="visit-detail-section"><h3>Treatment details</h3><p className="visit-detail-empty">{selectedTreatmentRecord.notes || 'No additional treatment details recorded.'}</p></section>
        <section className="visit-detail-section"><h3>Follow-up instructions</h3><p className="visit-detail-empty">{selectedTreatmentRecord.follow_up_instructions || 'No follow-up instructions recorded.'}</p></section>
      </div>
    </aside>}
  </section>;
}

const clinicUserPropType = PropTypes.shape({
  clinic_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  token: PropTypes.string.isRequired,
});
const planShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  pet_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  pet: PropTypes.string,
  title: PropTypes.string,
  diagnosis: PropTypes.string,
  status: PropTypes.string,
  severity: PropTypes.string,
  follow_up: PropTypes.string,
  veterinarian: PropTypes.string,
  steps: PropTypes.array,
  prescriptions: PropTypes.array,
});
const planListPropType = PropTypes.arrayOf(planShape);

PrescriptionForm.propTypes = {
  user: clinicUserPropType.isRequired,
  patientId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  plans: planListPropType.isRequired,
  defaultPlanId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSaved: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
PatientMedicationsPanel.propTypes = {
  user: clinicUserPropType.isRequired,
  patientId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  patientName: PropTypes.string.isRequired,
  onCountChange: PropTypes.func,
};
PatientTreatmentRecordsPanel.propTypes = {
  user: clinicUserPropType.isRequired,
  patientId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  patientName: PropTypes.string.isRequired,
  onCountChange: PropTypes.func,
};
