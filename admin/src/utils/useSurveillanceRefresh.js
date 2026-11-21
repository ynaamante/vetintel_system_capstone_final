import { useEffect, useState } from 'react';

// Shared pages refresh even when another participating clinic records a diagnosis.
// No patient/clinic event payloads are broadcast to other clinics.
export function useSurveillanceRefresh() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setRevision(value => value + 1); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('vetintel:diagnosis-updated', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('vetintel:diagnosis-updated', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return revision;
}
