import { useEffect, useRef, useState } from 'react';
import LabDateTimePicker from '../../components/LabDateTimePicker';
import { actionDefinitions, appointmentStage } from '../../utils/appointmentActions';
import './appointmentWorkflow.css';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
export async function appointmentRequest(user, path, options = {}) {
  const response = await fetch(`${api}/clinic-records/appointments${path}`, {
    ...options, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Unable to complete this appointment action.');
  return result;
}

export default function AppointmentWorkflowDialog({ appointment, action, user, onClose, onSaved }) {
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [verified, setVerified] = useState(false);
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);
  const dialog = useRef(null);
  const readOnly = ['view', 'queue', 'visit', 'request', 'history'].includes(action);
  const scheduling = ['reschedule', 'follow_up', 'rebook'].includes(action);
  const arrived = appointmentStage(appointment) === 'checked_in';
  useEffect(() => {
    let active = true;
    appointmentRequest(user, `/${appointment.id}/reception-context`).then(data => { if (active) setContext(data); })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [appointment.id, user.token]);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  const save = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await appointmentRequest(user, `/${appointment.id}/${scheduling ? 'related' : 'reception-action'}`, {
        method: 'POST', body: JSON.stringify(scheduling
          ? { action, start_time: new Date(`${date}T${time}`).toISOString(), reason, visit_type: appointment.reason || 'Appointment', arrival_confirmed: arrivalConfirmed }
          : { action, reason, attendance_verified: verified }),
      });
      await onSaved();
      onClose();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  const details = context?.appointment;
  return <dialog ref={dialog} className={`reception-workflow-dialog clinic-record-details-modal${action === 'history' ? ' clinic-record-audit-modal lab-audit-dialog' : ''}`} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={save}>
      <header className="clinic-record-details-header"><div><h2>{actionDefinitions[action][0]}</h2><p>Appointment #{appointment.id} · {appointment.pet}</p></div><button type="button" disabled={busy} onClick={onClose}>Close</button></header>
      <section className="reception-workflow-body record-details-content">
        {error && <p role="alert" className="reception-action-error">{error}</p>}
        {!context && !error && <p>Loading appointment information…</p>}
        {readOnly && details && <>
          {action === 'history' ? <><p>Created: {new Date(details.created_at).toLocaleString()}</p>{context.history.length ? <ol className="reception-audit-list">{context.history.map(item => <li key={item.id}><strong>{item.action.replace(/_/g, ' ')}</strong><span>{new Date(item.created_at).toLocaleString()} · {item.responsible_user || 'System'}</span>{(item.previous_status || item.status) && <span>{item.previous_status || '—'} → {item.status || '—'}</span>}{item.reason && <span>{item.reason}</span>}</li>)}</ol> : <p>No recorded appointment changes.</p>}</>
            : action === 'queue' ? context.queue ? <dl><dt>Queue position</dt><dd>{context.queue.position}</dd><dt>Patients waiting ahead</dt><dd>{context.queue.patients_ahead}</dd><dt>Waiting status</dt><dd>{context.queue.status}</dd><dt>Arrival</dt><dd>{new Date(context.queue.checkin_at).toLocaleString()}</dd></dl> : <p>This appointment is not currently in the queue.</p>
              : action === 'request' ? <dl><dt>Request</dt><dd>{appointmentStage(appointment).replace(/_/g, ' ')}</dd><dt>Reason</dt><dd>{details.workflow_reason || 'No reason recorded.'}</dd><dt>Approval status</dt><dd>Awaiting assigned doctor review</dd><dt>Assigned doctor</dt><dd>{details.practitioner || 'Unassigned'}</dd></dl>
                : action === 'visit' ? <dl><dt>Patient</dt><dd>{details.pet}</dd><dt>Doctor</dt><dd>{details.practitioner || 'Unassigned'}</dd><dt>Visit type</dt><dd>{details.reason}</dd><dt>Consultation status</dt><dd>{details.consultation_status || details.status}</dd><dt>Completed</dt><dd>{details.completed_at ? new Date(details.completed_at).toLocaleString() : 'Not completed'}</dd></dl>
                  : <dl>{Object.entries({ Patient: details.pet, Species: details.species, Breed: details.breed, Owner: details.owner, Phone: details.phone, Email: details.email, Doctor: details.practitioner, 'Visit type': details.reason, Status: details.status, Scheduled: new Date(details.start_time).toLocaleString(), 'End time': details.end_time ? new Date(details.end_time).toLocaleString() : '', 'Linked appointment': details.parent_appointment_id }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>}
        </>}
        {!readOnly && <>
          {scheduling && <div className="reception-schedule-fields"><label>New date<LabDateTimePicker mode="date" required value={date} onChange={setDate} /></label><label>New time<LabDateTimePicker mode="time" required value={time} onChange={setTime} /></label></div>}
          {(scheduling || action === 'cancel') && <label>Reason<textarea required value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} /></label>}
          {action === 'confirm' && <p>Confirm this pending appointment?</p>}
          {action === 'checkin' && <p>Record the patient’s arrival, add them to the waiting queue, and notify the assigned doctor?</p>}
          {arrived && scheduling && <label className="reception-checkbox"><input type="checkbox" required checked={arrivalConfirmed} onChange={event => setArrivalConfirmed(event.target.checked)} />I confirmed this change with the arrived patient and assigned doctor under clinic policy.</label>}
          {action === 'noshow' && <><p>The grace period is {context?.no_show_grace_minutes ?? 15} minutes after the scheduled time.</p><label className="reception-checkbox"><input type="checkbox" required checked={verified} onChange={event => setVerified(event.target.checked)} />I verified that the patient has not arrived.</label></>}
        </>}
      </section>
      <footer><button type="button" disabled={busy} onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>{!readOnly && <button className={action === 'cancel' || action === 'noshow' ? 'is-danger' : 'is-save'} disabled={busy || !context} type="submit">{busy ? 'Saving…' : actionDefinitions[action][0]}</button>}</footer>
    </form>
  </dialog>;
}
