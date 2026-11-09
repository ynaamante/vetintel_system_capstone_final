import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDateText } from '../utils/dateFormatting';
import './diagnosisRecordView.css';
import DiagnosisObservationDialog from './DiagnosisObservationDialog';
import DiagnosisLabReport from './DiagnosisLabReport';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const classification = { suspected: 'Suspected Case', probable: 'Probable Case', confirmed: 'Confirmed Case', ruled_out: 'Ruled Out' };
const clinicalStatus = { ongoing: 'Ongoing', under_treatment: 'Under Treatment', resolved: 'Resolved' };
const text = value => value === 0 ? '0' : value || 'Not recorded';

function Card({ title, action, children }) {
  return <section className="diagnosis-record-card"><header><h3>{title}</h3>{action}</header>{children}</section>;
}
function Fields({ items }) {
  return <dl className="diagnosis-record-fields">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{text(value)}</dd></div>)}</dl>;
}

export default function DiagnosisRecordView({ row, patientId, patientName, patient = {}, user, full = false, initialPlanId, canEdit, onClose, onFull, onEdit, renderPlan, renderLabRequest }) {
  const dialog = useRef(null);
  const root = useRef(null);
  const [related, setRelated] = useState({ plans: [], labs: [] });
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState(initialPlanId || null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [labOpen, setLabOpen] = useState(false);
  const [observationOpen, setObservationOpen] = useState(false);
  const [observations, setObservations] = useState([]);
  const [observationError, setObservationError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const a = { ...(row.clinical_assessment || {}), ...(observations[0]?.vitals || {}) };
  useEffect(() => {
    if (!row.database_id) return;
    const controller = new AbortController();
    fetch(api + '/clinic-records/pets/' + patientId + '/diagnoses/' + row.database_id + '/observations?clinic_id=' + encodeURIComponent(user.clinic_id), { headers: { Authorization: 'Bearer ' + user.token }, signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok || !Array.isArray(data)) throw Error(data.error || 'Unable to load clinical observations.'); setObservations(data); setObservationError(''); })
      .catch(error => { if (error.name !== 'AbortError') setObservationError(error.message); });
    return () => controller.abort();
  }, [row.database_id, patientId, user.clinic_id, user.token, version]);
  useEffect(() => {
    if (full) {
      const previous = document.activeElement;
      const overflow = document.body.style.overflow;
      const scrollPosition = { left: window.scrollX, top: window.scrollY };
      document.body.classList.add('diagnosis-full-page-open');
      document.body.style.overflow = 'auto';
      root.current?.focus();
      window.scrollTo(0, 0);
      return () => {
        document.body.classList.remove('diagnosis-full-page-open');
        document.body.style.overflow = overflow;
        previous?.focus({ preventScroll: true });
        window.scrollTo(scrollPosition);
      };
    }
    const previous = document.activeElement;
    dialog.current.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [full]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = `?clinic_id=${encodeURIComponent(user.clinic_id)}&pet_id=${encodeURIComponent(patientId)}`;
    Promise.all(['treatment-plans', 'lab-tests'].map(async endpoint => {
      const response = await fetch(`${api}/clinic-records/${endpoint}${query}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) throw Error('Unable to load related treatment plans and laboratory tests.');
      return data.filter(item => String(item.pet_id || item.patientId) === String(patientId) && !item.archived);
    })).then(([plans, labs]) => {
      setRelated({ plans: plans.filter(plan => String(plan.diagnosis || '').trim().toLowerCase() === row.diagnosis.trim().toLowerCase()), labs });
      setLoadError('');
    }).catch(error => { if (error.name !== 'AbortError') setLoadError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [patientId, row.diagnosis, user.clinic_id, user.token, version]);
  const plans = related.plans;
  const labs = related.labs;
  const latestLab = [...labs].sort((x, y) => new Date(y.orderDateTime || y.date || 0) - new Date(x.orderDateTime || x.date || 0))[0];
  const steps = plans.flatMap(plan => (plan.steps || []).map((step, index) => ({ ...(typeof step === 'string' ? { title: step } : step), planId: plan.id, key: `${plan.id}-${index}` })));
  const vitals = [['Temperature (°C)', a.temperature], ['Heart Rate (bpm)', a.heart_rate], ['Respiratory Rate (rpm)', a.respiratory_rate], ['Weight (kg)', a.weight || patient.weight], ['Body Condition', a.body_condition]];
  const summary = [['Primary Diagnosis', row.diagnosis], ['Case Classification', <span className="diagnosis-record-badge">{classification[row.case_classification] || 'Not recorded'}</span>], ['Clinical Status', clinicalStatus[row.clinical_status]], ['Secondary Diagnosis', a.secondary_diagnosis]];
  const planButton = <button type="button" disabled={!plans.length || !renderPlan} title={!plans.length ? 'No treatment plan is linked to this diagnosis yet.' : undefined} onClick={() => { if (!full) onFull?.({ initialPlanId: plans[0].id }); else setPlanId(plans[0].id); }}>View Full Treatment Plan</button>;
  const labButton = <button type="button" disabled={!labs.length} onClick={() => setLabOpen(true)}>View Full Lab Result</button>;
  const content = <>
    <header className="diagnosis-record-heading"><div>{full && <button type="button" className="diagnosis-record-back" onClick={onClose}>← Back to Diagnoses</button>}<h2>Diagnosis Details</h2><p>{full ? 'View the complete diagnosis, clinical assessment, treatment plan, laboratory tests, and follow-up for ' + patientName + '.' : 'View the key information for this diagnosis.'}</p></div><div className="diagnosis-record-actions">{full ? <>{canEdit && row.database_id && <button type="button" onClick={onEdit}>Edit Diagnosis</button>}<button type="button" onClick={() => window.print()}>Print Report</button></> : <button type="button" onClick={onClose}>Close</button>}</div></header>
    <div className="diagnosis-record-patient"><span className="diagnosis-record-avatar">{patientName.slice(0, 1)}</span><div><strong>{patientName}</strong><small>{[`P-${String(patientId).padStart(4, '0')}`, patient.species, patient.sex || patient.gender, patient.age].filter(Boolean).join(' · ')}</small></div><div><small>Weight</small><strong>{text(a.weight || patient.weight)}{a.weight ? ' kg' : ''}</strong></div><div><small>Allergies</small><strong>{text(patient.allergies)}</strong></div><div><small>Vaccination</small><strong>{text(patient.vaccinationStatus)}</strong></div></div>
    {loadError && <p role="alert">{loadError}</p>}{loading && <p role="status">Loading related records…</p>}
    <div className="diagnosis-record-columns"><div>
      {!full && <Card title="Diagnosis Summary"><Fields items={summary} /></Card>}
      {full && <><Card title="Consultation Details"><Fields items={[[ 'Visit ID', row.visit_id || 'Not linked'], ['Consultation Date', `${formatDateText(row.recorded_at)} · ${new Date(row.recorded_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`], ['Consulting Veterinarian', row.veterinarian], ['Consultation Type', a.consultation_type]]} /></Card><Card title="Clinical Assessment (SOAP)"><Fields items={[[ 'S – Subjective', a.subjective], ['O – Objective', a.objective], ['A – Assessment', a.assessment], ['P – Plan', a.plan]]} /></Card></>}
      {!full && <Card title="Treatment Plan" action={planButton}><Fields items={[[ 'Treatment Plan', loading ? 'Loading…' : `${plans.length} plan(s) · ${steps.length} treatment steps`]]} /></Card>}
      <Card title={full ? 'Laboratory Tests' : 'Laboratory Test'} action={full && canEdit && renderLabRequest ? <button type="button" onClick={() => setRequestOpen(true)}>+ Add Lab Test</button> : null}>{full ? <div className="diagnosis-record-table"><table><thead><tr><th>Test Name</th><th>Status</th><th>Result</th><th>Date / Time</th></tr></thead><tbody>{labs.map(lab => <tr key={lab.id}><td>{lab.testType}</td><td>{lab.status}</td><td>{lab.summary || '—'}</td><td>{text(lab.date)}</td></tr>)}{!labs.length && <tr><td colSpan="4">{loading ? 'Loading…' : 'No laboratory tests recorded for this patient.'}</td></tr>}</tbody></table></div> : <Fields items={[[ 'Latest Test', latestLab?.testType], ['Status', latestLab?.status]]} />}</Card>
      {full && <><Card title="Lab Results" action={labButton}><Fields items={[[ 'Latest Test', latestLab?.testType], ['Result', latestLab?.summary], ['Status', latestLab?.status]]} /></Card><Card title="Treatment Steps" action={planButton}><ol className="diagnosis-record-steps">{steps.map(step => <li key={step.key}><span>{step.title}</span><span className="diagnosis-record-badge">{step.done ? 'Completed' : 'Scheduled'}</span><span>{step.due ? formatDateText(step.due) : 'No due date'}</span></li>)}</ol>{!steps.length && <p className="diagnosis-record-empty">{loading ? 'Loading…' : 'No treatment steps recorded for this diagnosis.'}</p>}</Card></>}
    </div><div>
      {full ? <Card title="Diagnosis Information"><Fields items={[...summary, ['Symptom Onset Date', a.symptom_onset ? formatDateText(a.symptom_onset) : 'Not recorded'], ['Possible Exposure', a.possible_exposure], ['Reported Symptoms', a.reported_symptoms], ['Laboratory Result', a.laboratory_result], ['Diagnosis Remarks', a.diagnosis_remarks]]} /></Card> : <Card title="Consultation Details"><Fields items={[[ 'Consultation Date', formatDateText(row.recorded_at)], ['Consulting Veterinarian', row.veterinarian], ['Consultation Type', a.consultation_type]]} /></Card>}
      <Card title="Clinical Monitoring" action={full && canEdit ? <button type="button" disabled={!row.database_id} title={!row.database_id ? "Open a saved diagnosis to record observations." : undefined} onClick={() => setObservationOpen(true)}>+ Add Observation</button> : null}><div className="diagnosis-record-vitals">{vitals.map(([label, value]) => <div key={label}><small>{label}</small><strong>{text(value)}</strong></div>)}</div>{full && <div className="diagnosis-latest-observation"><strong>Latest Clinical Observation</strong>{observationError && <p role="alert">{observationError}</p>}<p>{observations[0]?.notes || 'No clinical observation has been recorded yet.'}</p>{observations[0] && <small>{new Date(observations[0].observed_at).toLocaleString('en-PH')} | {observations[0].author || 'Veterinarian'}</small>}<button type="button" onClick={() => setHistoryOpen(value => !value)}>{historyOpen ? 'Hide previous observations' : 'View previous observations'}</button>{historyOpen && <ol>{observations.map(item => <li key={item.id}><strong>{new Date(item.observed_at).toLocaleString('en-PH')}</strong><p>{item.notes}</p><small>{item.author || 'Veterinarian'}</small></li>)}{!observations.length && <li>No previous observations.</li>}</ol>}</div>}</Card>
      <Card title="Follow-Up"><Fields items={[[ 'Follow-Up Status', a.follow_up], ['Follow-Up Date', a.follow_up_date ? formatDateText(a.follow_up_date) : 'Not recorded'], ...(full ? [['Clinical Notes', row.notes], ['Discharge Instructions', a.discharge_instructions]] : [])]} /></Card>
    </div></div>
    {!full && <footer className="diagnosis-record-footer"><button type="button" onClick={onClose}>Close</button><button type="button" className="is-primary diagnosis-record-view-full" onClick={() => onFull?.()}>View Full Diagnosis</button></footer>}
    {observationOpen && <DiagnosisObservationDialog user={user} patientId={patientId} diagnosisId={row.database_id} patientName={patientName} onClose={() => setObservationOpen(false)} onSaved={() => { setObservationOpen(false); setVersion(value => value + 1); }} />}
    {planId && renderPlan?.(planId, () => setPlanId(null))}
    {requestOpen && renderLabRequest?.(() => { setRequestOpen(false); setVersion(value => value + 1); })}
  </>;
  if (full && labOpen) return createPortal(<article ref={root} tabIndex={-1} className="diagnosis-record diagnosis-record-page"><DiagnosisLabReport labs={labs} patientName={patientName} user={user} onClose={() => setLabOpen(false)} /></article>, document.body);
  return full ? createPortal(<article ref={root} tabIndex={-1} className="diagnosis-record diagnosis-record-page">{content}</article>, document.body) : createPortal(<dialog ref={dialog} className="diagnosis-record diagnosis-record-dialog" onCancel={event => { event.preventDefault(); onClose(); }}>{content}</dialog>, document.body);
}
