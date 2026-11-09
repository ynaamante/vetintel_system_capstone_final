import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { formatDateTimeText } from '../utils/dateFormatting';

export default function ClinicRecordAuditEntries({ user, table, recordId }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const query = new URLSearchParams({ clinic_id: String(user.clinic_id), table_name: table, record_id: String(recordId) });
    fetch(`${api}/audit-trail/filter?${query}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load record history.'); if (!controller.signal.aborted) setRows(body); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.token, user.clinic_id, table, recordId]);
  if (loading) return <li>Loading recorded history...</li>;
  if (error) return <li role="alert">{error}</li>;
  if (!rows.length) return <li>No audit entries recorded for this profile.</li>;
  return rows.map(row => <li key={row.id} className="audit-timeline-entry"><time>{formatDateTimeText(row.timestamp)}</time><article className="audit-event-card"><strong>{row.action}</strong><p>{row.reason || row.details}</p><span>{row.user || 'System'}</span></article></li>);
}
ClinicRecordAuditEntries.propTypes = { user: PropTypes.object.isRequired, table: PropTypes.string.isRequired, recordId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired };
