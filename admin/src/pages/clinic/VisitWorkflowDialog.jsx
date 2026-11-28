import { apiFetch as fetch } from '../../utils/apiFetch.js';
import ServiceInventorySummary from '../../components/ServiceInventorySummary';
import { useEffect, useRef, useState } from 'react';
import StatusIndicator from '../../components/StatusIndicator';
import '../receptionist/appointmentWorkflow.css';
const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
export async function visitRequest(user,id,body){
  const response=await fetch(`${api}/clinic-records/appointments/${id}/visit-workflow`,{
    method:body?'POST':'GET',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),
  });
  const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Unable to update the visit.');return result;
}
export default function VisitWorkflowDialog({user,appointmentId,onClose,onChanged,onVaccinations,onPatient,onBilling}){
  const dialog=useRef(null), requestVersion=useRef(0);
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[catalogId,setCatalogId]=useState('');
  const load=async()=>{const version=++requestVersion.current;try{const result=await visitRequest(user,appointmentId);if(requestVersion.current!==version)return;setData(result);setCatalogId(current=>current||String(result.visit.notes?.service_catalog_item_id||''));setError('');}catch(error){if(requestVersion.current===version)setError(error.message);}};
  useEffect(()=>{const previous=document.activeElement;dialog.current?.showModal();load();const refresh=()=>{if(!document.hidden)load();};const timer=window.setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{requestVersion.current++;window.clearInterval(timer);window.removeEventListener('focus',refresh);previous?.focus();};},[appointmentId,user.token]);
  const act=async action=>{setBusy(true);setError('');try{await visitRequest(user,appointmentId,{action,catalog_item_id:catalogId});window.dispatchEvent(new Event('vetintel:appointment-updated'));window.dispatchEvent(new Event('vetintel:billing-updated'));onChanged?.();await load();}catch(error){setError(error.message);}finally{setBusy(false);}};
  const visit=data?.visit,active=visit?.consultation_status==='in_progress',ended=visit?.consultation_status==='completed';
  const service=data?.catalog.find(item=>String(item.id)===catalogId);
  const invoice=data?.invoices[0];
  const vaccinesReady=!!data?.vaccinations.length&&data.vaccinations.every(v=>v.status!=='scheduled'&&v.verified);
  const vaccinationVisit=/vaccin|rabies/i.test(visit?.reason||'')||service?.item_type==='vaccination';
  const assigned=visit&&!visit.practitioner_id||Number(visit?.practitioner_id)===Number(user.id);
  return <dialog ref={dialog} className="reception-workflow-dialog clinic-record-details-modal reception-visit-detail-dialog" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header className="clinic-record-details-header"><div><h2>{visit?.reason||'Visit & Check-up'}</h2><p>{visit?.pet} · {visit?.owner}</p>{visit&&<StatusIndicator status={active?'in_consultation':ended?'completed':visit.status}/>}</div><button type="button" disabled={busy} onClick={onClose}>Close</button></header>
    <div className="reception-workflow-body record-details-content">
      {error&&<p role="alert" className="reception-action-error">{error}</p>}
      {!data&&<p>Loading visit…</p>}
      {visit&&<>
        <section className="visit-detail-section"><h3>Visit Details</h3><dl className="visit-detail-grid">
          <div><dt>Attending Veterinarian</dt><dd>{visit.veterinarian||'Unassigned'}</dd></div>
          <div><dt>Visit Date</dt><dd>{new Date(visit.start_time).toLocaleString()}</dd></div>
          <div><dt>Appointment Type</dt><dd>{visit.reason}</dd></div>
          <div><dt>Visit Status</dt><dd><StatusIndicator status={active?'in_consultation':ended?'completed':visit.status}/></dd></div>
        </dl></section>
        <section className="visit-detail-section"><h3>Service &amp; Pricing</h3><dl className="visit-detail-grid visit-service-grid">
          <div><dt>Service</dt><dd>{service?.name||visit.reason}</dd></div>
          <div><dt>Clinic Price</dt><dd>{service?`₱${Number(service.unit_price).toFixed(2)}`:'Select the clinic service when completing the visit.'}</dd></div>
        </dl></section>
        <section className="visit-detail-section visit-related-section"><h3>Related Records</h3><p>Records linked to this visit.</p><div className="visit-related-actions"><button type="button" onClick={()=>onVaccinations(visit)}>Vaccinations ({data.vaccinations.length})</button><button type="button" onClick={()=>onPatient(visit)}>View Patient Records</button></div>
          {!!data.vaccinations.length&&<div className="lab-results-table-wrap"><table className="lab-results-table"><thead><tr><th>Vaccine</th><th>Administration</th><th>Verification</th></tr></thead><tbody>{data.vaccinations.map(v=><tr key={v.id}><td>{v.vaccine_name}</td><td><StatusIndicator status={v.status}/></td><td><StatusIndicator status={v.verified?'verified':'pending'} label={v.verified?'Verified':'Not verified'}/></td></tr>)}</tbody></table></div>}
        </section>
        <section className="visit-workflow-panel visit-detail-section"><h3>Consultation Status</h3><p>Manage the consultation progress for this visit.</p><dl className="visit-consultation-grid"><div><dt>Started At</dt><dd>{visit.started_at?new Date(visit.started_at).toLocaleString():'Not started'}</dd></div><div><dt>Duration</dt><dd>{visit.started_at?`${Math.max(0,Math.floor(((visit.completed_at?new Date(visit.completed_at):new Date())-new Date(visit.started_at))/60000))} min`:'—'}</dd></div><div><dt>Ended At</dt><dd>{visit.completed_at?new Date(visit.completed_at).toLocaleString():'—'}</dd></div></dl>
          {active&&vaccinationVisit&&!vaccinesReady&&<p>Administer and verify the vaccinations before ending consultation.</p>}
          <div className="visit-workflow-buttons"><button type="button" className="is-save" disabled={busy||!assigned||active||ended||!['scheduled','checked_in','in_consultation'].includes(visit.status)} onClick={()=>act('start')}>Start Consultation</button><button type="button" className="is-save" disabled={busy||!assigned||!active||(vaccinationVisit&&!vaccinesReady)} onClick={()=>act('end')}>End Consultation</button></div>
        </section>
        {ended&&<section className="visit-workflow-panel"><h3>Complete service</h3>{invoice?<><p>Invoice #{invoice.id} · ₱{Number(invoice.total).toFixed(2)}{invoice.metadata?.sent_to_reception?' · Sent to reception':''}</p><button type="button" className="is-save" onClick={()=>onBilling(invoice.id)}>View Billing</button></>:<>
          <p>Confirm the service was performed and send its charge to reception for payment.</p>
          {vaccinationVisit&&!vaccinesReady&&<p role="status">All vaccinations for this visit must be administered and verified before billing.</p>}
          <label>Service to bill<select value={catalogId} onChange={event=>setCatalogId(event.target.value)}><option value="">Select clinic service</option>{data.catalog.map(item=><option key={item.id} value={item.id}>{item.name} · ₱{Number(item.unit_price).toFixed(2)}</option>)}</select></label>
          {service&&<div><strong>Linked inventory</strong><ServiceInventorySummary service={service}/></div>}
          <button type="button" className="is-save" disabled={busy||!assigned||!service||(vaccinationVisit&&!vaccinesReady)} onClick={()=>act('complete_service')}>{busy?'Saving…':'Confirm Service Completed'}</button>
        </>}</section>}
      </>}
    </div><footer><button type="button" disabled={busy} onClick={onClose}>Close</button></footer>
  </dialog>;
}
