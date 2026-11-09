import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { paymentMethodOptions } from '../utils/billingView';
import './paymentQrSettings.css';

const methods = paymentMethodOptions.filter(item => ['qr_ph', 'gcash', 'maya', 'bank_transfer'].includes(item.value));
export default function PaymentQrSettings({ user }) {
  const [method, setMethod] = useState('qr_ph');
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const endpoint = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/clinic-records/payment-qr`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setImage(''); setName(''); setError(''); setMessage('');
    fetch(`${endpoint}?method=${method}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load QR settings.'); if (!controller.signal.aborted) { setImage(data.image_url || ''); setName(data.account_name || ''); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, method, user.token]);
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
  return <div className="payment-qr-settings">
    <form onSubmit={event => { event.preventDefault(); save(false); }}>
      <h2>Clinic payment QR codes</h2><p>Upload the clinic’s payment QR from its bank or payment app for each supported method.</p>
      <fieldset disabled={loading || saving}><label>Payment method<select value={method} onChange={event => setMethod(event.target.value)}>{methods.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Account name<input maxLength={150} value={name} onChange={event => setName(event.target.value)} placeholder="Name shown on the payment account" /></label>
        <label>QR image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} /></label><small>PNG, JPEG, or WebP, up to 2 MB.</small>
        {image ? <img className="payment-qr-preview" src={image} alt={`${methods.find(item => item.value === method)?.label} payment QR preview`} /> : <p>No QR configured for this method.</p>}
        <div className="payment-qr-actions"><button type="submit" disabled={!image}>{saving ? 'Saving...' : 'Save QR code'}</button><button type="button" disabled={!image} onClick={() => save(true)}>Remove QR code</button></div>
      </fieldset>
      {loading && <p role="status">Loading QR settings...</p>}{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </form>
  </div>;
}
PaymentQrSettings.propTypes = { user: PropTypes.object.isRequired };
