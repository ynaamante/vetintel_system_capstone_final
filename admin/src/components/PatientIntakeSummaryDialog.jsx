import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import indicators from '../../../data/intakeScreening.json';
import rules from '../../../data/intakeScreeningRules.json';
import { formatDateText, formatDateTimeText } from '../utils/dateFormatting';
import './patientIntakeSummaryDialog.css';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const label = (kind, value) => indicators[kind].find(item => item.value === value)?.label || 'Not assessed';
const reported = (values, options) => (values || []).map(value => options.find(([id]) => id === value)?.[1] || value).join(', ') || 'Not reported';
function DataSection({ title, fields }) {
  return <section className="intake-summary-section"><h3>{title}</h3><div className="intake-summary-section-body"><table><tbody>{fields.map(([name, value]) => <tr key={name}><th scope="row">{name}</th><td>{value || 'Not provided'}</td></tr>)}</tbody></table></div></section>;
}
function Metric({ title, kind, value }) {
  const item = indicators[kind].find(option => option.value === value);
  return <div><strong>{title}</strong><span className={`intake-summary-metric is-${item?.tone || 'unassessed'}`}><i aria-hidden="true"/>{item?.label || 'Not assessed'}</span></div>;
}
function AttachmentPreview({ file, user, onClose }) {
  const [url, setUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let blobUrl = '';
    setUrl(''); setError('');
    (async () => {
      try {
        const response = await fetch(`${api}/clinic-records/attachments/${file.id}/content`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal });
        if (!response.ok) { const result = await response.json().catch(() => ({})); throw Error(result.error || 'Unable to open attachment.'); }
        const blob = await response.blob(); if (controller.signal.aborted) return;
        blobUrl = URL.createObjectURL(blob); setUrl(blobUrl);
      } catch (error) { if (error.name !== 'AbortError') setError(error.message); }
    })();
    return () => { controller.abort(); if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [file.id, user.token]);
  return <div className="intake-summary-file-preview"><header><strong>{file.filename}</strong><button type="button" onClick={onClose}>Close preview</button></header>{error ? <p role="alert">{error}</p> : !url ? <p role="status">Loading attachment...</p> : file.content_type === 'application/pdf' ? <iframe src={url} title={file.filename}/> : <img src={url} alt={file.filename}/>}</div>;
}
export default function PatientIntakeSummaryDialog({ intake, user, onClose, onDiagnosis }) {
  const dialog = useRef(null), [file, setFile] = useState(null);
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    dialog.current.showModal(); document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const code = `INT-${String(intake.id).padStart(3, '0')}`;
  const pet = intake.pet_data || {}, owner = intake.owner_data || {}, screening = intake.screening;
  const diagnosis = () => { onClose(); onDiagnosis?.(); };
  return createPortal(<dialog ref={dialog} className="patient-intake-summary-dialog" aria-labelledby="patient-intake-summary-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="intake-summary-dialog-header"><div><h2 id="patient-intake-summary-title">Patient Intake Summary</h2><p>{code} &bull; Submitted by {intake.submitted_by_name || 'Not recorded'} &bull; {formatDateTimeText(intake.submitted_at || intake.created_at)}</p></div></header>
    <div className="intake-summary-dialog-scroll">
      <section className="intake-summary-metrics" aria-label="Intake status and screening"><Metric title="Triage Priority" kind="triage" value={screening?.effective?.triage_priority}/><Metric title="Infection Risk" kind="infection" value={screening?.effective?.infection_risk}/><div><strong>Status</strong><span className="intake-summary-metric is-routine"><i aria-hidden="true"/>Approved</span></div></section>
      <div className="intake-summary-dialog-columns"><div>
        <DataSection title="Intake Details" fields={[
          ['Reported Symptoms', reported(screening?.inputs?.symptoms, rules.symptoms) + (screening?.inputs?.other_symptom ? ` - ${screening.inputs.other_symptom}` : '')],
          ['Reported Exposure', reported(screening?.inputs?.exposures, rules.exposures)],
          ['Reason for Visit', intake.reason_for_visit],
          ['Suggested', `${label('triage', screening?.suggested?.triage_priority)} / ${label('infection', screening?.suggested?.infection_risk)}`],
          ['Review Note', screening?.review?.note || '—'],
        ]}/>
        <section className="intake-summary-section"><h3>Attached Files</h3><div className="intake-summary-section-body">{intake.attachments?.length ? <ul className="intake-summary-files">{intake.attachments.map(attachment => <li key={attachment.id}><span>{attachment.filename}</span><button type="button" onClick={() => setFile(attachment)}>View file</button></li>)}</ul> : <div className="intake-summary-no-files">No files attached.</div>}{file && <AttachmentPreview file={file} user={user} onClose={() => setFile(null)}/>}</div></section>
      </div><div>
        <DataSection title="Owner Information" fields={[
          ['Full Name', owner.name], ['Contact Number', owner.phone], ['Email', owner.email], ['Address', owner.address],
        ]}/>
        <DataSection title="Pet Information" fields={[
          ['Pet Name', pet.name], ['Species', pet.species], ['Breed', pet.breed], ['Gender', pet.sex ? pet.sex[0].toUpperCase() + pet.sex.slice(1) : ''],
          ['Date of Birth', pet.birth_date ? formatDateText(pet.birth_date) : ''], ['Age', pet.age_value ? `${pet.age_value} ${pet.age_unit || 'Months'}` : ''],
          ['Color', pet.color], ['Weight', pet.weight], ['Known Allergies', pet.allergies],
        ]}/>
      </div></div>
      <p className="intake-summary-clinical-note">This is the approved intake submission. Screening indicators remain preliminary and are not confirmed diagnoses.{screening?.review && ` Reviewed by a veterinarian on ${formatDateTimeText(screening.review.reviewed_at)}.`}</p>
    </div>
    <footer className="intake-summary-dialog-footer"><button type="button" onClick={onClose}>Close</button><button type="button" className="is-primary" onClick={diagnosis}>Click to Diagnose <span aria-hidden="true">&rsaquo;</span></button></footer>
  </dialog>, document.body);
}
