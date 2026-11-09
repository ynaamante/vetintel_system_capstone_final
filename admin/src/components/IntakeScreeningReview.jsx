import { useState } from 'react';
import options from '../../../data/intakeScreening.json';
import rules from '../../../data/intakeScreeningRules.json';
import { announceRegistrationUpdate } from '../utils/registrationSync';
const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
export default function IntakeScreeningReview({intake,user}) {
  const saved=intake.screening;
  const [triage,setTriage]=useState(saved?.effective?.triage_priority||'not_assessed');
  const [infection,setInfection]=useState(saved?.effective?.infection_risk||'not_assessed');
  const [note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const labels=(values,list)=>(values||[]).map(value=>list.find(([id])=>id===value)?.[1]||value).join(', ')||'Not reported';
  const label=(kind,value)=>options[kind].find(item=>item.value===value)?.label||'Not assessed';
  return <section style={{border:'1px solid #dce7e1',borderRadius:10,padding:14,marginBottom:14,fontSize:12}}>
    <h3 style={{margin:'0 0 10px',fontSize:14}}>Structured Screening / Veterinary Review</h3>
    <p><strong>Reported symptoms:</strong> {labels(saved?.inputs?.symptoms,rules.symptoms)}{saved?.inputs?.other_symptom&&' - '+saved.inputs.other_symptom}</p>
    <p><strong>Reported exposure:</strong> {labels(saved?.inputs?.exposures,rules.exposures)}</p>
    <p><strong>Routine visit reported:</strong> {saved?.inputs?.routine_visit?'Yes':'Not selected'}</p>
    <p><strong>Suggested:</strong> {label('triage',saved?.suggested?.triage_priority)} / {label('infection',saved?.suggested?.infection_risk)}</p>
    <p style={{color:'#64748b'}}>Rule version: {saved?.rule_version||'No structured screening recorded'}. Illustrative rules; not clinically validated. Veterinary approval is required before clinical use.</p>
    {saved?.review&&<p><strong>Veterinarian reviewed{saved.review.overridden?' / overridden':''}:</strong> {new Date(saved.review.reviewed_at).toLocaleString()}<br/>{saved.review.note}</p>}
    {['Needs review','Approved'].includes(intake.status)&&<form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');setSuccess('');try{
      const response=await fetch(api+'/clinic-records/registration-intakes/'+intake.registrationIntakeId+'/screening',{method:'PATCH',headers:{Authorization:'Bearer '+user.token,'Content-Type':'application/json'},body:JSON.stringify({triage_priority:triage,infection_risk:infection,note})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to save screening review.');setSuccess('Screening review saved.');announceRegistrationUpdate();
    }catch(error){setError(error.message);}finally{setBusy(false);}}}>
      <label style={{display:'grid',gap:5,marginBottom:10}}>Triage Priority<select value={triage} onChange={event=>setTriage(event.target.value)} disabled={busy}>{options.triage.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label style={{display:'grid',gap:5,marginBottom:10}}>Infection Risk<select value={infection} onChange={event=>setInfection(event.target.value)} disabled={busy}>{options.infection.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label style={{display:'grid',gap:5,marginBottom:10}}>Review note (required for an override)<textarea rows={2} maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} disabled={busy}/></label>
      <button type="submit" disabled={busy} style={{border:'1px solid #086b50',borderRadius:7,padding:'8px 12px',background:'#086b50',color:'white',cursor:'pointer'}}>{busy?'Saving...':'Confirm / Override Screening'}</button>
      {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
    </form>}
    <p style={{marginBottom:0,color:'#64748b'}}>Screening indicators describe urgency and precautions; a diagnosis is recorded separately.</p>
  </section>;
}
