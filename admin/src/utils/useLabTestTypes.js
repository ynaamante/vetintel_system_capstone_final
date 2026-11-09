import { useEffect, useState } from 'react';

export default function useLabTestTypes(user) {
  const [testTypes, setTestTypes] = useState([]);
  const [error, setError] = useState('');
  const [diseases, setDiseases] = useState([]);
  useEffect(() => {
    setTestTypes([]);
    setDiseases([]);
    setError('');
    if (!user?.token || !user?.clinic_id) return;
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    fetch(`${apiUrl}/clinic-records/lab-test-types?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
      headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Unable to load laboratory test types. Please reopen the form to retry.');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid laboratory test catalog response.');
      setTestTypes(data.map(item => item.name).filter(Boolean));
      setDiseases([...new Set(data.map(item => item.disease.toLowerCase()))]);
    }).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    });
    return () => controller.abort();
  }, [user?.token, user?.clinic_id]);
  return { testTypes, diseases, error };
}
