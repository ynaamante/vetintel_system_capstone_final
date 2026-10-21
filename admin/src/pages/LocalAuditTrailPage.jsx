import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import { Icons } from '../icons';
import { formatDateTimeText } from '../utils/dateFormatting';

export default function LocalAuditTrailPage({ user }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('All Actions');
  const [selectedLog, setSelectedLog] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    fetch(`${apiUrl}/audit-trail/filter?clinic_id=${encodeURIComponent(user.clinic_id)}&days=365`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(async response => {
        const payload = await response.json().catch(() => []);
        if (!response.ok) throw new Error(payload.error || 'Unable to load local audit history.');
        return payload;
      })
      .then(setLogs)
      .catch(loadError => setError(loadError.message));
  }, [user]);

  const actions = [...new Set(logs.map(log => String(log.action || '').toLowerCase()))];
  const filtered = logs.filter(log => {
    const matchesSearch = [log.user, log.action, log.details, log.category]
      .some(value => String(value || '').toLowerCase().includes(search.toLowerCase()));
    return matchesSearch && (action === 'All Actions' || String(log.action || '').toLowerCase() === action);
  });
  const today = new Date().toDateString();
  const todayCount = logs.filter(log => new Date(log.timestamp).toDateString() === today).length;
  const criticalCount = logs.filter(log => ['archive', 'delete', 'restore'].includes(String(log.action || '').toLowerCase())).length;

  return (
    <div style={styles.main}>
      <Topbar user={user} title="Local Audit Trail" subtitle="Doctor activity and clinic record history" />
      <div style={styles.page}>
        <div style={styles.statsGrid}>
          {[
            ['Active Users', new Set(logs.map(log => log.user).filter(Boolean)).size, 'users', '#d8f4e8', '#005447'],
            ['Total Actions', logs.length, 'file', '#dcfce7', '#16a34a'],
            ["Today's Activity", todayCount, 'calendar', '#fef3c7', '#d97706'],
            ['Critical Actions', criticalCount, 'info', '#f3e8ff', '#9333ea'],
          ].map(([label, value, icon, background, color]) => (
            <div key={label} style={styles.statCard}>
              <div style={{ ...styles.statIcon, background }}><span style={{ width: 18, height: 18, display: 'flex', color }}>{Icons[icon]}</span></div>
              <div><div style={styles.statLabel}>{label}</div><div style={styles.statValue}>{value}</div></div>
            </div>
          ))}
        </div>
        <div style={styles.filterCard}>
          <div style={styles.searchWrap}><span style={styles.searchIcon}>{Icons.search}</span><input style={styles.search} placeholder="Search by description or ID..." value={search} onChange={event => setSearch(event.target.value)} /></div>
          <select style={styles.select} value={action} onChange={event => setAction(event.target.value)}><option>All Actions</option>{actions.map(value => <option key={value} value={value}>{value.replace(/\b\w/g, letter => letter.toUpperCase())}</option>)}</select>
          <select style={styles.select} defaultValue="Last 7 Days"><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option></select>
        </div>
        {error && <div role="alert" style={styles.error}>{error}</div>}
        <div style={styles.card}>
          <div style={styles.activityTitle}>Activity Log ({filtered.length} entries)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr>{['Audit ID', 'Timestamp', 'User', 'Action', 'Description', 'Entity', 'Actions'].map(label => <th key={label} style={styles.th}>{label}</th>)}</tr></thead>
              <tbody>{filtered.map(log => <tr key={log.id}>
                <td style={styles.mono}>{`AUD-${String(log.id).padStart(4, '0')}`}</td>
                <td style={styles.td}>{formatDateTimeText(log.timestamp)}</td>
                <td style={{ ...styles.td, fontWeight: 600 }}>{log.user || 'System'}</td>
                <td style={styles.td}><span style={styles.badge}>{log.action}</span></td>
                <td style={styles.td}>{log.details || 'Updated a clinic record'}</td>
                <td style={styles.mono}>{log.category ? `${log.category}${log.id ? ` #${log.id}` : ''}` : '—'}</td>
                <td style={styles.td}><button type="button" style={styles.detailsButton} onClick={() => setSelectedLog(log)}>View Details</button></td>
              </tr>)}</tbody>
            </table>
          </div>
          {!filtered.length && !error && <div style={styles.empty}>No local clinic activity found.</div>}
        </div>
      </div>
      {selectedLog && <div style={styles.overlay} onClick={() => setSelectedLog(null)}><div style={styles.modal} onClick={event => event.stopPropagation()}><div style={styles.modalHeader}><div><h2 style={styles.title}>Audit Log Details</h2><div style={styles.subtitle}>{`AUD-${String(selectedLog.id).padStart(4, '0')}`}</div></div><button type="button" style={styles.close} onClick={() => setSelectedLog(null)}>{Icons.close}</button></div><div style={styles.detailGrid}><strong>Timestamp</strong><span>{formatDateTimeText(selectedLog.timestamp)}</span><strong>User</strong><span>{selectedLog.user || 'System'}</span><strong>Action</strong><span>{selectedLog.action}</span><strong>Record</strong><span>{selectedLog.category || '—'}</span><strong>Details</strong><span>{selectedLog.details || 'Updated a clinic record'}</span></div></div></div>}
    </div>
  );
}

const styles = {
  main: { flex: 1, overflowY: 'auto', background: '#f4f6f9' },
  page: { padding: '22px 28px 36px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 },
  statCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 11, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 13 },
  statIcon: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: '#94a3b8', fontSize: '.68rem', marginBottom: 4 },
  statValue: { color: '#0f172a', fontSize: '1.15rem', fontWeight: 700 },
  filterCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 11, padding: 12, display: 'flex', gap: 10, marginBottom: 18 },
  card: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: 18 },
  activityTitle: { color: '#0f172a', fontSize: '.8rem', fontWeight: 700, marginBottom: 14 },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: 18 },
  title: { margin: 0, color: '#0f172a', fontSize: '.95rem' },
  subtitle: { margin: '5px 0 0', color: '#64748b', fontSize: '.75rem' },
  searchWrap: { flex: 1, display: 'flex', alignItems: 'center', background: '#f1f1f3', borderRadius: 8 },
  searchIcon: { width: 16, height: 16, display: 'flex', marginLeft: 12, color: '#64748b' },
  search: { flex: 1, border: 0, outline: 0, background: 'transparent', padding: '9px 12px', color: '#334155', fontSize: '.78rem' },
  select: { minWidth: 145, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#475569', padding: '8px 10px', fontSize: '.76rem' },
  error: { marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '.78rem' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: { textAlign: 'left', padding: '0 7px 9px', borderBottom: '1px solid #e5e7eb', color: '#374151', fontSize: '.7rem' },
  td: { padding: '9px 7px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: '.72rem', verticalAlign: 'top' },
  mono: { padding: '9px 7px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '.69rem', fontFamily: 'monospace', whiteSpace: 'nowrap' },
  badge: { display: 'inline-flex', padding: '3px 9px', borderRadius: 20, background: '#e7f5f2', border: '1px solid #b7e4d7', color: '#005447', fontSize: '.68rem', fontWeight: 600 },
  detailsButton: { border: '1px solid #dbe3ed', borderRadius: 7, background: '#fff', color: '#334155', padding: '5px 9px', fontSize: '.68rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  overlay: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { width: 460, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 18px 45px rgba(15,23,42,.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  close: { border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', width: 24, height: 24 },
  detailGrid: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '11px 14px', color: '#334155', fontSize: '.78rem' },
  empty: { padding: 24, textAlign: 'center', color: '#64748b', fontSize: '.8rem' },
};
