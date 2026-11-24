import { apiFetch as fetch } from '../utils/apiFetch.js';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { canViewFeature, hasAction } from '../utils/permissionUtils';
import { signalStatus, signalTrigger, signalDate } from '../utils/diseaseSignals';
import './signalAdvisory.css';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/,'');
async function request(user,path,body,method=body?'PATCH':'GET') {
  const response=await fetch(`${api}/disease-intelligence/alerts/${path}`,{method,cache:'no-store',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Unable to load signal details.');
  return data;
}
export default function SignalDetails({row,user,onClose,onSaved,onNavigate,filters={}}) {
  const ref=useRef(null);
  const [signal,setSignal]=useState(row);
  const [notes,setNotes]=useState(row.review_notes||'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [history,setHistory]=useState(null);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [historyRevision,setHistoryRevision]=useState(0);
  const [advisory, setAdvisory] = useState(null);
  const [clinicIds, setClinicIds] = useState([]);
  const [notifyOwners, setNotifyOwners] = useState(false);
  const [sent, setSent] = useState('');
  const review=hasAction(user.permissions,user.role,'Review Disease Alerts');
  const canShare=hasAction(user.permissions,user.role,'Alert Clinics');
  const canHistory=['Risk Monitoring','Disease Monitoring','Intelligence Dashboard'].some(feature=>canViewFeature(user.permissions,user.role,feature));
  useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>previous?.focus();},[]);
  useEffect(()=>{
    if(!historyOpen)return;
    let active=true;
    setHistoryLoading(true);
    request(user,`${row.id}/history`).then(data=>{if(active)setHistory(data.history);}).catch(failure=>{if(active)setError(failure.message);}).finally(()=>{if(active)setHistoryLoading(false);});
    return()=>{active=false;};
  },[historyOpen,historyRevision,row.id,user]);
  const save=async status=>{
    setBusy(true);setError('');
    try {
      const updated=await request(user,`${signal.id}/review`,{status,review_notes:notes,expected_status:signal.status});
      setSignal(current=>({...current,...updated}));setNotes(updated.review_notes);setHistory(null);setHistoryRevision(value=>value+1);onSaved?.();
    } catch(failure) {setError(failure.message);} finally {setBusy(false);}
  };
  const related=()=>onNavigate?.('disease',{...filters,days:filters.days||'90',disease:signal.disease_key,area:signal.area,search:''});
  const prepareAdvisory = async () => {
    setBusy(true);
    setError('');
    try {
      setAdvisory(await request(user, `${signal.id}/advisory`));
      setClinicIds([]);
      setNotifyOwners(false);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const sendAdvisory = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await request(user, `${signal.id}/advisory`, { clinicIds, notifyOwners, comparison: advisory.comparison }, 'POST');
      setSent(result.clinicsSent || result.ownersSent ? `Advisory sent to ${result.clinicsSent} clinic(s) and ${result.ownersSent} PetWatch owner(s).` : 'No new advisories were sent.');
      setAdvisory(null);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const increasing=signal.baseline_cases!=null&&Number(signal.observed_cases)>Number(signal.baseline_cases);
  const increase=increasing?(Number(signal.baseline_cases)>0?`+${Math.round((signal.observed_cases-signal.baseline_cases)/signal.baseline_cases*100)}%`:'New activity'):null;
  return createPortal(<dialog className="dm-dialog signal-details signal-drawer" aria-labelledby="signal-drawer-title" ref={ref} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header><h2 id="signal-drawer-title">Signal Details</h2><button type="button" aria-label="Close signal details" disabled={busy} onClick={onClose}>×</button></header>
    <section className="signal-trend-summary" aria-label="Disease trend summary">
      <p className="signal-trend-label">{increasing?'Disease trend detected':'Disease signal detected'}</p>
      <h3>{signal.disease} {increasing?'Cases Increasing':'Signal to Review'}</h3>
      <p>{signal.area}. Review the signal before deciding whether to send an advisory.</p>
      <dl>
        <div><dt>Signal week</dt><dd>{signal.observed_cases}</dd></div>
        <div><dt>Previous week</dt><dd>{signal.baseline_cases??'Withheld'}</dd></div>
        {increase&&<div><dt>Increase</dt><dd>{increase}</dd></div>}
      </dl>
    </section>
    <p className="dm-callout">A signal highlights disease activity that needs review. It does not confirm an outbreak.</p>
    <dl className="dm-details">{[
      ['Disease',signal.disease],['Reporting Barangay',signal.area],['Signal Week',`${signal.period_start} – ${signal.period_end}`],
      ['Cases in Signal Week',signal.observed_cases],['Previous Calendar Week',signal.baseline_cases??'Withheld'],
      ['Trigger',signalTrigger(signal.alert_type)],['Triggering Rule',signal.rule_description],['Review Status',signalStatus(signal.status)],
      ['Assigned Reviewer',signal.reviewed_by_name||(signal.reviewed_by?`Staff #${signal.reviewed_by}`:'Unassigned')],['Detected',signalDate(signal.triggered_at)],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {review ? <label>Review Notes<textarea maxLength={1000} value={notes} onChange={event=>setNotes(event.target.value)} disabled={busy||signal.status!=='under_review'} placeholder={signal.status==='new'?'Start review to add investigation notes.':'Record findings and follow-up actions.'}/></label> : notes && <p><strong>Review Notes</strong> {notes}</p>}
    <p className="dm-footnote">Do not include patient or owner identities in review notes. Related cases opens privacy-protected summaries for this disease and barangay within the selected reporting period.</p>
    {error&&<p role="alert" className="dm-error">{error}</p>}
    {sent && <p role="status">{sent}</p>}
    <footer>
      {onNavigate&&canViewFeature(user.permissions,user.role,'Disease Monitoring')&&<button type="button" disabled={busy} onClick={related}>View Related Cases</button>}
      {review&&signal.status==='new'&&<button type="button" className="dm-primary" disabled={busy} onClick={()=>save('under_review')}>{busy?'Starting…':'Start Review'}</button>}
      {review&&signal.status==='under_review'&&<><button type="button" disabled={busy} onClick={()=>save('under_review')}>{busy?'Saving…':'Save Review Notes'}</button><button type="button" className="dm-primary" disabled={busy} onClick={()=>save('resolved')}>Mark as Resolved</button></>}
      {canHistory&&<button type="button" disabled={busy} aria-expanded={historyOpen} onClick={()=>{setError('');setHistoryOpen(value=>!value);}}>{historyOpen?'Hide Review History':'View Review History'}</button>}
      {signal.automatic && signal.status==='under_review' && canShare && !advisory && <button type="button" className="dm-primary" disabled={busy} onClick={prepareAdvisory}>Send Advisory</button>}
    </footer>
    {advisory && <form className="signal-advisory" onSubmit={sendAdvisory}>
      <h3>Review Advisory and Recipients</h3>
      <fieldset disabled={busy}>
        <legend>Participating clinics</legend>
        <p>{advisory.messages.clinic}</p>
        {!advisory.clinics.length && <p>No clinics are available to notify.</p>}
        {advisory.clinics.map(clinic => <label key={clinic.id}>
          <input type="checkbox" checked={clinic.sent || clinicIds.includes(clinic.id)} disabled={clinic.sent} onChange={event=>setClinicIds(ids=>event.target.checked ? [...ids,clinic.id] : ids.filter(id=>id!==clinic.id))} />
          {clinic.name}{clinic.sent && ' (sent)'}
        </label>)}
      </fieldset>
      {advisory.owners && <fieldset disabled={busy}>
        <legend>PetWatch advisory</legend>
        <p>{advisory.messages.owners}</p>
        <label><input type="checkbox" checked={notifyOwners || advisory.owners.sent} disabled={advisory.owners.sent || !advisory.owners.count} onChange={event=>setNotifyOwners(event.target.checked)} />
          {advisory.owners.sent ? 'Already sent' : `Notify ${advisory.owners.count} eligible pet owners at this clinic`}
        </label>
      </fieldset>}
      <footer><button type="button" disabled={busy} onClick={()=>setAdvisory(null)}>Cancel</button><button className="dm-primary" disabled={busy || (!clinicIds.length && !notifyOwners)}>{busy ? 'Sending…' : 'Confirm and Send'}</button></footer>
    </form>}
    {historyOpen&&<section className="signal-history"><h3>Review History</h3>{historyLoading?<p role="status">Loading review history…</p>:history?.length?<ol>{history.map(entry=><li key={entry.id}><strong>{signalStatus(entry.status)}</strong><span>{entry.reviewer||'Staff member'} · {signalDate(entry.created_at)}</span><p>{entry.review_notes||'No review notes recorded.'}</p></li>)}</ol>:history&&<p>No review actions recorded yet.</p>}</section>}
  </dialog>,document.body);
}
