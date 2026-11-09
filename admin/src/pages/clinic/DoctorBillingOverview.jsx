import { dateInRange } from '../../utils/dateFilters';
import { useState } from 'react';
import PropTypes from 'prop-types';
import DateRangeFilter from '../../components/DateRangeFilter';
import { invoiceNumber, invoicePaymentStatus, invoiceBalance, invoiceCharges } from '../../utils/billingView';
import { formatDateText, formatDateTimeText } from '../../utils/dateFormatting';
import './doctorBilling.css';

const doctorBillingStatus = invoice => invoice.metadata?.void_request_status === 'pending' ? 'Void Requested' : invoice.status === 'void' ? 'Voided' : invoice.metadata?.billing_review_status === 'returned' ? 'Needs Correction' : invoice.metadata?.billing_review_status === 'issued' ? 'Issued' : invoice.metadata?.sent_to_reception ? 'Sent to Reception' : invoice.status === 'draft' ? 'Draft' : 'Issued';
const currency = value => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(value||0));
export default function DoctorBillingOverview({ invoices, loading, error, onSelect }) {
  const [search,setSearch]=useState('');
  const [tab,setTab]=useState('All');
  const [attention,setAttention]=useState('Needs Correction');
  const [from,setFrom]=useState(''),[to,setTo]=useState('');
  const inAttention=(invoice,label)=>label==='Voided'?['Voided','Void Requested'].includes(doctorBillingStatus(invoice)):doctorBillingStatus(invoice)===label;
  const attentionInvoices=invoices.filter(invoice=>inAttention(invoice,attention));
  const matches=invoice=>{
    const query=search.trim().toLowerCase();
    return (!query||[invoiceNumber(invoice),invoice.pet,invoice.owner,invoiceCharges(invoice)].some(value=>String(value||'').toLowerCase().includes(query)))&&dateInRange(invoice.issued_at,from,to);
  };
  const matchesTab=(invoice,label)=>label==='All'||(label==='Voided'?inAttention(invoice,label):label==='Paid'?invoicePaymentStatus(invoice)==='Paid'&&invoice.status!=='void':doctorBillingStatus(invoice)===label);
  const visible=invoices.filter(invoice=>matches(invoice)&&matchesTab(invoice,tab));
  return <div className="doctor-billing-overview">
    <section className="doctor-billing-attention"><h2>Billing</h2><p>View and manage patient bills, track payments, and monitor invoice processing.</p>
      <div className="doctor-billing-attention-tabs">{['Needs Correction','Voided'].map(label=><button key={label} type="button" aria-pressed={attention===label} className={attention===label?'active':''} onClick={()=>setAttention(label)}>{label} ({invoices.filter(invoice=>inAttention(invoice,label)).length})</button>)}</div>
      <div className="doctor-billing-attention-list">{loading?<p>Loading review requests...</p>:attentionInvoices.length?attentionInvoices.map(invoice=>{
        const last=[...(invoice.metadata?.billing_activity||[])].reverse().find(entry=>entry.action===(attention==='Voided'?'void':'return'));
        return <button type="button" key={invoice.id} onClick={()=>onSelect(invoice.id)} className="doctor-billing-attention-row"><span><strong>{invoiceNumber(invoice)}</strong><small>{invoice.pet||'Patient'} · {invoice.owner||'Owner unavailable'}</small></span><span><strong>Reason: {invoice.metadata?.billing_review_reason||'No reason recorded'}</strong><small>{attention==='Voided'?(invoice.metadata?.void_request_status==='pending'?'Requested':'Voided'):'Returned'} by: {last?.actor||'Receptionist'}{(last?.at||invoice.metadata?.billing_reviewed_at)&&` · ${formatDateTimeText(last?.at||invoice.metadata.billing_reviewed_at,undefined,'')}`}</small></span><span className={'doctor-billing-badge '+(attention==='Voided'?'voided':'needs-correction')}>{doctorBillingStatus(invoice)}</span><span aria-hidden="true">›</span></button>;
      }):<p className="doctor-billing-empty">{attention==='Voided'?'No voided bills.':'No bills need correction.'}</p>}</div>
    </section>
    <section className="doctor-billing-records"><div className="doctor-billing-toolbar"><input type="search" aria-label="Search doctor billing" placeholder="Search invoice, patient, owner, or service..." value={search} onChange={event=>setSearch(event.target.value)}/><DateRangeFilter label="Filter billing dates" dateFrom={from} dateTo={to} onDateFromChange={setFrom} onDateToChange={setTo}/></div>
      <nav className="doctor-billing-pills" aria-label="Billing status filters">{['All','Needs Correction','Sent to Reception','Issued','Paid','Voided'].map(label=><button key={label} type="button" aria-pressed={tab===label} className={tab===label?'active':''} onClick={()=>setTab(label)}>{label}<b>{invoices.filter(invoice=>matches(invoice)&&matchesTab(invoice,label)).length}</b></button>)}</nav>
      {error&&<p className="doctor-billing-error" role="alert">{error}</p>}
      <div className="doctor-billing-table-wrap"><table className="doctor-billing-table"><thead><tr>{['Invoice','Patient','Owner','Date','Amount','Paid','Balance','Billing Status','Payment Status',''].map(label=><th key={label} aria-label={label||'Open invoice'}>{label}</th>)}</tr></thead><tbody>{loading?<tr><td colSpan="10" className="doctor-billing-empty">Loading billing records...</td></tr>:visible.length?visible.map(invoice=>{
        const status=doctorBillingStatus(invoice),payment=invoicePaymentStatus(invoice);
        return <tr key={invoice.id} tabIndex={0} aria-label={`Open ${invoiceNumber(invoice)}`} onClick={()=>onSelect(invoice.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(invoice.id);}}}><td><strong>{invoiceNumber(invoice)}</strong></td><td>{invoice.pet||'—'}</td><td>{invoice.owner||'—'}</td><td>{formatDateText(invoice.issued_at,undefined,'—')}</td><td>{currency(invoice.total)}</td><td>{currency(invoice.amount_paid)}</td><td>{currency(invoiceBalance(invoice))}</td><td><span className={'doctor-billing-badge '+status.toLowerCase().replaceAll(' ','-')}>{status}</span></td><td>{invoice.status==='void'?'—':<span className={'doctor-billing-badge payment-'+payment.toLowerCase().replaceAll(' ','-')}>{payment}</span>}</td><td aria-hidden="true">›</td></tr>;
      }):<tr><td colSpan="10" className="doctor-billing-empty">No invoices match these filters.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
DoctorBillingOverview.propTypes={invoices:PropTypes.array.isRequired,loading:PropTypes.bool,error:PropTypes.string,onSelect:PropTypes.func.isRequired};
