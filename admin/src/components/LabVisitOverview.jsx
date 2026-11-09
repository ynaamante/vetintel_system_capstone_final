import { useEffect, useState } from 'react';
import { formatDateText } from '../utils/dateFormatting';
import { watchRegistrationUpdates } from '../utils/registrationSync';
import screeningOptions from '../../../data/intakeScreening.json';
import { Icons } from '../icons';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

export default function LabVisitOverview({ patientId, user }) {
  const [state, setState] = useState({ patientId: null, intake: null, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    let active = true, refreshing = false;
    setState({ patientId, intake: null, loading: Boolean(patientId), error: '' });
    if (!patientId || !user?.token) return () => controller.abort();
    const load = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(`${api}/clinic-records/pets/${encodeURIComponent(patientId)}/intake-summary`, {
          headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw Error(payload.error || 'Unable to load patient intake.');
        if (active) setState({ patientId, intake: payload.intake, loading: false, error: '' });
      } catch (error) {
        if (active && error.name !== 'AbortError') setState({ patientId, intake: null, loading: false, error: error.message });
      } finally { refreshing = false; }
    };
    load();
    const stop = watchRegistrationUpdates(load);
    return () => { active = false; controller.abort(); stop(); };
  }, [patientId, user?.token, user?.clinic_id]);
  const current = String(state.patientId) === String(patientId);
  const intake = current ? state.intake : null;
  const triage = screeningOptions.triage.find(option => option.value === intake?.screening?.effective?.triage_priority);
  const date = intake?.submitted_at || intake?.created_at;
  return <section className="lab-visit-overview">
    <h4>Visit Overview</h4>
    {!current || state.loading ? <p role="status">Loading patient intake...</p>
      : state.error ? <p role="alert">{state.error}</p>
        : !intake ? <p>No approved patient intake is linked to this patient.</p>
          : <><div className="lab-visit-metrics">
            <div>{Icons.calendar}<span><small>Intake Date</small><strong>{date ? formatDateText(date) : 'Not recorded'}</strong></span></div>
            <div>{Icons.stethoscope}<span><small>Reason for Visit</small><strong>{intake.reason_for_visit || 'Not recorded'}</strong></span></div>
            <div>{Icons.alert || Icons.info}<span><small>Triage Priority</small><strong className={`lab-visit-triage is-${triage?.tone || 'unassessed'}`}>{triage?.label || 'Not assessed'}</strong></span></div>
          </div><small className="lab-visit-source">From Patient Intake INT-{String(intake.id).padStart(3, '0')}</small></>}
  </section>;
}
