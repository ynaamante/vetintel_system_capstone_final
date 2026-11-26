import { apiFetch as fetch } from '../utils/apiFetch.js';
import { useState } from 'react';
import options from '../../../data/intakeScreening.json';
import rules from '../../../data/intakeScreeningRules.json';
import { announceRegistrationUpdate } from '../utils/registrationSync';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

export default function IntakeScreeningReview({ intake, user }) {
  const saved = intake.screening;
  const [triage, setTriage] = useState(saved?.effective?.triage_priority || 'not_assessed');
  const [infection, setInfection] = useState(saved?.effective?.infection_risk || 'not_assessed');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const labels = (values, list) => (values || []).map(value => list.find(([id]) => id === value)?.[1] || value).join(', ') || 'Not reported';
  const label = (kind, value) => options[kind].find(item => item.value === value)?.label || 'Not assessed';

  const saveReview = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${api}/clinic-records/registration-intakes/${intake.registrationIntakeId}/screening`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ triage_priority: triage, infection_risk: infection, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save screening review.');
      setSuccess('Screening review saved.');
      announceRegistrationUpdate();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="intake-review-card">
      <header className="intake-review-card-heading">
        <h3>Structured Screening / Veterinary Review</h3>
      </header>
      <div className="intake-review-card-body">
        <div className="intake-review-facts">
          <div><strong>Reported symptoms</strong><span>{labels(saved?.inputs?.symptoms, rules.symptoms)}{saved?.inputs?.other_symptom && ` — ${saved.inputs.other_symptom}`}</span></div>
          <div><strong>Reported exposure</strong><span>{labels(saved?.inputs?.exposures, rules.exposures)}</span></div>
          <div><strong>Routine visit</strong><span>{saved?.inputs?.routine_visit ? 'Yes' : 'Not selected'}</span></div>
          <div><strong>Suggested screening</strong><span>{label('triage', saved?.suggested?.triage_priority)} / {label('infection', saved?.suggested?.infection_risk)}</span></div>
        </div>
        <p className="intake-review-rule-note">{saved?.review ? `Veterinarian reviewed${saved.review.overridden ? ' / overridden' : ''} ${new Date(saved.review.reviewed_at).toLocaleString()}${saved.review.note ? ` · ${saved.review.note}` : ''}. ` : ''}Rule version: {saved?.rule_version || 'No structured screening recorded'}. Illustrative rules; not clinically validated.</p>
        {['Needs review', 'Approved'].includes(intake.status) && (
          <form className="intake-review-form" onSubmit={saveReview}>
            <label>Triage Priority
              <select value={triage} onChange={event => setTriage(event.target.value)} disabled={busy}>
                {options.triage.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>Infection Risk
              <select value={infection} onChange={event => setInfection(event.target.value)} disabled={busy}>
                {options.infection.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="intake-review-note">Review Notes <span>Additional findings, observations, and recommendations.</span>
              <textarea rows={2} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} disabled={busy} placeholder="Add review notes..." />
            </label>
            {error && <p className="intake-review-message is-error" role="alert">{error}</p>}
            {success && <p className="intake-review-message" role="status">{success}</p>}
            <button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Confirm / Override Screening'}</button>
          </form>
        )}
        <p className="intake-review-disclaimer">Screening indicators describe urgency and precautions; a diagnosis is recorded separately.</p>
      </div>
    </section>
  );
}
