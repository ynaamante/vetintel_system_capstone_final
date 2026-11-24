import { apiFetch as fetch } from '../utils/apiFetch.js';
import {useEffect,useRef,useState} from 'react';
import {RestockProduct,restockStatus} from './RestockRequestDialog';
import {hasAction} from '../utils/permissionUtils';
export default function RestockRequestDetails({row,user,onClose,onSaved}){
 const ref=useRef(null),[declining,setDeclining]=useState(false),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>previous?.focus();},[]);
 const decide=async status=>{setBusy(true);setError('');try{const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');const response=await fetch(`${api}/clinic-records/restock-requests/${row.id}`,{method:'PATCH',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},body:JSON.stringify({status,review_notes:notes})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to review request.');onSaved();onClose();}catch(failure){setError(failure.message);}finally{setBusy(false);}};
 const canReview=hasAction(user.permissions,user.role,'Restock Inventory')&&['pending','approved'].includes(row.status);
 return (
   <dialog ref={ref} className="rs-dialog rs-details-dialog" aria-labelledby="rs-details-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
     <header>
       <div><h2 id="rs-details-title">Restock Request Details</h2><p>Review the inventory restock request from the doctor.</p></div>
       <button type="button" disabled={busy} onClick={onClose}>Close</button>
     </header>
     <RestockProduct item={row} requested={row.quantity}/>
     <section className="rs-section">
       <h3>Request Information</h3>
       <dl className="rs-info">
         <div><dt>Requested by</dt><dd>{row.requested_by_name} <span className="rs-requester-role">({String(row.requested_by_role||'Doctor').replace(/_/g,' ')})</span></dd></div>
         <div><dt>Date Requested</dt><dd><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}</time></dd></div>
         <div><dt>Urgency</dt><dd><span className="rs-badge" data-state={row.urgency==='urgent'?'urgent':'normal'}>{row.urgency==='urgent'?'Urgent':'Normal'}</span></dd></div>
         <div><dt>Request Status</dt><dd><span className="rs-badge" data-state={row.status}>{restockStatus(row.status)}</span></dd></div>
       </dl>
     </section>
     <section className="rs-section">
       <h3>Note from Doctor</h3>
       <div className="rs-doctor-note">{row.notes||'No note provided.'}</div>
     </section>
     {declining&&<label className="rs-review">Reason for declining *<textarea maxLength={1000} value={notes} onChange={event=>setNotes(event.target.value)} autoFocus/></label>}
     {error&&<p role="alert" className="rs-error">{error}</p>}
     {canReview&&<footer>
       <button type="button" disabled={busy||(declining&&!notes.trim())} onClick={()=>declining?decide('rejected'):setDeclining(true)}>{declining?'Confirm Decline':'Decline Request'}</button>
       {row.status==='pending'&&<button type="button" className="rs-primary" disabled={busy} onClick={()=>decide('approved')}>{busy?'Saving…':'Approve Request'}</button>}
       {row.status==='approved'&&<button type="button" className="rs-primary" disabled={busy} onClick={()=>decide('fulfilled')}>Mark Fulfilled</button>}
     </footer>}
   </dialog>
 );
}
