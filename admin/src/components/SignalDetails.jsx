import { useEffect, useRef, useState } from 'react';
import { canViewFeature, hasAction } from '../utils/permissionUtils';
import { signalStatus, signalTrigger, signalDate } from '../utils/diseaseSignals';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/,'');
async function request(user,path,body) {
  const response=await fetch(`${api}/disease-intelligence/alerts/${path}`,{method:body?'PATCH':'GET',cache:'no-store',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
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
  const review=hasAction(user.permissions,user.role,'Review Disease Alerts');
  const canHistory=canViewFeature(user.permissions,user.role,'Risk Monitoring')||canViewFeature(user.permissions,user.role,'Disease Monitoring');
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
  return <dialog className="dm-dialog signal-details" ref={ref} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header><h2>Signal Details</h2><button type="button" aria-label="Close signal details" disabled={busy} onClick={onClose}>×</button></header>
    <p className="dm-callout">A signal highlights disease activity that needs review. It does not confirm an outbreak.</p>
    <dl className="dm-details">{[
      ['Disease',signal.disease],['Reporting Barangay',signal.area],['Signal Week',`${signal.period_start} – ${signal.period_end}`],
      ['Cases in Signal Week',signal.observed_cases],['Previous Calendar Week',signal.baseline_cases??'Withheld'],
      ['Trigger',signalTrigger(signal.alert_type)],['Triggering Rule',signal.rule_description],['Review Status',signalStatus(signal.status)],
      ['Assigned Reviewer',signal.reviewed_by_name||(signal.reviewed_by?`Staff #${signal.reviewed_by}`:'Unassigned')],['Detected',signalDate(signal.triggered_at)],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <label>Review Notes<textarea maxLength={1000} value={notes} onChange={event=>setNotes(event.target.value)} disabled={!review||busy||signal.status!=='under_review'} placeholder={signal.status==='new'?'Start review to add investigation notes.':'Record findings and follow-up actions.'}/></label>
    <p className="dm-footnote">Do not include patient or owner identities in review notes. Related cases opens privacy-protected summaries for this disease and barangay within the selected reporting period.</p>
    {error&&<p role="alert" className="dm-error">{error}</p>}
    <footer>
      {onNavigate&&canViewFeature(user.permissions,user.role,'Disease Monitoring')&&<button type="button" disabled={busy} onClick={related}>View Related Cases</button>}
      {review&&signal.status==='new'&&<button type="button" className="dm-primary" disabled={busy} onClick={()=>save('under_review')}>{busy?'Starting…':'Start Review'}</button>}
      {review&&signal.status==='under_review'&&<><button type="button" disabled={busy} onClick={()=>save('under_review')}>{busy?'Saving…':'Save Review Notes'}</button><button type="button" className="dm-primary" disabled={busy} onClick={()=>save('resolved')}>Mark as Resolved</button></>}
      {canHistory&&<button type="button" disabled={busy} aria-expanded={historyOpen} onClick={()=>{setError('');setHistoryOpen(value=>!value);}}>{historyOpen?'Hide Review History':'View Review History'}</button>}
    </footer>
    {historyOpen&&<section className="signal-history"><h3>Review History</h3>{historyLoading?<p role="status">Loading review history…</p>:history?.length?<ol>{history.map(entry=><li key={entry.id}><strong>{signalStatus(entry.status)}</strong><span>{entry.reviewer||'Staff member'} · {signalDate(entry.created_at)}</span><p>{entry.review_notes||'No review notes recorded.'}</p></li>)}</ol>:history&&<p>No review actions recorded yet.</p>}</section>}
  </dialog>;
}
