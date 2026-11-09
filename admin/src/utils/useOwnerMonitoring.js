import { useCallback, useEffect, useState } from 'react';
import { readApiResponse } from './apiResponse';

export default function useOwnerMonitoring(user, enabled = true, resource = 'summary') {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!enabled || !user?.token) { setLoading(false); return; }
    const controller = new AbortController();
    const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    setLoading(true);
    fetch(`${api}/owner-monitoring/${resource}?clinic_id=${encodeURIComponent(user.clinic_id || '')}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal })
      .then(response => readApiResponse(response))
      .then(body => { if (!controller.signal.aborted) { setData(body); setError(''); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.token, user?.clinic_id, enabled, resource, revision]);
  useEffect(() => {
    if (!enabled) return;
    const update = () => { if (!document.hidden) refresh(); };
    window.addEventListener('vetintel:billing-updated', update);
    window.addEventListener('vetintel:appointment-updated', update);
    window.addEventListener('focus', update);
    const timer = window.setInterval(update, 30000);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('vetintel:billing-updated', update); window.removeEventListener('vetintel:appointment-updated', update); };
  }, [enabled, refresh]);
  return { data, error, loading, refresh };
}
