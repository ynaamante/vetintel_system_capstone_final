import { Icons } from '../../icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import ClinicAttachmentImage from '../../components/ClinicAttachmentImage';
import LabDateTimePicker from '../../components/LabDateTimePicker';
import { readApiResponse } from '../../utils/apiResponse';
import { dateFilterValue } from '../../utils/dateFilters';
import { formatDateText, formatDateTimeText } from '../../utils/dateFormatting';
import './reminderDetailsModal.css';

const title = value => String(value || '').replace(/[_-]/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());
export default function ReminderDetailsModal({ reminderId, user, onClose, onSaved, onViewPatient, onOpenSchedule }) {
  const dialog=useRef(null), requestId=useRef(null);
  const [data,setData]=useState(null), [loading,setLoading]=useState(true), [busy,setBusy]=useState(false);
  const [error,setError]=useState(''), [notice,setNotice]=useState(''), [channels,setChannels]=useState([]);
  const [scheduling,setScheduling]=useState(false), [newDate,setNewDate]=useState(''), [reason,setReason]=useState('');
  const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
  const endpoint=`${api}/clinic-records/reminders/${encodeURIComponent(reminderId)}?clinic_id=${encodeURIComponent(user.clinic_id)}`;
  useEffect(()=>{
    const element=dialog.current, previous=document.activeElement, overflow=document.body.style.overflow;
    element.showModal();document.body.style.overflow='hidden';
    return()=>{element.close();document.body.style.overflow=overflow;previous?.focus?.();};
  },[]);
  const load=useCallback(async signal=>{
    const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${user.token}`},signal});
    const body=await readApiResponse(response,'Unable to load reminder details.');
    if(signal?.aborted)return;
    setData(body);setChannels(current=>current.length?current.filter(id=>body.channels.some(channel=>channel.id===id&&channel.available)):body.channels.filter(channel=>channel.available).map(channel=>channel.id));
  },[endpoint,user.token]);
  useEffect(()=>{
    const controller=new AbortController();
    load(controller.signal).catch(failure=>{if(!controller.signal.aborted)setError(failure.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[load]);
  const send=async()=>{
    if(busy||!channels.length)return;
    setBusy(true);setError('');setNotice('');
    requestId.current ||= crypto.randomUUID();
    try{
      const response=await fetch(`${api}/clinic-records/reminders/${encodeURIComponent(reminderId)}/send?clinic_id=${encodeURIComponent(user.clinic_id)}`,{method:'POST',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},body:JSON.stringify({channels,request_id:requestId.current})});
      const body=await readApiResponse(response,'Unable to send this reminder.');
      requestId.current=null;
      if(body.results?.some(result=>result.status==='failed'))setError(body.message);else setNotice(body.message);
      await load();onSaved?.();
    }catch(failure){setError(failure.message);}finally{setBusy(false);}
  };
  const reschedule=async event=>{
    event.preventDefault();if(busy||!data?.appointment)return;
    setBusy(true);setError('');
    try{
      const response=await fetch(`${api}/clinic-records/appointments/${data.appointment.id}/related?clinic_id=${encodeURIComponent(user.clinic_id)}`,{method:'POST',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'reschedule',start_time:new Date(`${newDate}:00+08:00`).toISOString(),visit_type:data.reminder.appointment_type||'Check-up',reason})});
      await readApiResponse(response,'Unable to reschedule this appointment.');
      window.dispatchEvent(new Event('vetintel:appointment-updated'));onSaved?.();onClose();
    }catch(failure){setError(failure.message);}finally{setBusy(false);}
  };
  const status=data?.reminder.status;
  const minDate=dateFilterValue(new Date())+'T'+new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  return createPortal(<dialog ref={dialog} className="reminder-details-modal" aria-labelledby="reminder-details-title" onCancel={event=>{if(busy)event.preventDefault();else onClose();}} onClick={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
    <div className="rdm-shell"><header className="rdm-header"><div><h2 id="reminder-details-title">Reminder Details</h2><p>{data?`${title(data.reminder.type)} reminder · ${data.patient.name}`:'Review patient due dates and notifications'}</p></div><div className="rdm-header-actions">{data&&<span className={`rdm-status is-${status}`}>{title(status)}</span>}<button type="button" className="rdm-close" aria-label="Close reminder details" disabled={busy} onClick={onClose}>×</button></div></header>
      <div className="rdm-body">{loading&&<p role="status">Loading reminder details...</p>}{error&&<p className="rdm-error" role="alert">{error}</p>}{notice&&<p className="rdm-notice" role="status">{notice}</p>}
      {data&&<><div className="rdm-overview"><aside className="rdm-patient"><div className="rdm-pet-heading"><ClinicAttachmentImage user={user} attachmentId={data.patient.photo_attachment_id} alt={`${data.patient.name} profile`} className="rdm-pet-photo" fallback={<span className="rdm-pet-placeholder">{data.patient.name.slice(0,1)}</span>} /><div><h3>{data.patient.name}</h3><span className="rdm-tag">Patient</span><p>{[data.patient.species,data.patient.breed].filter(Boolean).join(' · ')||'Details not recorded'}</p></div></div><section><h3>Owner Information</h3><div className="rdm-owner-name"><strong>{data.patient.owner||'Owner not recorded'}</strong><span className="rdm-tag">Owner</span></div><p className="rdm-contact"><span aria-hidden="true">{Icons.phone}</span>{data.patient.phone||'No phone recorded'}</p><p className="rdm-contact"><span aria-hidden="true">{Icons.mail}</span>{data.patient.email||'No email recorded'}</p></section></aside>
        <section className="rdm-information"><h3>Reminder Information</h3><dl><div><dt>Reminder Type</dt><dd>{title(data.reminder.appointment_type||data.reminder.type)}</dd></div><div><dt>{data.vaccination?'Vaccine':'Service / Follow-up'}</dt><dd>{data.vaccination?.vaccine_name||data.treatment_plan?.title||data.appointment?.reason||data.reminder.message||'Not recorded'}</dd></div><div><dt>Due Date</dt><dd>{formatDateText(data.reminder.scheduled_at,undefined,'Not set')}</dd></div><div><dt>Assigned Doctor</dt><dd>{data.reminder.doctor||data.appointment?.doctor||'Unassigned'}</dd></div></dl><div className="rdm-clinical-notes"><strong>Clinical Notes</strong><p>{data.clinical_notes||'No clinical notes recorded.'}</p></div></section></div>
        <section className="rdm-send"><h3>Send Reminder</h3><p>Choose how to notify the pet owner.</p><div className="rdm-send-row"><div className="rdm-channels">{data.channels.map(channel=><label key={channel.id} title={channel.reason||(channel.id==='email'?"Send to the owner's registered email address.":'Notify the owner through the VetIntel pet owner app.')} className={`rdm-channel${!channel.available?' is-unavailable':''}`}><input type="checkbox" checked={channels.includes(channel.id)} disabled={busy||!channel.available} onChange={event=>setChannels(current=>event.target.checked?[...current,channel.id]:current.filter(id=>id!==channel.id))}/><span className="rdm-channel-icon" aria-hidden="true">{channel.id==='email'?Icons.mail:Icons.bell}</span><span className="rdm-channel-copy"><strong>{channel.label}</strong><small>{channel.id==='email'?"Send to the owner's registered email address.":'Notify the owner through the VetIntel pet owner app.'}</small></span></label>)}</div><button type="button" className="rdm-primary" title={data.message} disabled={busy||!channels.length} onClick={send}>{busy?'Processing...':'Send Reminder'}</button></div></section>
        <section className="rdm-history"><h3>Reminder History</h3><div className="rdm-table-scroll"><table><colgroup><col className="rdm-col-date"/><col className="rdm-col-channel"/><col className="rdm-col-message"/><col className="rdm-col-status"/></colgroup><thead><tr>{['Date & Time','Channel','Message','Status'].map(label=><th key={label} title={label==='Status'?'Email: accepted by the mail provider. In-app: saved to the owner inbox; Delivered means the app acknowledged receipt.':undefined}>{label}</th>)}</tr></thead><tbody>{data.history.map(entry=><tr key={entry.id}><td>{formatDateTimeText(entry.sent_at||entry.created_at)}{entry.sent_by&&<small>{entry.sent_by}</small>}{entry.read_at&&<small>Read {formatDateTimeText(entry.read_at)}</small>}</td><td><span className="rdm-history-channel"><span aria-hidden="true">{entry.channel==='email'?Icons.mail:entry.channel==='in_app'?Icons.bell:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.8-4.8A9 9 0 1 1 21 11Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg>}</span>{entry.channel==='in_app'?'In-App Notification':title(entry.channel)}</span></td><td>{entry.message}{entry.error&&<small className="rdm-error-text">{entry.error}</small>}</td><td><span className={`rdm-delivery is-${entry.status}`}>{entry.status==='sending'?'Processing':title(entry.status)}</span></td></tr>)}{!data.history.length&&<tr><td colSpan="4" className="rdm-empty">No reminders have been sent yet.</td></tr>}</tbody></table></div></section>
        {scheduling&&<form className="rdm-reschedule" onSubmit={reschedule}><h3>Reschedule Appointment</h3><label>New date and time<LabDateTimePicker required label="New appointment date and time" value={newDate} min={minDate} onChange={setNewDate} disabled={busy}/></label><label>Reason<textarea required maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} disabled={busy}/></label><div><button type="button" disabled={busy} onClick={()=>setScheduling(false)}>Cancel</button><button type="submit" className="rdm-primary" disabled={busy||!newDate}>{busy?'Saving...':'Save New Schedule'}</button></div></form>}
      </>}
      </div><footer className="rdm-footer">{data&&<><button type="button" disabled={busy} onClick={()=>onViewPatient?.(data.patient.id)}>View Patient Record</button>{data.can_reschedule?<button type="button" disabled={busy} onClick={()=>setScheduling(value=>!value)}>Reschedule</button>:<button type="button" disabled={busy} title="Open the doctor schedule to arrange a new date" onClick={onOpenSchedule}>Reschedule</button>}</>}<button type="button" className="rdm-primary" disabled={busy} onClick={onClose}>Close</button></footer>
    </div>
  </dialog>,document.body);
}
ReminderDetailsModal.propTypes={reminderId:PropTypes.oneOfType([PropTypes.string,PropTypes.number]).isRequired,user:PropTypes.object.isRequired,onClose:PropTypes.func.isRequired,onSaved:PropTypes.func,onViewPatient:PropTypes.func,onOpenSchedule:PropTypes.func};
