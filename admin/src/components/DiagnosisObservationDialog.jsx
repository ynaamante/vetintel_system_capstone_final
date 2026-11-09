import { useEffect, useRef, useState } from 'react';

const localTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export default function DiagnosisObservationDialog({ user, patientId, diagnosisId, patientName, onClose, onSaved }) {
  const ref = useRef(null);
  const [form, setForm] = useState({ observed_at: localTime(), notes: '', temperature: '', heart_rate: '', respiratory_rate: '', weight: '', body_condition: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus();
  }, []);
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return <dialog ref={ref} className="diagnosis-observation-dialog" aria-labelledby="diagnosis-observation-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><form onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const { observed_at, notes, ...vitals } = form;
      const response = await fetch(`${api}/clinic-records/pets/${patientId}/diagnoses/${diagnosisId}/observations`, {
        method: 'POST', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ observed_at: new Date(observed_at).toISOString(), notes, vitals }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Unable to save observation.');
      onSaved(data);
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }}><header><h2 id="diagnosis-observation-title">Add Observation</h2><p>Record clinical monitoring for {patientName}.</p></header>{error && <p role="alert">{error}</p>}<fieldset disabled={busy}><label>Observation Date / Time *<input required type="datetime-local" max={localTime()} value={form.observed_at} onChange={event => change('observed_at', event.target.value)} /></label><div className="diagnosis-observation-grid">{[['temperature', 'Temperature (°C)', 60], ['heart_rate', 'Heart Rate (bpm)', 500], ['respiratory_rate', 'Respiratory Rate (rpm)', 300], ['weight', 'Weight (kg)', 1500]].map(([key, label, max]) => <label key={key}>{label}<input type="number" min="0" max={max} step={key === 'weight' || key === 'temperature' ? '.01' : '1'} value={form[key]} onChange={event => change(key, event.target.value)} /></label>)}<label>Body Condition<select value={form.body_condition} onChange={event => change('body_condition', event.target.value)}><option value="">Not recorded</option>{['Underweight', 'Ideal', 'Overweight', 'Obese'].map(value => <option key={value}>{value}</option>)}</select></label></div><label>Clinical Notes *<textarea required maxLength={5000} rows="4" value={form.notes} onChange={event => change('notes', event.target.value)} /></label></fieldset><footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="is-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Observation'}</button></footer></form></dialog>;
}
