import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { invoiceNumber } from '../../utils/billingView';
import { notifySuccess } from '../../utils/notifications';
export default function InvoiceCorrectionEditor({ invoice,user,onSaved,onCancel }) {
  const [editing,setEditing]=useState(invoice.metadata?.billing_review_status === 'returned'),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const [items,setItems]=useState(()=> (invoice.items||[]).map(item=>({...item}))),[note,setNote]=useState(''),[tax,setTax]=useState(String(invoice.tax||0));
  const [summary,setSummary]=useState(()=>Object.fromEntries(['chiefComplaint','diagnosis','clinicalFindings','plan'].map(key=>[key,String(invoice.consultation_notes?.[key] || (key==='chiefComplaint'?invoice.appointment_reason||invoice.lab_indication:key==='plan'?invoice.consultation_notes?.followUpInstructions:'') || '')])));
  const voided=invoice.status==='void';
  const total=items.reduce((sum,item)=>sum+Math.round(Number(item.quantity||0)*Number(item.unit_price||0)*100)/100,0)+Number(tax||0);
  const [visits,setVisits]=useState([]),[targetVisit,setTargetVisit]=useState('');
  const replacementAllowed=voided && ['wrong_patient','incorrect_billing_record'].includes(invoice.metadata?.void_reason_code);
  useEffect(()=>{
    if(!editing||!replacementAllowed)return;
    const controller=new AbortController();
    fetch(`${(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'')}/clinic-records/appointments?clinic_id=${encodeURIComponent(user.clinic_id)}`,{headers:{Authorization:`Bearer ${user.token}`},signal:controller.signal})
      .then(async response=>{const payload=await response.json();if(!response.ok||!Array.isArray(payload))throw new Error('Unable to load patient visits.');setVisits(payload);})
      .catch(failure=>{if(failure.name!=='AbortError')setError(failure.message);});
    return()=>controller.abort();
  },[editing,replacementAllowed,user.clinic_id,user.token]);
  const update=(index,key,value)=>setItems(current=>current.map((item,i)=>i===index?{...item,[key]:value}:item));
  const save=async event=>{
    event.preventDefault();setSaving(true);setError('');
    try{
      const response=await fetch(`${(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'')}/clinic-records/invoices/${invoice.id}/correct`,{method:'POST',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},body:JSON.stringify({items,note,tax,...(!voided?{clinical_summary:summary}:{}),...(voided?{target_appointment_id:Number(targetVisit)}:{})})});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to resubmit bill.');
      onSaved(payload);setEditing(false);notifySuccess('Corrected bill sent to reception',invoiceNumber(payload.invoice));window.dispatchEvent(new Event('vetintel:billing-updated'));
    }catch(failure){setError(failure.message);}finally{setSaving(false);}
  };
  return <section className={`doctor-invoice-correction${!voided?" doctor-invoice-correction-full":""}`}><h3>{voided?'Voided Invoice':'Needs Correction'}</h3><p><strong>Reason:</strong> {invoice.metadata?.billing_review_reason||'No reason recorded.'}</p>
    {invoice.metadata?.replacement_invoice_id?<p>A replacement has already been created: invoice #{invoice.metadata.replacement_invoice_id}.</p>:invoice.metadata?.retained_invoice_id?<p>The correct invoice was retained: invoice #{invoice.metadata.retained_invoice_id}.</p>:voided&&!replacementAllowed?<p>This invalid invoice stays voided. Its void reason does not require a replacement. Correctable charges must use Request Correction.</p>:<>
      {voided&&<p>The original voided invoice stays unchanged. Create a corrected replacement to continue billing.</p>}
      {!editing?<button type="button" onClick={()=>setEditing(true)} disabled={!items.length}>{voided?'Create Corrected Replacement':'Edit Bill & Resubmit'}</button>:<form onSubmit={save}>
        {!voided&&<>
          <section className="doctor-correction-section"><h3>Visit details</h3><p><strong>Patient:</strong> {invoice.pet || 'Not recorded'} ? <strong>Owner:</strong> {invoice.owner || 'Not recorded'}</p><p><strong>Veterinarian:</strong> {invoice.doctor || 'Not recorded'}</p></section>
          <section className="doctor-correction-section"><h3>Clinical summary</h3>{[['chiefComplaint','Complaint'],['diagnosis','Diagnosis'],['clinicalFindings','Findings'],['plan','Plan']].map(([key,label])=><label key={key}>{label}<textarea maxLength={10000} value={summary[key]} onChange={event=>setSummary(current=>({...current,[key]:event.target.value}))}/></label>)}</section>
        </>}
        <h3>To be paid</h3>
        {voided&&<label>Correct patient and visit<select required value={targetVisit} onChange={event=>setTargetVisit(event.target.value)}><option value="">Select the correct patient visit</option>{visits.filter(visit=>!['cancelled','canceled','no_show'].includes(String(visit.status).toLowerCase())).map(visit=><option key={visit.id} value={visit.id}>{visit.pet||visit.pet_name||'Patient'} · {visit.owner||visit.owner_name||''} · {String(visit.start_time||'').slice(0,10)} · Visit #{visit.id}</option>)}</select></label>}
        <div className="doctor-billing-table-wrap"><table className="doctor-correction-table"><thead><tr><th>Charge</th><th>Quantity</th><th>Unit price (₱)</th></tr></thead><tbody>{items.map((item,index)=><tr key={item.id}><td><input required aria-label={`Charge ${index+1}`} maxLength={500} value={item.description} onChange={event=>update(index,'description',event.target.value)}/></td><td><input required aria-label={`Quantity ${index+1}`} type="number" min="0.01" max="10000" step="0.01" value={item.quantity} onChange={event=>update(index,'quantity',event.target.value)}/></td><td><input required aria-label={`Unit price ${index+1}`} type="number" min="0" max="1000000" step="0.01" value={item.unit_price} onChange={event=>update(index,'unit_price',event.target.value)}/></td></tr>)}</tbody></table></div>
        <label>Tax (₱)<input required type="number" min="0" max="1000000" step="0.01" value={tax} onChange={event=>setTax(event.target.value)}/></label><label>Correction note<textarea required maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} placeholder="Explain what was corrected for reception."/></label>
        <p style={{textAlign:'right'}}><strong>Total: ₱{total.toFixed(2)}</strong></p>
        <div className="doctor-correction-actions"><button type="button" disabled={saving} onClick={()=>voided?setEditing(false):onCancel()}>Cancel</button><button type="submit" disabled={saving}>{saving?'Sending...':voided?'Create Replacement & Send to Reception':'Save & Resend to Reception'}</button></div>
      </form>}
    </>}{error&&<p role="alert" className="doctor-billing-error">{error}</p>}
  </section>;
}
InvoiceCorrectionEditor.propTypes={invoice:PropTypes.object.isRequired,user:PropTypes.object.isRequired,onSaved:PropTypes.func.isRequired,onCancel:PropTypes.func.isRequired};
