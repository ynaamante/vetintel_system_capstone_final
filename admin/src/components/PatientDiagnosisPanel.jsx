import SystemFilterSelect from './FilterSelect';
import DiagnosisRecordView from './DiagnosisRecordView';
import LabDateTimePicker from './LabDateTimePicker';
import { appointmentTypes } from '../utils/appointmentTypes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDateText } from '../utils/dateFormatting';
import { dateInRange } from '../utils/dateFilters';
import DateRangeFilter from './DateRangeFilter';
import { Icons } from '../icons';
import './patientDiagnoses.css';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const classifications = { suspected: 'Suspected', probable: 'Probable', confirmed: 'Confirmed', ruled_out: 'Ruled Out' };
const statuses = { ongoing: 'Ongoing', under_treatment: 'Under Treatment', resolved: 'Resolved' };
const finalDiagnosisLabels = {
  suspected: 'Working / Provisional',
  probable: 'Probable',
  confirmed: 'Confirmed',
  ruled_out: 'Ruled Out',
};
const localDate = value => {
  const date = new Date(value || Date.now());
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const time = value => value ? new Date(value).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '';
const roleOf = user => String(user.role || '').toLowerCase().replace(/[\s-]+/g, '_');
const emptyAssessment = {
  temperature: '',
  heart_rate: '',
  respiratory_rate: '',
  weight: '',
  body_condition: '',
  severity: '',
  symptom_onset: '',
  laboratory_result: 'Not Tested',
  reported_symptoms: '',
  possible_exposure: '',
  diagnosis_remarks: '',
  consultation_type: 'General',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  secondary_diagnosis: '',
  final_diagnosis: 'Working / Provisional',
  follow_up: 'Required',
  follow_up_date: '',
  discharge_instructions: '',
};

function Classification({ value }) {
  return <span className={'diagnosis-classification is-' + (value || 'unknown')}>{classifications[value] || 'Not recorded'}</span>;
}

function ClinicalStatus({ value }) {
  return <span className={'diagnosis-clinical-status is-' + (value || 'unknown')}><i aria-hidden="true" />{statuses[value] || 'Not recorded'}</span>;
}

function DiagnosisDialog({ row, startEditing = false, patientId, patientName, user, vets, onClose, onSaved, canWrite, renderLabRequest, renderTreatmentRequest, diagnosisOptions = [] }) {
  const ref = useRef(null);
  const [editing, setEditing] = useState(!row || startEditing);
  const [labRequestOpen, setLabRequestOpen] = useState(false);
  const [step, setStep] = useState('assessment');
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const assessment = row?.clinical_assessment || {};
  const [form, setForm] = useState({
    diagnosis: row?.diagnosis || '',
    case_classification: row?.case_classification || 'suspected',
    clinical_status: row?.clinical_status || 'ongoing',
    veterinarian_id: String(row?.veterinarian_id || user.id || ''),
    recorded_at: localDate(row?.recorded_at),
    notes: row?.notes || '',
    clinical_assessment: { ...emptyAssessment, ...assessment },
  });

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    ref.current.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(api + '/clinic-records/treatment-plans?clinic_id=' + encodeURIComponent(user.clinic_id), { headers: { Authorization: 'Bearer ' + user.token }, signal: controller.signal })
      .then(response => response.ok ? response.json() : [])
      .then(data => setPlans(Array.isArray(data) ? data.filter(plan => String(plan.pet_id) === String(patientId)) : []))
      .catch(() => {});
    return () => controller.abort();
  }, [patientId, user.clinic_id, user.token]);
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const changeAssessment = (key, value) => setForm(current => ({
    ...current,
    clinical_assessment: { ...current.clinical_assessment, [key]: value },
  }));

  return createPortal(
    <dialog
      ref={ref}
      className={`patient-diagnosis-dialog${editing && step === 'diagnosis' ? ' is-final-diagnosis' : ''}`}
      aria-labelledby="diagnosis-dialog-title"
      onCancel={event => {
        event.preventDefault();
        if (treatmentOpen) return;
        if (labRequestOpen) return;
        if (!busy) onClose();
      }}
    >
      <form hidden={labRequestOpen || treatmentOpen} style={labRequestOpen || treatmentOpen ? { display: 'none' } : undefined} onSubmit={async event => {
        event.preventDefault();
        if (step === 'assessment') { setStep('diagnosis'); return; }
        setBusy(true);
        setError('');
        try {
          const response = await fetch(`${api}/clinic-records/pets/${encodeURIComponent(patientId)}/diagnoses${row ? `/${row.database_id}` : ''}`, {
            method: row ? 'PUT' : 'POST',
            headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...form,
              case_classification: form.case_classification,
              veterinarian_id: Number(form.veterinarian_id),
              recorded_at: new Date(form.recorded_at).toISOString(),
              notes: form.notes,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw Error(data.error || 'Unable to save diagnosis.');
          if (!Number.isInteger(data.id) || String(data.pet_id) !== String(patientId)) throw Error('The server did not confirm a saved diagnosis for this patient.');
          onSaved(data);
        } catch (saveError) {
          setError(saveError.message);
        } finally {
          setBusy(false);
        }
      }}>
        <div className="diagnosis-dialog-heading">
          <div>
            <h2 id="diagnosis-dialog-title">{editing ? (row ? 'Edit Diagnosis' : 'Add Diagnosis') : 'Diagnosis Details'}</h2>
            <p>{step === 'diagnosis' ? 'Finalize the diagnosis, classify the case, and set the treatment and follow-up plan for ' : 'Record the clinical assessment, request laboratory tests (optional), and finalize the diagnosis for '}{patientName}.</p>
          </div>
          <button type="button" className="diagnosis-dialog-close" aria-label="Close dialog" onClick={onClose} disabled={busy}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>
        </div>
        {editing && <ol className="diagnosis-progress" aria-label="Diagnosis progress">{['assessment', 'diagnosis'].map((value, index) => <li key={value} className={step === value ? 'active' : step === 'diagnosis' && index === 0 ? 'complete' : ''} aria-current={step === value ? 'step' : undefined}><span>{step === 'diagnosis' && index === 0 ? '\u2713' : index + 1}</span><strong>{index === 0 ? 'Assessment' : 'Diagnosis'}</strong></li>)}</ol>}
        <div className="diagnosis-dialog-body">
          {error && <p role="alert" className="diagnosis-error">{error}</p>}
          {editing ? <>
            {step === 'assessment' ? <div className="diagnosis-assessment-step">
              <section className="diagnosis-form-section diagnosis-consultation-section">
              <h3>Consultation Details</h3>
              <div className="diagnosis-consultation-grid">
                <label>Visit ID<input readOnly value={row?.visit_id || 'Not linked'} /></label>
                <label>Consultation Date<input required type="datetime-local" value={form.recorded_at} onChange={event => change('recorded_at', event.target.value)} disabled={busy} /></label>
                <label>Consulting Veterinarian<select required value={form.veterinarian_id} onChange={event => change('veterinarian_id', event.target.value)} disabled={busy}><option value="">Select veterinarian</option>{vets.map(vet => <option key={vet.id} value={vet.id}>{vet.name}</option>)}</select></label>
                <label>Consultation Type <span className="diagnosis-required">*</span><select required value={form.clinical_assessment.consultation_type} onChange={event => changeAssessment('consultation_type', event.target.value)} disabled={busy}>{appointmentTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
              </div>
            </section>
              <div className="diagnosis-assessment-columns"><section className="diagnosis-form-section">
                  <h3>Vital Signs</h3>
                  <div className="diagnosis-vitals">
                    <label><strong>Temperature</strong><input type="number" min="0" max="60" step="0.1" value={form.clinical_assessment.temperature} onChange={event => changeAssessment('temperature', event.target.value)} disabled={busy} /><span>°C</span></label>
                    <label><strong>Heart Rate</strong><input type="number" min="0" step="1" value={form.clinical_assessment.heart_rate} onChange={event => changeAssessment('heart_rate', event.target.value)} disabled={busy} /><span>bpm</span></label>
                    <label><strong>Respiratory Rate</strong><input type="number" min="0" step="1" value={form.clinical_assessment.respiratory_rate} onChange={event => changeAssessment('respiratory_rate', event.target.value)} disabled={busy} /><span>rpm</span></label>
                    <label><strong>Weight</strong><input type="number" min="0" step="0.01" value={form.clinical_assessment.weight} onChange={event => changeAssessment('weight', event.target.value)} disabled={busy} /><span>kg</span></label>
                    <label className="diagnosis-vitals-select"><strong>Body Condition</strong><select value={form.clinical_assessment.body_condition} onChange={event => changeAssessment('body_condition', event.target.value)} disabled={busy}><option value="">Select</option>{['Underweight', 'Ideal', 'Overweight', 'Obese'].map(value => <option key={value}>{value}</option>)}</select></label>
                  </div>
                </section><section className="diagnosis-form-section diagnosis-soap-section">
                  <h3>Clinical Assessment (SOAP)</h3>
                  <div className="diagnosis-soap-fields">
                    {[
                      ['subjective', 'S – Subjective', "Owner's report (e.g., observed symptoms, behavior, duration)"],
                      ['objective', 'O – Objective', 'Clinical findings (e.g., vital signs, physical examination)'],
                      ['assessment', 'A – Assessment', 'Working diagnosis / clinical impression'],
                      ['plan', 'P – Plan', 'Treatment plan, diagnostics, and next steps'],
                    ].map(([key, label, placeholder]) => <label key={key}><span>{label}</span><textarea rows="2" maxLength="1000" placeholder={placeholder} value={form.clinical_assessment[key]} onChange={event => changeAssessment(key, event.target.value)} disabled={busy} /></label>)}
                  </div>
                </section></div>
              <section className="diagnosis-form-section diagnosis-notes-section"><h3>Clinical Notes</h3><textarea aria-label="Clinical Notes" rows="3" maxLength={1000} placeholder="Add additional clinical notes (optional)" value={form.notes} onChange={event => change('notes', event.target.value)} disabled={busy} /></section>
            </div> : <div className="diagnosis-final-step"><datalist id="diagnosis-suggestions">{diagnosisOptions.map(value => <option key={value} value={value} />)}</datalist>
<section className="diagnosis-form-section diagnosis-consultation-section">
              <h3>Consultation Details</h3>
              <div className="diagnosis-consultation-grid">
                <label>Visit ID<input readOnly value={row?.visit_id || 'Not linked'} /></label>
                <label>Consultation Date<input required type="datetime-local" value={form.recorded_at} onChange={event => change('recorded_at', event.target.value)} disabled={busy} /></label>
                <label>Consulting Veterinarian<select required value={form.veterinarian_id} onChange={event => change('veterinarian_id', event.target.value)} disabled={busy}><option value="">Select veterinarian</option>{vets.map(vet => <option key={vet.id} value={vet.id}>{vet.name}</option>)}</select></label>
                <label>Consultation Type <span className="diagnosis-required">*</span><select required value={form.clinical_assessment.consultation_type} onChange={event => changeAssessment('consultation_type', event.target.value)} disabled={busy}>{appointmentTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
              </div>
            </section>
<div className="diagnosis-final-columns">
<section className="diagnosis-form-section"><h3>Diagnosis Information</h3><div className="diagnosis-final-fields">
<label>Primary Diagnosis <b>*</b><input required maxLength={300} list="diagnosis-suggestions" placeholder="Select or type a diagnosis" value={form.diagnosis} onChange={event => change('diagnosis', event.target.value)} disabled={busy} /></label>
<label>Secondary Diagnosis <small>(Optional)</small><input maxLength={300} list="diagnosis-suggestions" placeholder="Select or type a secondary diagnosis" value={form.clinical_assessment.secondary_diagnosis} onChange={event => changeAssessment('secondary_diagnosis', event.target.value)} disabled={busy} /></label>
<fieldset className="diagnosis-status-options"><legend>Diagnosis Status <b>*</b></legend>{Object.entries(classifications).map(([value, label]) => <label key={value}><input type="radio" name="diagnosis-status" value={value} checked={form.case_classification === value} onChange={() => { change('case_classification', value); changeAssessment('final_diagnosis', finalDiagnosisLabels[value]); }} disabled={busy} />{label}</label>)}</fieldset>
<label>Diagnosis Remarks<textarea rows="2" maxLength={1000} placeholder="Add notes about the diagnosis (optional)" value={form.clinical_assessment.diagnosis_remarks} onChange={event => changeAssessment('diagnosis_remarks', event.target.value)} disabled={busy} /></label>
</div></section>
<section className="diagnosis-form-section"><h3>Disease Classification &amp; Monitoring</h3><div className="diagnosis-final-fields">
<label>Case Classification <b>*</b><SystemFilterSelect label="Case Classification" value={form.case_classification} options={Object.entries(classifications).map(([value, label]) => ({value, label: label + ' Case'}))} onChange={value => { change('case_classification', value); changeAssessment('final_diagnosis', finalDiagnosisLabels[value]); }} /></label>
<div className="diagnosis-monitoring-row"><label>Symptom Onset Date<LabDateTimePicker label="Symptom Onset Date" mode="date" value={form.clinical_assessment.symptom_onset} onChange={value => changeAssessment('symptom_onset', value)} disabled={busy} /></label><label>Laboratory Result<SystemFilterSelect label="Laboratory Result" value={form.clinical_assessment.laboratory_result} onChange={value => changeAssessment('laboratory_result', value)} options={['Not Tested', 'Pending', 'Positive', 'Negative', 'Inconclusive'].map(value => ({value, label: value}))} /></label></div>
<label>Reported Symptoms<div className="diagnosis-symptoms">{form.clinical_assessment.reported_symptoms.split(',').map(value => value.trim()).filter(Boolean).map(value => <button key={value} type="button" disabled={busy} onClick={() => changeAssessment('reported_symptoms', form.clinical_assessment.reported_symptoms.split(',').filter(item => item.trim() !== value).join(', '))}>{value} <span aria-label={'Remove ' + value}>&times;</span></button>)}<input aria-label="Add reported symptom" value={symptomInput} placeholder="Type a symptom and press Enter" disabled={busy} onChange={event => setSymptomInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); const value = symptomInput.trim(); if (value) changeAssessment('reported_symptoms', [...new Set([...form.clinical_assessment.reported_symptoms.split(',').map(item => item.trim()).filter(Boolean), value])].join(', ')); setSymptomInput(''); } }} /></div></label>
<label>Possible Exposure <small>(Optional)</small><textarea rows="2" maxLength={1000} placeholder="e.g., contact with an infected animal, shared area, etc." value={form.clinical_assessment.possible_exposure} onChange={event => changeAssessment('possible_exposure', event.target.value)} disabled={busy} /></label>
</div></section></div>
<section className="diagnosis-form-section"><h3>Treatment &amp; Follow-Up</h3><div className="diagnosis-treatment-row"><div className="diagnosis-treatment-summary"><strong>Treatment Plans</strong><span>{plans.length} Plan{plans.length === 1 ? '' : 's'}</span><button type="button" disabled={busy} onClick={() => setTreatmentOpen(true)}>+ Add Treatment Plan</button></div><label>Follow-Up <b>*</b><SystemFilterSelect label="Follow-Up" value={form.clinical_assessment.follow_up} onChange={value => changeAssessment('follow_up', value)} options={['Required', 'Recheck', 'Not Required'].map(value => ({value, label: value}))} /></label><label>Follow-Up Date<LabDateTimePicker label="Follow-Up Date" mode="date" value={form.clinical_assessment.follow_up_date} onChange={value => changeAssessment('follow_up_date', value)} disabled={busy || form.clinical_assessment.follow_up === 'Not Required'} /></label></div></section>
</div>}
          </> : <dl className="diagnosis-details">
            <div><dt>Diagnosis</dt><dd>{row.diagnosis}</dd></div>
            <div><dt>Case Classification</dt><dd><Classification value={row.case_classification} /></dd></div>
            <div><dt>Clinical Status</dt><dd><ClinicalStatus value={row.clinical_status} /></dd></div>
            <div><dt>Date / Time</dt><dd>{formatDateText(row.recorded_at)} {time(row.recorded_at)}</dd></div>
            <div><dt>Attending Veterinarian</dt><dd>{row.veterinarian || 'Not recorded'}</dd></div>
            <div><dt>Source</dt><dd>{row.source}{row.assessment === 'Provisional' ? ' (Provisional)' : ''}</dd></div>
            {row.clinical_assessment && Object.entries(row.clinical_assessment).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value}</dd></div>)}
            {!row.database_id && <div><dt>Source Record Status</dt><dd>{row.status || 'Not recorded'}</dd></div>}
            <div><dt>Clinical Notes</dt><dd>{row.notes || 'Not provided'}</dd></div>
          </dl>}
          {!row?.database_id && row && <p className="diagnosis-legacy-note">This diagnosis comes from an existing clinical record. Its case classification and clinical status have not been assigned here. Update the source record to change its diagnosis.</p>}
        </div>
        <footer>
          {editing && <strong className="diagnosis-footer-stage">{step === 'assessment' ? 'Assessment' : 'Diagnosis'}</strong>}
          {editing && step === 'diagnosis' && <button type="button" disabled={busy} onClick={() => setStep('assessment')}>Back to Assessment</button>}
          <button type="button" className="diagnosis-cancel-button" onClick={onClose} disabled={busy}>{editing ? 'Cancel' : 'Close'}</button>
          {editing && step === 'assessment' && renderLabRequest && <button type="button" disabled={busy} onClick={() => setLabRequestOpen(true)}>Request Lab Test</button>}
          {editing
            ? <button type="submit" className="is-primary" disabled={busy}>{busy ? 'Saving...' : step === 'assessment' ? 'Continue to Diagnosis' : 'Save Diagnosis'}</button>
            : canWrite && row.database_id && <button type="button" className="is-primary" onClick={() => setEditing(true)}>Edit Diagnosis</button>}
        </footer>
      </form>
      {treatmentOpen && renderTreatmentRequest?.({
        portalTarget: ref.current,
        initialPlan: { petId: patientId, diagnosis: form.diagnosis, veterinarianId: form.veterinarian_id, followUp: form.clinical_assessment.follow_up_date },
        onClose: () => setTreatmentOpen(false),
        onSaved: plan => { setPlans(current => [...current, plan]); setTreatmentOpen(false); },
      })}
      {labRequestOpen && renderLabRequest(() => setLabRequestOpen(false))}
    </dialog>,
    document.body,
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

export default function PatientDiagnosisPanel({ patientId, patientName, patient, user, renderLabRequest, renderTreatmentRequest, renderPlan, renderLabs }) {
  const [rows, setRows] = useState([]);
  const [vets, setVets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staffError, setStaffError] = useState('');
  const [search, setSearch] = useState('');
  const [vet, setVet] = useState('all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [fullDiagnosis, setFullDiagnosis] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const canWrite = ['doctor', 'assistant_doctor', 'veterinarian'].includes(roleOf(user));

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${api}/clinic-records/registration-doctors`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Unable to load veterinarians.');
        setVets(data);
        setStaffError('');
      })
      .catch(loadError => {
        if (loadError.name !== 'AbortError') setStaffError(loadError.message);
      });
    return () => controller.abort();
  }, [user.token, user.clinic_id]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (!patientId) {
      setRows([]);
      setLoading(false);
      return () => controller.abort();
    }
    const load = async () => {
      try {
        const response = await fetch(`${api}/clinic-records/pets/${encodeURIComponent(patientId)}/diagnoses?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
          headers: { Authorization: `Bearer ${user.token}` },
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Unable to load diagnoses.');
        if (!Array.isArray(data)) throw Error('Unexpected diagnosis response.');
        if (active) {
          setRows(data);
          setError('');
        }
      } catch (loadError) {
        if (active && loadError.name !== 'AbortError') setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    setLoading(true);
    load();
    window.addEventListener('vetintel:appointment-updated', load);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener('vetintel:appointment-updated', load);
      window.removeEventListener('focus', load);
    };
  }, [patientId, user.token, user.clinic_id, refresh]);

  useEffect(() => { setPage(1); }, [search, vet, status, from, to]);

  const vetOptions = useMemo(() => [...new Map([
    ...vets.map(item => [String(item.id), item.name]),
    ...rows.filter(item => item.veterinarian).map(item => [String(item.veterinarian_id || 'name:' + item.veterinarian), item.veterinarian]),
  ]).entries()].sort((a, b) => a[1].localeCompare(b[1])), [vets, rows]);
  const filtered = rows.filter(row =>
    [row.diagnosis, row.veterinarian, patientName].some(value => String(value || '').toLowerCase().includes(search.toLowerCase()))
    && (vet === 'all' || String(row.veterinarian_id || 'name:' + row.veterinarian) === vet)
    && (status === 'all' || (row.clinical_status || 'not_recorded') === status)
    && dateInRange(row.recorded_at, from, to));
  const count = Math.max(1, Math.ceil(filtered.length / 5));
  const current = Math.min(page, count);
  const visible = filtered.slice((current - 1) * 5, current * 5);

  const viewProps = { patientId, patientName, patient, user, canEdit: canWrite, renderPlan, renderLabs, renderLabRequest };
  return <>
    {fullDiagnosis && <DiagnosisRecordView {...viewProps} row={rows.find(item => item.id === fullDiagnosis.id) || fullDiagnosis} full initialPlanId={fullDiagnosis.initialPlanId} initialLabsOpen={fullDiagnosis.initialLabsOpen} onClose={() => setFullDiagnosis(null)} onEdit={() => setSelected({ row: rows.find(item => item.id === fullDiagnosis.id) || fullDiagnosis, startEditing: true })} />}
    <section className="patient-diagnoses" style={fullDiagnosis ? { display: 'none' } : undefined}>
    <header>
      <div><h2>Diagnoses</h2><p>View and manage the patient's diagnoses and clinical assessments.</p></div>
      {canWrite && <button type="button" className="diagnosis-add" disabled={!patientId} onClick={() => setSelected({ row: null })}>{Icons.plus} Add Diagnosis</button>}
    </header>
    <div className="diagnosis-filters">
      <label className="diagnosis-search">{Icons.search}<input aria-label="Search diagnoses" placeholder="Search diagnosis, condition, or patient..." value={search} onChange={event => setSearch(event.target.value)} /></label>
      <FilterSelect label="Filter by veterinarian" value={vet} onChange={setVet} options={[{ value: 'all', label: 'Veterinarian' }, ...vetOptions.map(([value, label]) => ({ value, label }))]} />
      <DateRangeFilter dateFrom={from} dateTo={to} onDateFromChange={setFrom} onDateToChange={setTo} emptyLabel="Date Range" />
      <FilterSelect label="Filter by clinical status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All Statuses' }, ...Object.entries(statuses).map(([value, label]) => ({ value, label })), { value: 'not_recorded', label: 'Not recorded' }]} />
    </div>
    {(error || staffError) && <p role="alert" className="diagnosis-error">{error || staffError}</p>}
    <div className="diagnosis-table-wrap">
      <table className="diagnosis-table">
        <thead><tr><th>Date / Time</th><th>Diagnosis</th><th>Case Classification</th><th>Status</th><th>Attending Veterinarian</th><th aria-label="Diagnosis actions" /></tr></thead>
        <tbody>
          {!error && visible.map(row => <tr key={row.id} tabIndex={0} onClick={() => setSelected({ row })} onKeyDown={event => {
            if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
              event.preventDefault();
              setSelected({ row });
            }
          }}>
            <td><strong>{formatDateText(row.recorded_at)}</strong><span className="diagnosis-time">{time(row.recorded_at)}</span></td>
            <td className="diagnosis-name">{row.diagnosis}</td>
            <td><Classification value={row.case_classification} /></td>
            <td><ClinicalStatus value={row.clinical_status} /></td>
            <td>{row.veterinarian || 'Not recorded'}</td>
            <td><button type="button" className="diagnosis-open" aria-label={'View diagnosis ' + row.diagnosis} onClick={event => {
              event.stopPropagation();
              setSelected({ row });
            }}>{Icons.chevronRight}</button></td>
          </tr>)}
          {(loading || error || !visible.length) && <tr><td colSpan={6} className="diagnosis-empty">{loading ? 'Loading diagnoses...' : error ? 'Diagnoses could not be loaded.' : rows.length ? 'No diagnoses match these filters.' : 'No diagnoses recorded for this patient yet.'}</td></tr>}
        </tbody>
      </table>
    </div>
    <footer>
      <span>Showing {filtered.length ? (current - 1) * 5 + 1 : 0}&ndash;{Math.min(current * 5, filtered.length)} of {filtered.length} diagnoses</span>
      <nav aria-label="Diagnosis pagination">
        <button type="button" aria-label="Previous diagnosis page" disabled={current <= 1} onClick={() => setPage(current - 1)}>{Icons.chevronRight}</button>
        <button type="button" className="active" aria-current="page">{current}</button>
        <button type="button" aria-label="Next diagnosis page" disabled={current >= count} onClick={() => setPage(current + 1)}>{Icons.chevronRight}</button>
      </nav>
    </footer>
    {selected?.row && !selected.startEditing && <DiagnosisRecordView {...viewProps} row={selected.row} onClose={() => setSelected(null)} onFull={destination => { setFullDiagnosis({ ...selected.row, ...destination }); setSelected(null); }} />}
    {selected && (!selected.row || selected.startEditing) && <DiagnosisDialog
      {...selected}
      patientId={patientId}
      patientName={patientName}
      user={user}
      vets={vets}
      canWrite={canWrite}
      diagnosisOptions={[...new Set(rows.map(item => item.diagnosis).filter(Boolean))]}
      renderLabRequest={renderLabRequest}
      renderTreatmentRequest={renderTreatmentRequest}
      onClose={() => setSelected(null)}
      onSaved={() => {
        setSelected(null);
        setRefresh(value => value + 1);
        window.dispatchEvent(new Event('vetintel:appointment-updated'));
      }}
    />}
  </section></>;
}
