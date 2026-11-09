import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../../components/Topbar';
import StatusIndicator from '../../components/StatusIndicator';
import RecordActionsModal from '../../components/RecordActionsModal';
import LabDateTimePicker from '../../components/LabDateTimePicker';
import { Icons } from '../../icons';
import { canViewFeature } from '../../utils/permissionUtils';
import AppointmentWorkflowDialog from './AppointmentWorkflowDialog';
import './patientQueue.css';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const normalize = value => String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const time = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const minutes = (from, to) => {
  const value = (new Date(to) - new Date(from)) / 60000;
  return from && to && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
};
async function request(user, path, options = {}) {
  const response = await fetch(`${api}/clinic-records${path}`, {
    ...options, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Unable to load queue information.');
  return result;
}

function WalkInDialog({ user, onClose, onSaved }) {
  const dialog = useRef(null);
  const [pets, setPets] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [pet, setPet] = useState('');
  const [doctor, setDoctor] = useState('');
  const [reason, setReason] = useState('Consultation');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    let active = true;
    Promise.all([request(user, '/pets'), request(user, '/registration-doctors')]).then(([patients, vets]) => {
      if (active) { setPets(patients.filter(item => !item.archived)); setDoctors(vets); }
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; previous?.focus(); };
  }, [user.token]);
  const submit = async event => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await request(user, '/patient-queue/walk-in', { method: 'POST', body: JSON.stringify({ pet_id: pet, practitioner_id: doctor, reason }) });
      window.dispatchEvent(new Event('vetintel:appointment-updated'));
      onSaved(); onClose();
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  };
  return <dialog ref={dialog} className="reception-workflow-dialog clinic-record-details-modal" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={submit}><header className="clinic-record-details-header"><div><h2>Add Walk-in</h2><p>Check in a registered patient and notify the assigned veterinarian.</p></div><button type="button" disabled={saving} onClick={onClose}>Close</button></header>
      <section className="reception-workflow-body record-details-content">
        {error && <p role="alert" className="reception-action-error">{error}</p>}
        {loading ? <p>Loading patients and veterinarians…</p> : <>
          <label>Patient<select required value={pet} onChange={event => setPet(event.target.value)}><option value="">Select registered patient</option>{pets.map(item => <option key={item.id} value={item.id}>{item.name} · {item.owner || item.owner_name || 'Owner not recorded'}</option>)}</select></label>
          <label>Veterinarian<select required value={doctor} onChange={event => setDoctor(event.target.value)}><option value="">Select veterinarian</option>{doctors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Visit type<input required maxLength={200} value={reason} onChange={event => setReason(event.target.value)} /></label>
          <p>New patients must complete registration and approval before being added to the queue.</p>
        </>}
      </section><footer><button type="button" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="is-save" disabled={loading || saving || !pet || !doctor || !reason.trim()}>{saving ? 'Adding…' : 'Add to Queue'}</button></footer>
    </form>
  </dialog>;
}

export default function PatientQueuePage({ user }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(() => localDate());
  const [doctor, setDoctor] = useState('');
  const [tab, setTab] = useState('all');
  const [updated, setUpdated] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [refresh, setRefresh] = useState(0);
  const [walkIn, setWalkIn] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const canView = canViewFeature(user.permissions, user.role, 'Patient Queue');
  useEffect(() => {
    if (!canView || !user.token) return undefined;
    let active = true, refreshing = false;
    setLoading(true);
    const load = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const start = new Date(`${date}T00:00:00`);
        const end = new Date(start); end.setDate(end.getDate() + 1);
        const rows = await request(user, `/patient-queue?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`);
        if (!Array.isArray(rows)) throw new Error('The queue endpoint returned invalid data.');
        if (active) { setQueue(rows); setUpdated(new Date()); setError(''); }
      } catch (error) { if (active) setError(error.message); }
      finally { refreshing = false; if (active) setLoading(false); }
    };
    load();
    const visibleRefresh = () => { if (!document.hidden) load(); };
    const timer = window.setInterval(visibleRefresh, 15000);
    window.addEventListener('focus', visibleRefresh);
    window.addEventListener('vetintel:appointment-updated', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', visibleRefresh); window.removeEventListener('vetintel:appointment-updated', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh); };
  }, [canView, user.token, date, refresh]);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  const records = queue.filter(item => ['waiting','in_consultation','completed'].includes(normalize(item.status)));
  const waiting = records.filter(item => normalize(item.status) === 'waiting');
  const consulting = records.filter(item => normalize(item.status) === 'in_consultation');
  const completed = records.filter(item => normalize(item.status) === 'completed');
  const doctors = [...new Map(records.filter(item => item.practitioner_id).map(item => [String(item.practitioner_id), item.practitioner])).entries()];
  const filtered = useMemo(() => queue.filter(item => {
    const status = normalize(item.status);
    const query = search.trim().toLowerCase().replace(/^#/, '');
    return ['waiting','in_consultation','completed'].includes(status)
      && (tab === 'all' || status === tab)
      && (!doctor || String(item.practitioner_id) === doctor)
      && (!query || [item.pet,item.owner,String(item.position)].some(value => String(value || '').toLowerCase().includes(query)));
  }), [queue, tab, doctor, search]);
  const waits = records.map(item => minutes(item.checkin_at, item.consultation_started_at || (normalize(item.status) === 'waiting' ? now : null))).filter(value => value !== null);
  const currentWaits = waiting.map(item => minutes(item.checkin_at, now)).filter(value => value !== null);
  const selected = queue.find(item => item.id === selectedId);
  const refreshQueue = () => setRefresh(value => value + 1);
  const openAction = action => { setWorkflow({ action, appointment: { id: selected.appointment_id, pet: selected.pet, owner: selected.owner, practitioner: selected.practitioner, status: selected.status, reason: selected.visit_type } }); setSelectedId(null); };
  return <div className="patient-queue-page">
    <Topbar user={user} title="Patient Queue" subtitle="Monitor checked-in patients and coordinate patient flow." />
    <div className="patient-queue-content">
      {!canView ? <p role="alert">You do not have permission to view the patient queue.</p> : <>
        <section className="patient-queue-summary" aria-label="Queue summary">{[
          ['Total in Queue', waiting.length + consulting.length, ''], ['Waiting', waiting.length, 'is-waiting'],
          ['In Consultation', consulting.length, ''], [date === localDate() ? 'Walk-ins Today' : 'Walk-ins', records.filter(item => item.workflow_type === 'walk_in').length, ''],
        ].map(([label,value,tone]) => <article className={`patient-queue-stat ${tone}`} key={label}><span>{label}</span><strong>{loading ? '—' : value}</strong></article>)}</section>
        <section className="patient-queue-card">
          <header className="patient-queue-card-heading"><h2>Current Queue</h2><div><span>{updated ? `Updated: ${updated.toLocaleDateString()} · ${time(updated)}` : 'Not yet updated'}</span><button type="button" className="patient-queue-refresh" aria-label="Refresh queue" onClick={refreshQueue}>{Icons.refresh || '↻'}</button></div></header>
          <div className="patient-queue-toolbar"><nav aria-label="Queue status">{[['all','All',records.length],['waiting','Waiting',waiting.length],['in_consultation','In Consultation',consulting.length],['completed','Completed',completed.length]].map(([id,label,count]) => <button type="button" key={id} aria-pressed={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label} ({count})</button>)}</nav><button type="button" className="patient-queue-add" onClick={() => setWalkIn(true)}>{Icons.plus} Add Walk-in</button></div>
          <div className="patient-queue-filters"><label className="patient-queue-search">{Icons.search}<input aria-label="Search pet, owner, or queue number" placeholder="Search pet, owner, or queue number…" value={search} onChange={event => setSearch(event.target.value)} /></label><LabDateTimePicker mode="date" label="Queue date" value={date} onChange={value => { if (value) setDate(value); }} /><select aria-label="Filter queue by veterinarian" value={doctor} onChange={event => setDoctor(event.target.value)}><option value="">All Veterinarians</option>{doctors.map(([id,name]) => <option key={id} value={id}>{name || 'Unassigned'}</option>)}</select></div>
          {error && <p className="reception-action-error" role="alert">{error}</p>}
          <div className="lab-results-table-wrap"><table className="lab-results-table patient-queue-table"><thead><tr>{['Queue #','Check-in Time','Pet','Owner','Visit Type','Veterinarian','Wait Time','Status',''].map(label => <th key={label} aria-label={label || 'Queue actions'}>{label}</th>)}</tr></thead><tbody>
            {loading ? <tr><td colSpan={9} className="lab-results-empty">Loading patient queue…</td></tr> : filtered.length ? filtered.map(item => <tr key={item.id} className="clinic-action-row" tabIndex={0} aria-haspopup="dialog" aria-label={`Queue actions for ${item.pet}`} onClick={() => setSelectedId(item.id)} onKeyDown={event => { if (event.currentTarget === event.target && ['Enter',' '].includes(event.key)) { event.preventDefault(); setSelectedId(item.id); } }}>
              <td><strong>#{item.position}</strong></td><td>{time(item.checkin_at)}</td><td className="lab-result-pet"><div className="lab-result-test"><strong>{item.pet || 'Patient'}</strong><span>{item.species || 'Species not recorded'}</span></div></td><td>{item.owner || 'Not recorded'}</td><td>{item.visit_type || 'Not recorded'}</td><td>{item.practitioner || 'Unassigned'}</td><td>{normalize(item.status) === 'waiting' ? `${minutes(item.checkin_at, now) ?? 0} min` : '—'}</td><td><StatusIndicator status={item.status} /></td><td className="lab-result-actions"><button type="button" className="lab-row-action-trigger clinic-record-actions-trigger" aria-label={`Open actions for ${item.pet}`} aria-haspopup="dialog" onClick={event => { event.stopPropagation(); setSelectedId(item.id); }}>{Icons.chevronRight}</button></td>
            </tr>) : <tr><td colSpan={9} className="lab-results-empty">{error ? 'Queue information could not be loaded.' : 'No patients match the selected queue filters.'}</td></tr>}
          </tbody></table></div>
        </section>
        <section className="patient-queue-card"><h2>Queue Statistics</h2><div className="patient-queue-metrics">{[['Average Wait Time',waits.length ? `${Math.round(waits.reduce((sum,value) => sum + value,0) / waits.length)} min` : '—'],['Longest Current Wait',currentWaits.length ? `${Math.max(...currentWaits)} min` : '—'],[date === localDate() ? 'Patients Seen Today' : 'Patients Seen',completed.length]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{loading ? '—' : value}</strong></div>)}</div></section>
      </>}
    </div>
    {selected && <RecordActionsModal title="Queue Actions" recordLabel={`Queue #${selected.position}`} recordName={selected.pet || 'Patient'} recordMeta={`${selected.owner || 'Owner not recorded'} · ${selected.practitioner || 'Unassigned'}`} status={selected.status} onClose={() => setSelectedId(null)} actions={[
      { label:'View Queue',description:'See arrival time, queue position, and waiting status.',onClick:() => openAction('queue') },
      { label:'View Details',description:'Review appointment, patient, owner, and veterinarian information.',onClick:() => openAction('view') },
      ...(['in_consultation','completed'].includes(normalize(selected.status)) ? [{ label:'View Visit',description:'View permitted consultation status and visit information.',onClick:() => openAction('visit') }] : []),
      { label:'Audit History',description:'Review recorded activity and changes for this appointment.',onClick:() => openAction('history') },
    ]} />}
    {workflow && <AppointmentWorkflowDialog key={`${workflow.appointment.id}-${workflow.action}`} {...workflow} user={user} onClose={() => setWorkflow(null)} onSaved={refreshQueue} />}
    {walkIn && <WalkInDialog user={user} onClose={() => setWalkIn(false)} onSaved={() => { setDate(localDate()); setTab('waiting'); setDoctor(''); setSearch(''); refreshQueue(); }} />}
  </div>;
}
