import { apiFetch as fetch } from '../utils/apiFetch.js';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { paymentMethodOptions } from '../utils/billingView';
import './paymentQrSettings.css';

const methods = paymentMethodOptions.filter(item => ['qr_ph', 'gcash', 'maya', 'bank_transfer'].includes(item.value));
function AddPaymentMethodDialog({ user, initialMethod, onClose, onSaved }) {
  const [method, setMethod] = useState(initialMethod);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const readFile = file => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Choose a PNG, JPEG, or WebP image under 2 MB.'); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.onerror = () => setError('Unable to read image.');
    reader.readAsDataURL(file);
  };
  const save = async event => {
    event.preventDefault();
    if (!image) { setError('Choose a QR image before saving.'); return; }
    setSaving(true); setError('');
    try {
      const endpoint = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/clinic-records/payment-qr`;
      const response = await fetch(endpoint, { method: 'PUT', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ method, image_url: image, account_name: name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save QR settings.');
      onSaved(method); onClose();
    } catch (failure) { setError(failure.message); } finally { setSaving(false); }
  };
  return <div className="payment-qr-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="payment-qr-add-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-qr-dialog-title"><header><span className="payment-qr-dialog-icon" aria-hidden="true">▦</span><div><h2 id="payment-qr-dialog-title">Manage Payment QR Codes</h2><p>Upload the clinic's payment QR from its bank or payment app for each supported method.</p></div><button type="button" className="payment-qr-dialog-close" onClick={onClose}>× <span>Close</span></button></header><form onSubmit={save}><div className="payment-qr-dialog-content"><div className="payment-qr-dialog-fields"><label>Payment method<select value={method} onChange={event => setMethod(event.target.value)}>{methods.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label>Account name<input maxLength={150} value={name} onChange={event => setName(event.target.value)} placeholder="Name shown on the payment account" /></label><label>QR image</label><label className={`payment-qr-dropzone${dragging ? ' dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files?.[0]); }}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => readFile(event.target.files?.[0])} /><span className="payment-qr-upload-icon">⇧</span><strong>{image ? 'QR image ready' : 'Drag and drop a QR image here'}</strong><span>or</span><b>Browse file</b><small>PNG, JPEG, or WebP up to 2 MB.</small>{image && <img src={image} alt="Selected QR preview" />}</label>{error && <p role="alert">{error}</p>}</div><aside className="payment-qr-dialog-preview">{image ? <><img src={image} alt="Payment QR preview" /><strong>{name || 'Account name'}</strong><small>{methods.find(item => item.value === method)?.label}</small></> : <><span className="payment-qr-empty-icon">▦</span><strong>No QR code configured for this payment method yet.</strong><p>Upload a QR image to enable this payment option for clients.</p></>}</aside></div><footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={saving || !image}>{saving ? 'Saving...' : 'Save QR Code'}</button></footer></form></section></div>;
}
export default function PaymentQrSettings({ user, hideHeading = false, standalone = false, onNavigate }) {
  const [method, setMethod] = useState('qr_ph');
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const endpoint = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/clinic-records/payment-qr`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setImage(''); setName(''); setError(''); setMessage('');
    fetch(`${endpoint}?method=${method}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load QR settings.'); if (!controller.signal.aborted) { setImage(data.image_url || ''); setName(data.account_name || ''); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, method, user.token, refreshTick]);
  const upload = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setMessage('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Choose a PNG, JPEG, or WebP image under 2 MB.'); return; }
    try {
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Unable to read image.')); reader.readAsDataURL(file); });
      await new Promise((resolve, reject) => { const preview = new Image(); preview.onload = resolve; preview.onerror = () => reject(new Error('This file is not a valid image.')); preview.src = data; });
      setImage(data);
    } catch (failure) { setError(failure.message); }
  };
  const save = async remove => {
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(endpoint, { method: 'PUT', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ method, image_url: remove ? null : image, account_name: name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save QR settings.');
      if (remove) { setImage(''); setName(''); }
      setMessage(remove ? 'Payment QR removed.' : 'Payment QR saved. Receptionists can now display it for this method.');
    } catch (failure) { setError(failure.message); } finally { setSaving(false); }
  };
  return <div className={`payment-qr-settings${standalone ? ' payment-qr-page' : ''}`}>
    {standalone && <><nav className="payment-qr-breadcrumb"><button type="button" onClick={() => onNavigate?.('financial')}>Financial Monitoring</button><span>›</span><strong>Payment QR Codes</strong></nav><header className="payment-qr-page-heading"><div><h1>Payment QR Codes</h1><p>Manage the QR codes your clinic accepts for payments.</p></div><button type="button" onClick={() => setAddDialogOpen(true)}>Add Payment Method</button></header><div className="payment-qr-tabs" role="tablist" aria-label="Payment methods">{methods.map(item => <button type="button" role="tab" aria-selected={method === item.value} className={method === item.value ? 'active' : ''} key={item.value} onClick={() => setMethod(item.value)}>{item.label}</button>)}</div></>}
    <form onSubmit={event => { event.preventDefault(); save(false); }}>
      {!hideHeading && !standalone && <><h2>Clinic payment QR codes</h2><p>Upload the clinic’s payment QR from its bank or payment app for each supported method.</p></>}
      <fieldset disabled={loading || saving}>
        {!standalone && <label>Payment method<select value={method} onChange={event => setMethod(event.target.value)}>{methods.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
        {standalone ? <div className="payment-qr-page-grid"><section className="payment-qr-preview-card"><div className="payment-qr-card-heading"><h2>{methods.find(item => item.value === method)?.label}</h2><span className={image ? 'payment-qr-status active' : 'payment-qr-status'}>{image ? '● Active' : 'Not configured'}</span></div>{image ? <img className="payment-qr-preview" src={image} alt={`${method} payment QR`} /> : <div className="payment-qr-empty">No QR image added yet.</div>}<p>Scan to pay</p><div className="payment-qr-preview-actions">{image && <a href={image} download={`${method}-payment-qr.png`}>Download QR</a>}<label>Replace QR Code<input id="payment-qr-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} /></label></div></section><section className="payment-qr-details-card"><h2>Payment Details</h2><dl><div><dt>Payment Method</dt><dd>{methods.find(item => item.value === method)?.label}</dd></div><div><dt>Account Name</dt><dd>{name || '—'}</dd></div><div><dt>Description</dt><dd>In-clinic payments</dd></div><div><dt>Last Updated</dt><dd>{image ? 'Configured' : '—'}</dd></div></dl><label>Account Name<input maxLength={150} value={name} onChange={event => setName(event.target.value)} placeholder="Name shown on the payment account" /></label><div className="payment-qr-actions"><button type="submit" disabled={!image}>{saving ? 'Saving...' : 'Save Payment Method'}</button><button type="button" disabled={!image} onClick={() => save(true)}>Remove Payment Method</button></div></section></div> : <><label>Account name<input maxLength={150} value={name} onChange={event => setName(event.target.value)} placeholder="Name shown on the payment account" /></label><label>QR image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} /></label><small>PNG, JPEG, or WebP, up to 2 MB.</small>{image ? <img className="payment-qr-preview" src={image} alt={`${methods.find(item => item.value === method)?.label} payment QR preview`} /> : <p>No QR configured for this method.</p>}<div className="payment-qr-actions"><button type="submit" disabled={!image}>{saving ? 'Saving...' : 'Save QR code'}</button><button type="button" disabled={!image} onClick={() => save(true)}>Remove QR code</button></div></>}
      </fieldset>
      {loading && <p role="status">Loading QR settings...</p>}{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </form>
    {addDialogOpen && <AddPaymentMethodDialog user={user} initialMethod={method} onClose={() => setAddDialogOpen(false)} onSaved={savedMethod => { setMethod(savedMethod); setMessage('Payment QR saved.'); setRefreshTick(value => value + 1); }} />}
  </div>;
}
PaymentQrSettings.propTypes = { user: PropTypes.object.isRequired, hideHeading: PropTypes.bool, standalone: PropTypes.bool, onNavigate: PropTypes.func };
