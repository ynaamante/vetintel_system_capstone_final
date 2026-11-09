import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { invoiceBalance, invoiceNumber, invoicePaymentStatus, isBillingQueueInvoice } from '../../utils/billingView';
import { formatDateText, formatDateTimeText } from '../../utils/dateFormatting';
import ClinicAttachmentImage from '../../components/ClinicAttachmentImage';
import './invoiceReviewPanel.css';
import { notifySuccess } from '../../utils/notifications';

const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
const date = value => formatDateText(value, undefined, 'Not set');

function patientAge(value) {
  if (!value) return '';
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return '';
  const today = new Date();
  let months = (today.getFullYear() - birthDate.getFullYear()) * 12 + today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) months -= 1;
  if (months < 1) return '';
  return months < 12 ? `${months} mo` : `${Math.floor(months / 12)} yr${Math.floor(months / 12) === 1 ? '' : 's'}`;
}

function visitType(invoice) {
  const itemType = invoice.items?.[0]?.item_type;
  if (itemType === 'lab_test') return 'Laboratory';
  const typeNames = {
    consultation: 'Check-up', treatment: 'Treatment', medication: 'Treatment',
    vaccination: 'Vaccination', inpatient: 'Confinement',
  };
  return typeNames[itemType] || String(invoice.appointment_type || invoice.appointment_reason || 'Visit')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

export default function InvoiceReviewPanel({ invoice, invoices, payments, user, onClose, onUpdate, onPayment, onDownload }) {
  const panel = useRef(null);
  const [pending, setPending] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [voidReasons, setVoidReasons] = useState([]);
  const [voidCode, setVoidCode] = useState('');
  const [voidConfirmed, setVoidConfirmed] = useState(false);
  const [noCharges, setNoCharges] = useState(false);
  const [relatedInvoiceId, setRelatedInvoiceId] = useState('');
  const voidPolicy = voidReasons.find(option => option.code === voidCode);
  useEffect(() => {
    if (pending !== 'void') return;
    const controller = new AbortController();
    fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '')}/clinic-records/billing-review-options`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal })
      .then(async response => { const payload = await response.json(); if (!response.ok || !Array.isArray(payload.void_reasons)) throw new Error('Unable to load invoice void reasons.'); setVoidReasons(payload.void_reasons); })
      .catch(failure => { if (failure.name !== 'AbortError') setError('Unable to load void reasons. Check that the backend is running the latest version.'); });
    return () => controller.abort();
  }, [pending, user.token]);
  const [attachmentError, setAttachmentError] = useState('');
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(''), 4500);
    return () => window.clearTimeout(timer);
  }, [success]);
  useEffect(() => {
    const element = panel.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  const metadata = invoice.metadata || {};
  const status = invoicePaymentStatus(invoice);
  const invoicePayments = payments.filter(payment => String(payment.invoice_id) === String(invoice.id));
  const paidAmount = invoicePayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const consultationNotes = invoice.consultation_notes && typeof invoice.consultation_notes === 'object'
    ? invoice.consultation_notes : {};
  const summaryRows = [
    ['Complaint', consultationNotes.chiefComplaint || invoice.appointment_reason || invoice.lab_indication],
    ['Diagnosis', consultationNotes.diagnosis],
    ['Findings', consultationNotes.clinicalFindings],
    ['Plan', consultationNotes.plan || consultationNotes.followUpInstructions],
  ].map(([label, value]) => [label, String(value || '').trim() || 'Not recorded']);
  const petWeight = invoice.pet_weight
    ? (/\b(kg|g|lb|lbs)\b/i.test(String(invoice.pet_weight)) ? String(invoice.pet_weight) : `${invoice.pet_weight} kg`)
    : '';
  const patientDetails = [invoice.species, invoice.breed, patientAge(invoice.birth_date), petWeight].filter(Boolean).join(' · ');
  const otherBalances = invoices.filter(row => String(row.id) !== String(invoice.id)
    && (String(row.pet_id || '') === String(invoice.pet_id || '') || row.pet && row.pet === invoice.pet)
    && invoiceBalance(row) > 0
    && !['void', 'cancelled', 'canceled'].includes(String(row.status || '').toLowerCase()));
  const visitStatus = invoice.appointment_status || invoice.lab_status || 'Completed';
  const history = [
    ...((invoice.created_at || invoice.issued_at) ? [{ label: 'Bill created by doctor', actor: invoice.doctor, at: invoice.created_at || invoice.issued_at }] : []),
    ...(metadata.sent_to_reception_at ? [{ label: 'Bill sent to receptionist', actor: invoice.doctor, at: metadata.sent_to_reception_at }] : []),
    ...(Array.isArray(metadata.billing_activity) ? metadata.billing_activity : []),
    ...invoicePayments.map(payment => ({ label: `Payment recorded: ${money(payment.amount)}`, actor: payment.method, at: payment.paid_at })),
  ].sort((first, second) => new Date(first.at).getTime() - new Date(second.at).getTime());
  const downloadAttachment = async attachment => {
    if (!attachment?.downloadEndpoint || !user?.token) return;
    setDownloadingAttachmentId(attachment.id);
    setAttachmentError('');
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const query = user.clinic_id ? `?clinic_id=${encodeURIComponent(user.clinic_id)}` : '';
      const response = await fetch(`${apiUrl}${attachment.downloadEndpoint}${query}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to download this visit attachment.');
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.filename || 'visit-attachment';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setAttachmentError(downloadError.message || 'Unable to download this visit attachment.');
    } finally {
      setDownloadingAttachmentId(null);
    }
  };
  const voidPending = metadata.void_request_status === 'pending';
  const canReview = isBillingQueueInvoice(invoice) && Number(invoice.amount_paid || 0) === 0;
  const canIssue = canReview && !['issued', 'returned'].includes(metadata.billing_review_status);
  const review = async action => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      const params = new URLSearchParams();
      if (user.clinic_id) params.set('clinic_id', user.clinic_id);
      const response = await fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '')}/clinic-records/invoices/${invoice.id}/review?${params}`, {
        method: 'POST', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason, ...(action === 'void' ? { reason_code: voidCode, can_be_corrected: !voidConfirmed, entire_invoice_invalid: voidConfirmed, no_charges_owed: noCharges, related_invoice_id: relatedInvoiceId || undefined } : {}) }),
      });
      const payload = await response.json().catch(() => null);
      if (!payload) throw new Error(response.status === 404 ? 'The billing review endpoint is unavailable. Restart the backend server to load the latest billing routes, then try again.' : 'The billing server returned an unexpected response. Please try again.');
      if (!response.ok) throw new Error(payload.error || 'Unable to update invoice.');
      onUpdate({ ...invoice, ...payload });
      if (action === 'void') {setSuccess('Void request sent to the doctor for approval.');notifySuccess('Void request sent to doctor');}
      if (action === 'issue') {
        const message = `${invoiceNumber(invoice)} issued. It is now open for payment.`;
        setSuccess(message);
      }
      setPending(''); setReason('');
      window.dispatchEvent(new Event('vetintel:billing-updated'));
    } catch (failure) { setError(failure.message); } finally { setSaving(false); }
  };
  return createPortal(<dialog ref={panel} className="invoice-review-panel" aria-labelledby="invoice-review-title" onCancel={event => { if (saving) event.preventDefault(); else onClose(); }} onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <div className="invoice-review-shell">
      {success && <div className="invoice-review-toast" role="status"><span aria-hidden="true">✓</span>{success}</div>}
      <header className="invoice-review-header">
        <div className="invoice-review-title-row"><h2 id="invoice-review-title">{invoice.items?.[0]?.description || invoiceNumber(invoice)}</h2></div>
        <button type="button" className="invoice-review-close" aria-label="Close invoice panel" disabled={saving} onClick={onClose}>×</button>
        <p>{date(invoice.consultation_completed_at || invoice.visit_date || invoice.issued_at)} <span className={`invoice-review-payment ${status.toLowerCase().replaceAll(' ', '-')}`}>In Billing · {status}</span></p>
      </header>
      <div className="invoice-review-body">
        <section className="invoice-doctor-section">
          <h3>Visit details</h3>
          <div className="invoice-doctor-details">
            <div className="invoice-doctor-patient">
              <ClinicAttachmentImage
                attachmentId={invoice.pet_photo_attachment_id}
                user={user}
                alt=""
                className="invoice-doctor-pet-photo"
                fallback={<span className="invoice-doctor-pet-fallback">{String(invoice.pet || 'P').slice(0, 1).toUpperCase()}</span>}
              />
              <div><small>Patient</small><strong>{invoice.pet || '—'}</strong><span>{patientDetails || 'Details not recorded'}</span></div>
            </div>
            <div><small>Owner</small><strong>{invoice.owner || '—'}</strong><span>{invoice.owner_phone || 'Contact not recorded'}</span></div>
            <div><small>Attending veterinarian</small><strong>{invoice.doctor || 'Not recorded'}</strong></div>
            <div><small>Appointment type</small><strong>{visitType(invoice)}</strong></div>
            <div><small>Visit date</small><strong>{date(invoice.visit_date || invoice.consultation_completed_at || invoice.issued_at)}</strong></div>
            <div><small>Visit status</small><strong>{String(visitStatus).replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase())}</strong></div>
          </div>
        </section>
        <section className="invoice-doctor-section">
          <h3>Clinical summary</h3>
          <div className="invoice-doctor-summary">{summaryRows.map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value}</span></div>)}</div>
        </section>
        <section className="invoice-doctor-section">
          <h3>To be paid</h3>
          <div className="invoice-review-table-wrap"><table className="invoice-review-items invoice-doctor-items"><thead><tr>{['Description', 'Type', 'Qty', 'Unit price', 'Amount'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
            {(invoice.items || []).map((item, index) => <tr key={item.id || index}><td>{item.description || 'Service'}</td><td>{({ consultation: 'Service', treatment: 'Treatment', medication: 'Medication', vaccination: 'Vaccine', lab_test: 'Laboratory Test', inpatient: 'Inpatient' })[item.item_type] || item.item_type || 'Service'}</td><td>{item.quantity}</td><td>{money(item.unit_price)}</td><td>{money(item.line_total)}</td></tr>)}
            {!invoice.items?.length && <tr><td colSpan="5">No itemized charges available.</td></tr>}
          </tbody><tfoot><tr><th colSpan="4">Total</th><th>{money(invoice.total)}</th></tr></tfoot></table></div>
          <div className="invoice-doctor-paid"><span>Paid: {money(paidAmount)}</span><strong>Balance due: {money(invoiceBalance({ ...invoice, amount_paid: paidAmount }))}</strong></div>
        </section>
        <section className="invoice-doctor-section invoice-doctor-balances">
          <h3>Outstanding balances</h3>
          {otherBalances.length ? otherBalances.map(row => <div key={row.id}><span>#{row.id} · {row.items?.[0]?.description || 'Previous invoice'} · {date(row.issued_at)}</span><strong>{money(invoiceBalance(row))}</strong></div>) : <p>No other unpaid invoices for this patient.</p>}
        </section>
        <section className="invoice-doctor-section">
          <h3>Attachments</h3>
          {invoice.attachments?.length ? <div className="invoice-doctor-attachments">{invoice.attachments.map(attachment => <button key={attachment.id} type="button" disabled={downloadingAttachmentId === attachment.id} onClick={() => downloadAttachment(attachment)}>
            <span><strong>{attachment.filename || 'Visit attachment'}</strong><small>{String(attachment.content_type || '').split('/').pop()?.toUpperCase() || 'FILE'}{attachment.uploaded_at ? ` · ${date(attachment.uploaded_at)}` : ''}</small></span><b>{downloadingAttachmentId === attachment.id ? '…' : '↓'}</b>
          </button>)}</div> : <p className="invoice-review-note">No files are attached to this visit.</p>}
          {attachmentError && <p role="alert" className="invoice-review-error">{attachmentError}</p>}
        </section>
        <section className="invoice-review-owner-communication">
          <h3>Owner Communication</h3>
          <div>{[['Consultation Summary', 'consultation_summary'], ['Billing Summary', 'billing_summary'], ['Payment Notice', 'payment_notice']].map(([label, key]) => {
            const delivery = metadata.owner_communication?.[key];
            return <div key={key}><strong>{label}</strong><span>{delivery?.status || (delivery?.sent_at ? 'Sent' : 'Not Sent')}</span></div>;
          })}</div>
          <p>Delivery is tracked separately from payment. Sending a notice never marks an invoice paid.</p>
        </section>
        <section className="invoice-review-activity">
          <h3>Activity History</h3>
          {history.length ? <ol>{history.map((entry, index) => <li key={`${entry.label}-${entry.at || index}`}><strong>{entry.label}</strong><span>{entry.actor ? `${entry.actor} · ` : ''}{formatDateTimeText(entry.at, undefined, '')}</span>{entry.reason && <p>{entry.reason}</p>}</li>)}</ol> : <p>No recorded activity available.</p>}
        </section>
        {metadata.void_request_status && <section className="invoice-review-note" role="status"><strong>{voidPending?'Void request awaiting doctor approval':metadata.void_request_status==='approved'?'Void approved by doctor':'Void rejected by doctor'}</strong><p>{voidPending ? 'Payment and review actions are on hold until the doctor approves or rejects this request.' : metadata.void_decision_reason || (metadata.void_request_status==='approved'?'This invoice is void.':'This invoice is back in billing.')}</p></section>}
        {metadata.billing_review_status === 'returned' && <p className="invoice-review-note">Returned for correction: {metadata.billing_review_reason}</p>}
        {pending && <form id="invoice-review-reason" className="invoice-review-reason" onSubmit={event => { event.preventDefault(); review(pending); }}>
          {pending === 'void' && <>
            <p>Use Request Correction for wrong charges, prices, quantities, or an affected item. Void only when the entire invoice is invalid.</p>
            <button type="button" onClick={() => { setPending('return'); setError(''); }}>Request Correction Instead</button>
            <label htmlFor="invoice-void-category">Void reason</label><select id="invoice-void-category" required value={voidCode} onChange={event => { setVoidCode(event.target.value); setVoidConfirmed(false); setNoCharges(false); setRelatedInvoiceId(''); }}><option value="">Select a reason</option>{voidReasons.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}</select>
            {voidPolicy && <p>{voidPolicy.guidance}</p>}
            {voidPolicy?.relatedInvoice && <label>{voidCode === 'duplicate_invoice' ? 'Correct invoice to retain' : 'Existing replacement invoice'}<select required value={relatedInvoiceId} onChange={event => setRelatedInvoiceId(event.target.value)}><option value="">Select invoice</option>{invoices.filter(row => String(row.id) !== String(invoice.id) && row.status !== 'void' && row.metadata?.billing_review_status !== 'returned').map(row => <option key={row.id} value={row.id}>{invoiceNumber(row)} · {row.pet || 'Patient'} · {row.owner || 'Owner'}</option>)}</select></label>}
            <label className="invoice-void-confirm"><input required type="checkbox" checked={voidConfirmed} onChange={event => setVoidConfirmed(event.target.checked)} />The entire invoice is invalid and cannot be corrected.</label>
            {voidPolicy?.noCharges && <label className="invoice-void-confirm"><input required type="checkbox" checked={noCharges} onChange={event => setNoCharges(event.target.checked)} />No billable services occurred and no legitimate charges are owed.</label>}
          </>}
          <label htmlFor="invoice-review-reason-input">{pending === 'void' ? 'Reason details' : 'Correction requested'}</label><textarea id="invoice-review-reason-input" required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} autoFocus /><button type="button" disabled={saving} onClick={() => { setPending(''); setReason(''); }}>Cancel</button>
        </form>}
        {error && <p role="alert" className="invoice-review-error">{error}</p>}
      </div>
      <footer className="invoice-review-footer">
        {pending ? <button type="submit" form="invoice-review-reason" className={pending === 'void' ? 'invoice-review-danger' : 'invoice-review-warning'} disabled={saving}>{saving ? 'Saving...' : pending === 'void' ? 'Send Void Request' : 'Return for Correction'}</button> : <>
          {canReview && <><button type="button" className="invoice-review-danger" disabled={saving} onClick={() => setPending('void')}>Request Void</button><button type="button" className="invoice-review-warning" disabled={saving} onClick={() => setPending('return')}>Return for Correction</button></>}
          {canIssue ? <button type="button" className="invoice-review-primary" disabled={saving} onClick={() => review('issue')}>{saving ? 'Issuing...' : 'Issue Invoice'}</button> : !voidPending && status !== 'Void' && invoiceBalance(invoice) > 0 && metadata.billing_review_status !== 'returned' ? <button type="button" className="invoice-review-primary" disabled={saving} onClick={onPayment}>Record Payment</button> : <button type="button" disabled={saving} onClick={onDownload}>Download Invoice / Receipt</button>}
        </>}
      </footer>
    </div>
  </dialog>, document.body);
}

InvoiceReviewPanel.propTypes = {
  invoice: PropTypes.object.isRequired, invoices: PropTypes.array.isRequired, payments: PropTypes.array.isRequired, user: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired, onUpdate: PropTypes.func.isRequired, onPayment: PropTypes.func.isRequired, onDownload: PropTypes.func.isRequired,
};
