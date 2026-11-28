import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useEffect, useRef, useState } from 'react';
import LabDateTimePicker from '../../components/LabDateTimePicker';
import { actionDefinitions, appointmentStage } from '../../utils/appointmentActions';
import './appointmentWorkflow.css';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const localDateString = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function VisitDetailSection({ title, items }) {
  return <section className="record-detail-section">
    <h3>{title}</h3>
    <div className="record-detail-section-grid">
      {items.map(([label, value]) => <div className="record-detail-section-item" key={label}>
        <b>{label}</b><span>{value || 'Not recorded'}</span>
      </div>)}
    </div>
  </section>;
}

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
  return <dialog ref={dialog} className={`reception-workflow-dialog clinic-record-details-modal${scheduling ? ' reception-schedule-dialog' : ''}${action === 'history' ? ' clinic-record-audit-modal lab-audit-dialog reception-appointment-audit-dialog' : ''}${['visit', 'view'].includes(action) ? ' reception-visit-detail-dialog' : ''}`} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={save}>
      <header className="clinic-record-details-header"><div><h2>{actionDefinitions[action][0]}</h2><p>Appointment #{appointment.id} · {appointment.pet}</p></div>{!scheduling && !['visit', 'view', 'history'].includes(action) && <button type="button" disabled={busy} onClick={onClose}>Close</button>}</header>
      <section className="reception-workflow-body record-details-content">
        {error && <p role="alert" className="reception-action-error">{error}</p>}
        {!context && !error && <p>Loading appointment information…</p>}
        {readOnly && details && <>
          {action === 'history' ? <div className="clinic-record-audit-panel lab-audit-content reception-appointment-audit-panel">
            <div className="reception-audit-created"><span>Appointment created</span><time>{details.created_at ? new Date(details.created_at).toLocaleString() : 'Date not recorded'}</time></div>
            <section className="lab-audit-timeline clinic-record-audit-timeline">
              <h3>Activity Timeline</h3>
              {context.history.length ? <ol>{context.history.map(item => <li className="audit-timeline-entry" key={item.id}>
                <time dateTime={item.created_at || undefined}>{new Date(item.created_at).toLocaleString()}</time>
                <span className="audit-timeline-marker" aria-hidden="true" />
                <article className="audit-event-card"><header><div>
                  <strong>{item.action.replace(/_/g, ' ').replace(/\b\w/g, value => value.toUpperCase())}</strong>
                  <p>{item.responsible_user || 'System'}{(item.previous_status || item.status) ? ` · ${item.previous_status ? `${item.previous_status} ` : ''}→${item.status ? ` ${item.status}` : ''}` : ''}</p>
                </div></header>{item.reason && <p>{item.reason}</p>}</article>
              </li>)}</ol> : <p>No recorded appointment changes.</p>}
            </section>
          </div>
            : action === 'queue' ? context.queue ? <dl><dt>Queue position</dt><dd>{context.queue.position}</dd><dt>Patients waiting ahead</dt><dd>{context.queue.patients_ahead}</dd><dt>Waiting status</dt><dd>{context.queue.status}</dd><dt>Arrival</dt><dd>{new Date(context.queue.checkin_at).toLocaleString()}</dd></dl> : <p>This appointment is not currently in the queue.</p>
              : action === 'request' ? <dl><dt>Request</dt><dd>{appointmentStage(appointment).replace(/_/g, ' ')}</dd><dt>Reason</dt><dd>{details.workflow_reason || 'No reason recorded.'}</dd><dt>Approval status</dt><dd>Awaiting assigned doctor review</dd><dt>Assigned doctor</dt><dd>{details.practitioner || 'Unassigned'}</dd></dl>
                : action === 'visit' ? <>
                  <div className="record-details-profile record-details-owner-profile reception-visit-profile">
                    <div><h3>{details.pet || 'Patient not recorded'}</h3><p>Pet patient · {details.species || 'Species not recorded'}{details.breed ? ` · ${details.breed}` : ''}</p><span>{details.owner || 'Owner not recorded'}{details.phone ? ` · ${details.phone}` : ''}</span></div>
                  </div>
                  <VisitDetailSection title="Visit Information" items={[
                    ['Appointment ID', `#${appointment.id}`], ['Visit type', details.reason],
                    ['Doctor', details.practitioner || 'Unassigned'], ['Consultation status', details.consultation_status || details.status],
                    ['Completed', details.completed_at ? new Date(details.completed_at).toLocaleString() : 'Not completed'],
                  ]} />
                  <VisitDetailSection title="Patient & Owner" items={[
                    ['Patient', details.pet], ['Species', details.species], ['Breed', details.breed],
                    ['Owner', details.owner], ['Contact number', details.phone], ['Email address', details.email],
                  ]} />
                </>
                  : <>
                    <div className="record-details-profile record-details-owner-profile reception-visit-profile">
                      <div><h3>{details.pet || 'Patient not recorded'}</h3><p>Pet patient · {details.species || 'Species not recorded'}{details.breed ? ` · ${details.breed}` : ''}</p><span>{details.owner || 'Owner not recorded'}{details.phone ? ` · ${details.phone}` : ''}</span></div>
                    </div>
                    <VisitDetailSection title="Appointment Information" items={[
                      ['Appointment ID', `#${appointment.id}`], ['Visit type', details.reason],
                      ['Doctor', details.practitioner || 'Unassigned'], ['Status', details.status],
                      ['Scheduled', details.start_time ? new Date(details.start_time).toLocaleString() : 'Not recorded'],
                      ['End time', details.end_time ? new Date(details.end_time).toLocaleString() : 'Not recorded'],
                      ['Linked appointment', details.parent_appointment_id ? `#${details.parent_appointment_id}` : 'Not recorded'],
                    ]} />
                    <VisitDetailSection title="Patient & Owner" items={[
                      ['Patient', details.pet], ['Species', details.species], ['Breed', details.breed],
                      ['Owner', details.owner], ['Contact number', details.phone], ['Email address', details.email],
                    ]} />
                  </>}
        </>}
        {!readOnly && <>
          {scheduling && <div className="reception-schedule-fields"><label>New date<LabDateTimePicker mode="date" alignToTrigger selectDateImmediately min={localDateString()} required value={date} onChange={setDate} /></label><label>New time<LabDateTimePicker mode="time" alignToTrigger required value={time} onChange={setTime} /></label></div>}
          {(scheduling || action === 'cancel') && <label>Reason<textarea required value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} /></label>}
          {action === 'confirm' && <p>Confirm this pending appointment?</p>}
          {action === 'checkin' && <p>Record the patient’s arrival, add them to the waiting queue, and notify the assigned doctor?</p>}
          {arrived && scheduling && <label className="reception-checkbox"><input type="checkbox" required checked={arrivalConfirmed} onChange={event => setArrivalConfirmed(event.target.checked)} />I confirmed this change with the arrived patient and assigned doctor under clinic policy.</label>}
          {action === 'noshow' && <><p>The grace period is {context?.no_show_grace_minutes ?? 15} minutes after the scheduled time.</p><label className="reception-checkbox"><input type="checkbox" required checked={verified} onChange={event => setVerified(event.target.checked)} />I verified that the patient has not arrived.</label></>}
        </>}
      </section>
      <footer className={action === 'history' ? 'clinic-record-details-footer' : ['visit', 'view'].includes(action) ? 'reception-visit-footer' : ''}><button type="button" className={action === 'history' ? 'lab-audit-close-button' : ['visit', 'view'].includes(action) ? 'is-save' : ''} disabled={busy} onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>{!readOnly && <button className={action === 'cancel' || action === 'noshow' ? 'is-danger' : 'is-save'} disabled={busy || !context} type="submit">{busy ? 'Saving…' : actionDefinitions[action][0]}</button>}</footer>
    </form>
  </dialog>;
}
