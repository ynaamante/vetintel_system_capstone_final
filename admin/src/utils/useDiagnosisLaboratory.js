import { useEffect, useState } from 'react';
import { linkedDiagnosisLabs, laboratoryResultText } from './diagnosisLaboratory';
const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
export default function useDiagnosisLaboratory({ patientId, diagnosisId, user, refreshKey }) {
  const [state, setState] = useState({ text: 'Loading linked laboratory results...', error: '', labs: [] });
  useEffect(() => {
    if (!diagnosisId) { setState({ text: laboratoryResultText([]), error: '', labs: [] }); return; }
    const controller = new AbortController();
    let refreshing = false;
    setState({ text: 'Loading linked laboratory results...', error: '', labs: [] });
    const load = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(api + '/clinic-records/lab-tests?clinic_id=' + encodeURIComponent(user.clinic_id) + '&pet_id=' + encodeURIComponent(patientId), { headers: { Authorization: 'Bearer ' + user.token }, signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) throw Error('Unable to load linked laboratory results.');
        if (!controller.signal.aborted) {
          const labs = linkedDiagnosisLabs(data, patientId, diagnosisId);
          setState({ text: laboratoryResultText(labs), error: '', labs });
        }
      } catch (error) {
        if (error.name !== 'AbortError') setState({ text: 'Laboratory results unavailable', error: 'Unable to load linked laboratory results. Retrying automatically.', labs: [] });
      } finally { refreshing = false; }
    };
    load();
    const timer = window.setInterval(load, 15000);
    const onStorage = event => { if (event.key === 'vetintel:lab-results-changed') load(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', load);
    window.addEventListener('vetintel:appointment-updated', load);
    return () => { window.removeEventListener('storage', onStorage); controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('vetintel:appointment-updated', load); };
  }, [patientId, diagnosisId, user.clinic_id, user.token, refreshKey]);
  return state;
}
