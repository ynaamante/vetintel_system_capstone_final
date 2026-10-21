import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../components/Topbar';
import StatusIndicator from '../../components/StatusIndicator';
import { Icons } from '../../icons';
import { canViewFeature } from '../../utils/permissionUtils';

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function QueueBadge({ status }) {
  return <StatusIndicator status={status || 'Unknown'} />;
}

export default function PatientQueuePage({ user }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canView = canViewFeature(user.permissions, user.role, 'Patient Queue');

  useEffect(() => {
    if (!user || !user.token) return;
    if (!canView) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const params = new URLSearchParams();
    if (user.clinic_id) params.set('clinic_id', user.clinic_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    const headers = { Authorization: `Bearer ${user.token}` };

    const loadQueue = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}/clinic-records/patient-queue${query}`, { headers });
        if (!response.ok) throw new Error('Failed to load patient queue');
        const data = await response.json();
        setQueue(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError('Unable to load patient queue from the database.');
        setQueue([]);
      } finally {
        setLoading(false);
      }
    };

    loadQueue();
  }, [user, canView]);

  const total = queue.length;
  const waitingCount = queue.filter((item) => String(item.status || '').toLowerCase() === 'waiting').length;
  const inConsultationCount = queue.filter((item) => String(item.status || '').toLowerCase() === 'in-consultation').length;

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Patient Queue" subtitle="Monitor currently scheduled patients" />
        <div style={s.page}>
          <div style={s.pageHd}>
            <div>
              <div style={s.pageTitle}>Patient Queue</div>
              <div style={s.pageSub}>You do not have permission to view this page.</div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: 28, color: '#475569' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Access denied</h2>
            <p style={{ marginTop: 12 }}>Your role (<strong>{user.role}</strong>) does not currently have permission to view Patient Queue.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.main}>
      <Topbar user={user} title="Patient Queue" subtitle="Monitor currently scheduled patients" />
      <div style={s.page}>
        <div style={s.pageHd}>
          <div>
            <div style={s.pageTitle}>Patient Queue</div>
            <div style={s.pageSub}>Monitor scheduled patients, wait times, and practitioner status</div>
          </div>
        </div>

        <div style={s.statsGrid}>
          {[
            { label: 'Total in Queue', value: total, icon: Icons.users, iconBg: '#e7f5f2', iconColor: '#005447' },
            { label: 'Waiting', value: waitingCount, icon: Icons.clock, iconBg: '#fffbeb', iconColor: '#d97706' },
            { label: 'In Consultation', value: inConsultationCount, icon: Icons.check, iconBg: '#f0fdf4', iconColor: '#16a34a' },
          ].map((c) => (
            <div key={c.label} style={s.statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 17, height: 17, display: 'flex', color: c.iconColor }}>{c.icon}</span>
                </div>
                <div>
                  <div style={{ fontSize: '.7rem', color: '#64748b', fontWeight: 500 }}>{c.label}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2 }}>{c.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <div style={s.tableTitle}>Current Queue</div>
          {loading ? (
            <div style={{ padding: 40, color: '#64748b' }}>Loading queue…</div>
          ) : error ? (
            <div style={{ padding: 40, color: '#dc2626' }}>{error}</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>{['#', 'Check-in', 'Appointment', 'Pet Name', 'Owner', 'Practitioner', 'Status', 'Actions'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...s.td, color: '#64748b' }}>The patient queue is currently empty.</td></tr>
                ) : (
                  queue.map((item, index) => (
                    <tr key={item.id ?? index}>
                      <td style={{ ...s.td, fontWeight: 700, color: '#0f1117' }}>#{item.position ?? index + 1}</td>
                      <td style={s.tdMuted}>{formatTime(item.checkin_at)}</td>
                      <td style={s.td}>{formatTime(item.appointment_start)}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{item.pet || 'N/A'}</td>
                      <td style={s.td}>{item.owner || 'N/A'}</td>
                      <td style={s.td}>{item.practitioner || 'N/A'}</td>
                      <td style={s.td}><QueueBadge status={item.status} /></td>
                      <td style={s.td}>
                        <button style={item.status === 'in-consultation' ? s.completeBtn : s.startBtn} disabled>
                          <span style={{ width: 13, height: 13, display: 'flex' }}>{item.status === 'in-consultation' ? Icons.check : Icons.arrowRight}</span>
                          {item.status === 'in-consultation' ? 'Complete' : 'Start'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f4f6f9' },
  page: { padding: '24px 28px' },
  pageHd: { marginBottom: 20 },
  pageTitle: { fontFamily: "'DM Sans',sans-serif", fontSize: '1.3rem', fontWeight: 600, letterSpacing: '-.02em' },
  pageSub: { fontSize: '.78rem', color: '#64748b', marginTop: 3 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 },
  statCard: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '16px 20px' },
  card: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '20px 24px' },
  tableTitle: { fontSize: '.9rem', fontWeight: 600, color: '#0f1117', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', paddingBottom: 10, borderBottom: '1px solid #f1f5f9' },
  td: { padding: '13px 0', fontSize: '.82rem', color: '#0f1117', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  completeBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: '.75rem', color: '#16a34a', cursor: 'pointer', fontWeight: 500 },
  startBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, fontSize: '.75rem', color: '#0f1117', cursor: 'pointer', fontWeight: 500 },
};