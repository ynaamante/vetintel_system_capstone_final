import { useEffect, useState } from 'react';
import definitions from '../../../data/intakeScreeningRules.json';
import indicators from '../../../data/intakeScreening.json';
import './visitScreening.css';
const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
export default function VisitScreeningFields({value,onChange,user}) {
  const input=value||{symptoms:[],exposures:[],other_symptom:'',routine_visit:false};
  const [preview,setPreview]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const serialized=JSON.stringify(input);
  useEffect(()=>{
    const controller=new AbortController();setPreview(null);setLoading(true);setError('');
    const timer=setTimeout(async()=>{try{
      const response=await fetch(api+'/clinic-records/registration-screening/preview',{method:'POST',headers:{Authorization:'Bearer '+user.token,'Content-Type':'application/json'},body:JSON.stringify({screening_inputs:JSON.parse(serialized)}),signal:controller.signal});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to calculate screening.');setPreview(result);
    }catch(error){if(error.name!=='AbortError')setError(error.message);}finally{if(!controller.signal.aborted)setLoading(false);}},250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[serialized,user.token]);
  const toggle=(key,id)=>{
    let values=input[key]||[];
    if(values.includes(id))values=values.filter(value=>value!==id);
    else if(['none','unknown'].includes(id))values=[id];
    else values=[...values.filter(value=>!['none','unknown'].includes(value)),id];
    onChange({...input,[key]:values,...(key==='symptoms'&&!values.includes('other')?{other_symptom:''}:{})});
  };
  return <section className="visit-screening-fields">
    <h3>Visit Screening (Preliminary)</h3>
    <div className="visit-screening-columns">
      <fieldset><legend>Reported Symptoms <span>(Select all that apply)</span></legend><div className="visit-screening-symptoms">{definitions.symptoms.map(([id,label])=><label key={id}><input type="checkbox" checked={(input.symptoms||[]).includes(id)} onChange={()=>toggle('symptoms',id)}/>{label}</label>)}</div>
        {(input.symptoms||[]).includes('other')&&<label className="visit-screening-other">Specify symptom<input maxLength={300} value={input.other_symptom||''} onChange={event=>onChange({...input,other_symptom:event.target.value})}/></label>}
        <label className="visit-screening-routine"><input type="checkbox" checked={input.routine_visit===true} onChange={event=>onChange({...input,routine_visit:event.target.checked})}/>Routine vaccination / check-up visit</label>
      </fieldset>
      <fieldset><legend>Possible Exposure <span>(Optional)</span></legend>{definitions.exposures.map(([id,label])=><label key={id}><input type="checkbox" checked={(input.exposures||[]).includes(id)} onChange={()=>toggle('exposures',id)}/>{label}</label>)}</fieldset>
    </div>
    <div className="visit-screening-preview" aria-live="polite">{loading?'Calculating preliminary indicators...':error?<span role="alert">{error} Screening will be recalculated when submitted.</span>:preview&&<><strong>Suggested triage: {indicators.triage.find(item=>item.value===preview.suggested.triage_priority)?.label}</strong><strong>Infection risk: {indicators.infection.find(item=>item.value===preview.suggested.infection_risk)?.label}</strong></>}</div>
    <p>Record only what the owner reports. Unchecked boxes mean information was not provided. These illustrative rules are not clinically validated and require veterinarian approval before clinical use.</p>
  </section>;
}
