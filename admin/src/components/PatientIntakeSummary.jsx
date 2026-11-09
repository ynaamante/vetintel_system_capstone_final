import PatientIntakeSummaryDialog from './PatientIntakeSummaryDialog';
import { useEffect, useState } from 'react';
import indicators from '../../../data/intakeScreening.json';
import { formatDateTimeText } from '../utils/dateFormatting';
import { watchRegistrationUpdates } from '../utils/registrationSync';
import { Icons } from '../icons';
import './patientIntakeSummary.css';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
function Indicator({ kind, value }) {
  const item = indicators[kind].find(option => option.value === value);
  return <span className={`patient-intake-indicator is-${item?.tone || 'unassessed'}`} title={item?.meaning || 'Insufficient information for screening'}>{item?.label || 'Not assessed'}</span>;
}

export default function PatientIntakeSummary({ patientId, user, onDiagnosis }) {
  const [open,setOpen]=useState(false);
  const [intake, setIntake] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let active = true, refreshing = false;
    setOpen(false); setIntake(null); setError(''); setLoading(Boolean(patientId));
    if (!patientId) return () => controller.abort();
    const load = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(`${api}/clinic-records/pets/${encodeURIComponent(patientId)}/intake-summary`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Unable to load patient intake summary.');
        if (active) { setIntake(data.intake); setError(''); }
      } catch (error) { if (active && error.name !== 'AbortError') setError(error.message); }
      finally { refreshing = false; if (active) setLoading(false); }
    };
    load(); const stop = watchRegistrationUpdates(load);
    return () => { active = false; controller.abort(); stop(); };
  }, [patientId, user.token, user.clinic_id]);
  const code = intake ? `INT-${String(intake.id).padStart(3, '0')}` : '';
  const screening = intake?.screening;
  return <section className="detail-panel patient-intake-summary">
    <header><h2>Patient Intake Summary</h2>{intake && <span className="patient-intake-origin">From Patient Intake ({code})</span>}</header>
    {loading ? <p className="detail-summary-note" role="status">Loading patient intake summary...</p> : error ? <p className="detail-summary-note" role="alert">{error}</p> : !intake ? <p className="detail-summary-note">No approved patient intake is linked to this patient.</p> : <div className="patient-intake-card-content">
      <button type="button" className="patient-intake-card-trigger" aria-haspopup="dialog" onClick={()=>setOpen(true)} aria-label={`View patient intake ${code} details`}>
        <span className="patient-intake-file" aria-hidden="true">{Icons.file}</span>
        <span className="patient-intake-submission"><strong>Patient Intake - {code}</strong><small>Submitted {formatDateTimeText(intake.submitted_at || intake.created_at)}</small></span>
        <span className="patient-intake-metric"><small>Triage</small><Indicator kind="triage" value={screening?.effective?.triage_priority}/></span>
        <span className="patient-intake-metric"><small>Infection Risk</small><Indicator kind="infection" value={screening?.effective?.infection_risk}/></span>
        <span className="patient-intake-chevron" aria-hidden="true">{Icons.chevronRight}</span>
      </button>
    </div>}
    {open&&intake&&<PatientIntakeSummaryDialog intake={intake} user={user} onClose={()=>setOpen(false)} onDiagnosis={onDiagnosis}/>}
  </section>;
}
