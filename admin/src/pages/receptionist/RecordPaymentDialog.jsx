import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import LabDateTimePicker from '../../components/LabDateTimePicker';
import { invoiceBalance, invoiceNumber, paymentMethodOptions, localPaymentTime } from '../../utils/billingView';
import './recordPaymentDialog.css';

const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
export default function RecordPaymentDialog({ invoice, form, setForm, saving, error, onClose, onSubmit, user }) {
  const dialog = useRef(null);
  const supportsQr = ['qr_ph', 'gcash', 'maya', 'bank_transfer'].includes(form.method);
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  useEffect(() => {
    if (!showQr || !supportsQr) return;
    const controller = new AbortController();
    setQr(null); setQrLoading(true); setQrError('');
    const params = new URLSearchParams({ method: form.method });
    if (user.clinic_id) params.set('clinic_id', user.clinic_id);
    fetch(`${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/clinic-records/payment-qr?${params}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load payment QR.'); setQr(data); })
      .catch(failure => { if (failure.name !== 'AbortError') setQrError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setQrLoading(false); });
    return () => controller.abort();
  }, [showQr, supportsQr, form.method, user.clinic_id, user.token]);
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return createPortal(<dialog ref={dialog} className="record-payment-dialog" aria-labelledby="record-payment-title" onCancel={event => { if (saving) event.preventDefault(); else onClose(); }} onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form onSubmit={onSubmit}>
      <header><h2 id="record-payment-title">Record Payment</h2><button type="button" className="record-payment-close" aria-label="Close payment form" disabled={saving} onClick={onClose}>×</button><p>{invoiceNumber(invoice)} · {invoice.pet || 'Patient'} ({invoice.owner || 'Owner unavailable'})</p><p>Record only money that has actually been received.</p></header>
      <div className="record-payment-body">
        <section className="record-payment-totals" aria-label="Invoice payment totals">{[['Total', invoice.total], ['Paid so far', invoice.amount_paid], ['Balance', invoiceBalance(invoice)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{money(value)}</strong></div>)}</section>
        <div className="record-payment-fields">
          <label>Amount (₱) <span className="record-payment-required">*</span><input autoFocus required type="number" min="0.01" max={invoiceBalance(invoice).toFixed(2)} step="0.01" value={form.amount} onChange={event => update('amount', event.target.value)} disabled={saving} /></label>
          <label>Method <span className="record-payment-required">*</span><select required value={form.method} onChange={event => update('method', event.target.value)} disabled={saving}>{paymentMethodOptions.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
          <label>Date and time <span className="record-payment-required">*</span><LabDateTimePicker label="Payment date and time" required value={form.paidAt} max={localPaymentTime()} onChange={value => update('paidAt', value)} disabled={saving} /></label>
          <label>Reference no.<input maxLength={200} value={form.reference} onChange={event => update('reference', event.target.value)} placeholder="Optional" disabled={saving} /></label>
        </div>
        {supportsQr && <button type="button" className="record-payment-qr-toggle" aria-expanded={showQr} aria-controls="record-payment-qr" onClick={() => setShowQr(value => !value)}><span>Client wants to scan? Show payment QR</span><span aria-hidden="true">{showQr ? '−' : '›'}</span></button>}
        {supportsQr && showQr && <section id="record-payment-qr" className="record-payment-qr" aria-live="polite">{qrLoading ? <p>Loading payment QR...</p> : qrError ? <p role="alert">{qrError}</p> : qr?.configured ? <><img src={qr.image_url} alt="Clinic payment QR code" /><strong>{qr.account_name || user.clinic_name}</strong><p>Confirm receipt before recording payment.</p></> : <p>No QR has been configured for this payment method. Ask the clinic owner to add it in Financial Monitoring.</p>}</section>}
        <label className="record-payment-notes">Notes<textarea maxLength={2000} value={form.notes} onChange={event => update('notes', event.target.value)} placeholder="Add a note (optional)" disabled={saving} /></label>
        {error && <p className="record-payment-error" role="alert">{error}</p>}
      </div>
      <footer><button type="button" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="record-payment-submit" disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</button></footer>
    </form>
  </dialog>, document.body);
}
RecordPaymentDialog.propTypes = {
  invoice: PropTypes.object.isRequired, form: PropTypes.shape({ amount: PropTypes.string, method: PropTypes.string, paidAt: PropTypes.string, reference: PropTypes.string, notes: PropTypes.string }).isRequired,
  setForm: PropTypes.func.isRequired, saving: PropTypes.bool.isRequired, error: PropTypes.string,
  onClose: PropTypes.func.isRequired, onSubmit: PropTypes.func.isRequired, user: PropTypes.shape({ token: PropTypes.string, clinic_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), clinic_name: PropTypes.string }).isRequired,
};
