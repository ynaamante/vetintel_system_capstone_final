import { useState } from 'react';
import PropTypes from 'prop-types';
import { notifySuccess } from '../../utils/notifications';

export default function InvoiceVoidDecision({ invoice, user, onSaved }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const metadata = invoice.metadata || {};
  const pending = metadata.void_request_status === 'pending' || (invoice.status === 'void' && !metadata.void_request_status);
  const decide = async decision => {
    if (saving) return;
    if (decision === 'reject' && !note.trim()) { setError('Enter a reason for rejecting the void request.'); return; }
    setSaving(decision); setError('');
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/invoices/${invoice.id}/void-decision`, {
        method: 'POST', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: note.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to save the void decision.');
      onSaved(payload);
      notifySuccess(decision === 'approve' ? 'Void request approved' : 'Void request rejected');
      window.dispatchEvent(new Event('vetintel:billing-updated'));
    } catch (failure) { setError(failure.message); } finally { setSaving(''); }
  };
  if (!pending) return null;
  return <footer className="billing-invoice-send-footer doctor-void-footer">
    {rejecting && <form id="invoice-void-rejection" onSubmit={event=>{event.preventDefault();decide('reject');}}>
      <label htmlFor="invoice-void-rejection-reason">Reason for rejection</label>
      <textarea id="invoice-void-rejection-reason" rows={2} required maxLength={1000} disabled={Boolean(saving)} value={note} onChange={event=>setNote(event.target.value)} autoFocus />
    </form>}
    {error && <p className="doctor-billing-error" role="alert">{error}</p>}
    <div className="doctor-void-actions">
      {rejecting ? <><button type="button" disabled={Boolean(saving)} onClick={()=>{setRejecting(false);setError('');}}>Cancel</button><button type="submit" form="invoice-void-rejection" disabled={Boolean(saving)}>{saving==='reject'?'Rejecting...':'Reject Request'}</button></> : <><button type="button" disabled={Boolean(saving)} onClick={()=>setRejecting(true)}>Reject Request</button><button type="button" className="billing-invoice-send-button" disabled={Boolean(saving)} onClick={()=>decide('approve')}>{saving==='approve'?'Approving...':'Approve Void'}</button></>}
    </div>
  </footer>;
}
InvoiceVoidDecision.propTypes = { invoice: PropTypes.object.isRequired, user: PropTypes.object.isRequired, onSaved: PropTypes.func.isRequired };
