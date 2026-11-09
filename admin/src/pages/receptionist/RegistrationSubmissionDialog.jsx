import screening from '../../../../data/intakeScreening.json';
import { useEffect, useRef, useState } from 'react';
import { registrationActions, registrationActionLabels, registrationStatusLabel } from '../../utils/registrationActions';
import RecordActionsModal from '../../components/RecordActionsModal';
import './appointmentWorkflow.css';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const date = value => value ? new Date(value).toLocaleString() : 'Not recorded';
function Details({ fields }) {
  return <dl>{Object.entries(fields).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl>;
}
export default function RegistrationSubmissionDialog({ row, user, onClose, onEdit, onContinue, onDelete }) {
  const dialog = useRef(null);
  const [action, setAction] = useState('actions');
  const [patient, setPatient] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    const onKeyDown = event => {
      if (action === 'actions' && event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [action, onClose]);
  useEffect(() => {
    if (action !== 'patient' && !attachment) return undefined;
    const controller = new AbortController();
    let url = '';
    setBusy(true); setError(''); setPreview('');
    const load = async () => {
      try {
        const endpoint = attachment ? `/attachments/${attachment.id}/content` : `/registration-intakes/${row.intakeId}/patient-record`;
        const response = await fetch(`${api}/clinic-records${endpoint}`, {
          headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal,
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'Unable to load this record.');
        }
        if (attachment) {
          const blob = await response.blob();
          if (controller.signal.aborted) return;
          url = URL.createObjectURL(blob); setPreview(url);
        } else {
          const result = await response.json();
          if (!controller.signal.aborted) setPatient(result);
        }
      } catch (error) { if (error.name !== 'AbortError') setError(error.message); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    };
    load();
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [action, attachment, row.intakeId, user.token]);
  const choose = next => {
    if (next === 'edit') { onEdit(row); onClose(); return; }
    if (next === 'continue') { onContinue(); onClose(); return; }
    setAttachment(null); setError(''); setBusy(false); setAction(next);
  };
  const form = row.form || {};
  if (action === 'actions') return <RecordActionsModal
    title="Registration Actions"
    recordLabel={`Registration ${row.id}`}
    recordName={row.pet || 'Unnamed pet'}
    recordMeta={`Owner: ${row.owner || 'Not provided'} · Assigned to: ${row.doctor || 'Unassigned'}`}
    status={registrationStatusLabel(row.status)}
    user={user}
    showPetAvatar
    onClose={onClose}
    actions={registrationActions(row.status).map(item => ({
      label: registrationActionLabels[item],
      description: {
        continue: 'Resume this unfinished registration.',
        details: 'Review owner information, pet details, and registration information.',
        delete: 'Remove this unfinished registration after confirmation.',
        attachments: 'Preview vaccination cards, medical records, and uploaded documents.',
        review: 'Check the assigned doctor and current approval progress.',
        history: 'Review recorded activity and changes for this registration.',
        edit: 'Correct the information requested by the doctor and resubmit.',
        feedback: 'Read the doctor’s comments and requested corrections.',
        patient: 'Open the approved patient record with reception access.',
        rejection: 'Read the doctor’s reason for declining this registration.',
      }[item],
      destructive: item === 'delete',
      onClick: () => choose(item),
    }))}
  />;
  return <dialog ref={dialog} className={`reception-workflow-dialog clinic-record-details-modal${action === 'history' ? ' clinic-record-audit-modal lab-audit-dialog' : ''}`} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinic-record-details-header"><div><h2>{action === 'actions' ? 'Registration Actions' : registrationActionLabels[action]}</h2><p>{row.id} · {row.pet || 'Unnamed pet'}</p><p>{registrationStatusLabel(row.status)}</p></div><button type="button" onClick={onClose}>Close</button></header>
    <section className="reception-workflow-body record-details-content">
      {error && <p role="alert" className="reception-action-error">{error}</p>}
      {action === 'actions' && <div className="reception-action-menu">{registrationActions(row.status).map(item => <button key={item} type="button" className={item === 'delete' ? 'danger' : ''} onClick={() => choose(item)}><strong>{registrationActionLabels[item]}</strong><span aria-hidden="true">›</span></button>)}</div>}
      {action === 'details' && <Details fields={{ 'Owner name': form.ownerName, Phone: form.phone, Email: form.email, Address: form.address,
        'Pet name': form.petName, Species: form.species, Breed: form.breed, Sex: form.gender, 'Date of birth': form.dob,
        Age: form.ageValue ? `${form.ageValue} ${form.ageUnit}` : '', 'Color / markings': form.markings, 'Reason for Visit / Reported Symptoms': form.reasonForVisit,
        'Triage Priority (Preliminary)': screening.triage.find(item=>item.value===form.calculatedScreening?.effective?.triage_priority)?.label || 'Not assessed',
        'Infection Risk (Preliminary)': screening.infection.find(item=>item.value===form.calculatedScreening?.effective?.infection_risk)?.label || 'Not assessed',
        'Assigned doctor': row.doctor, [row.status === 'Draft' ? 'Draft saved' : 'Submitted']: date(row.submittedAt) }} />}
      {action === 'review' && <Details fields={{ 'Assigned doctor': row.doctor, Submitted: date(row.submittedAt), 'Current status': registrationStatusLabel(row.status), Progress: 'Awaiting review by the assigned veterinarian', 'Last updated': date(row.updatedAt) }} />}
      {(action === 'feedback' || action === 'rejection') && <><p>{row.correctionNote || 'No doctor feedback was recorded.'}</p><Details fields={{ Doctor: row.doctor, Updated: date(row.updatedAt) }} /></>}
      {action === 'history' && <><h3>Recorded events</h3>{row.auditEvents?.length ? <ol className="reception-audit-list">{row.auditEvents.map(event => <li key={event.id}><strong>{event.action.replace(/_/g, ' ')}</strong><span>{date(event.timestamp)} · {event.user || 'System'}</span><span>{registrationStatusLabel(event.status)}</span>{event.reason && <span>{event.reason}</span>}</li>)}</ol> : <p>No timestamped review events were recorded for this earlier registration.</p>}<Details fields={{ Created: date(row.createdAt), 'Created by': row.submittedBy, 'Last updated': date(row.updatedAt) }} />{!!row.activity?.length && <><h3>Activity notes</h3><ul>{row.activity.map((entry, index) => <li key={index}>{entry}</li>)}</ul></>}</>}
      {action === 'attachments' && <>{row.attachments?.length ? row.attachments.map(file => <p key={file.id}><button type="button" onClick={() => setAttachment(file)}>{file.filename}</button></p>) : <p>No files attached.</p>}{busy && <p>Loading attachment…</p>}{preview && (attachment?.content_type?.startsWith('image/') ? <img src={preview} alt={attachment.filename} style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain' }} /> : <iframe src={preview} title={attachment?.filename} style={{ width: '100%', height: '55vh', border: 0 }} />)}</>}
      {action === 'patient' && <>{busy && <p>Loading patient record…</p>}{patient && <><p>Patient record · Reception access</p><Details fields={{ Name: patient.name, Species: patient.species, Breed: patient.breed, Sex: patient.sex,
        'Date of birth': patient.birth_date ? String(patient.birth_date).slice(0, 10) : '', Color: patient.color, 'Reason for Visit / Reported Symptoms': patient.reason_for_visit,
        Owner: patient.owner, Phone: patient.phone, Email: patient.email, Address: patient.address,
        'Assigned doctor': patient.assigned_doctor, Created: date(patient.created_at) }} /></>}</>}
      {action === 'delete' && <p>Delete this unfinished registration draft? This removes the draft saved on this device.</p>}
    </section><footer>{action !== 'actions' && <button type="button" onClick={() => { setAttachment(null); setAction('actions'); setError(''); }}>Back to Actions</button>}{action === 'delete' && <button type="button" className="is-danger" onClick={() => { if (onDelete()) onClose(); }}>Delete Draft</button>}</footer>
  </dialog>;
}
