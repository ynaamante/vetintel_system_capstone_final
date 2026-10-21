import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../components/Topbar';
import { Icons } from '../../icons';
import { canViewFeature } from '../../utils/permissionUtils';
import { formatDateText } from '../../utils/dateFormatting';

function formatDate(value) {
  return formatDateText(value, undefined, '');
}

export default function RemindersPage({ user }) {
  const [reminders, setReminders] = useState([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canView = canViewFeature(user.permissions, user.role, 'Due Dates & Reminders');

  useEffect(() => {
    if (!user || !user.token) return;
    if (!canView) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const params = new URLSearchParams();
    if (user.clinic_id) params.set('clinic_id', user.clinic_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    const headers = { Authorization: `Bearer ${user.token}` };

    const loadReminders = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}/clinic-records/reminders${query}`, { headers });
        if (!response.ok) throw new Error('Failed to load reminders');
        const data = await response.json();
        setReminders(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError('Unable to load reminders from the database.');
        setReminders([]);
      } finally {
        setLoading(false);
      }
    };

    loadReminders();
  }, [user, canView]);

  const filtered = useMemo(() => {
    if (tab === 'all') return reminders;
    return reminders.filter((reminder) => String(reminder.status || '').toLowerCase() === tab);
  }, [reminders, tab]);

  const tabs = [
    { id: 'all', label: 'All Reminders' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'due-soon', label: 'Due Soon' },
    { id: 'upcoming', label: 'Upcoming' },
  ];

  const stats = useMemo(() => ({
    overdue: reminders.filter((reminder) => String(reminder.status || '').toLowerCase() === 'overdue').length,
    dueSoon: reminders.filter((reminder) => String(reminder.status || '').toLowerCase() === 'due-soon').length,
    upcoming: reminders.filter((reminder) => String(reminder.status || '').toLowerCase() === 'upcoming').length,
    total: reminders.length,
  }), [reminders]);

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Due Dates & Reminders" subtitle="Vaccination reminders and follow-up schedules" />
        <div style={s.page}>
          <div style={s.pageHd}>
            <div>
              <div style={s.pageTitle}>Due Dates & Reminders</div>
              <div style={s.pageSub}>You do not have permission to view this page.</div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: 28, color: '#475569' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Access denied</h2>
            <p style={{ marginTop: 12 }}>Your role (<strong>{user.role}</strong>) does not currently have permission to view Reminders.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.main}>
      <Topbar user={user} title="Due Dates & Reminders" subtitle="Vaccination reminders and follow-up schedules" />
      <div style={s.page}>
        <div style={s.statsGrid}>
          {[
            { label: 'Overdue', value: stats.overdue, icon: Icons.shield, iconBg: '#fef2f2', iconColor: '#dc2626' },
            { label: 'Due Soon', value: stats.dueSoon, icon: Icons.calendar, iconBg: '#fffbeb', iconColor: '#d97706' },
            { label: 'Upcoming', value: stats.upcoming, icon: Icons.file, iconBg: '#e7f5f2', iconColor: '#005447' },
            { label: 'Total', value: stats.total, icon: Icons.check, iconBg: '#f0fdf4', iconColor: '#16a34a' },
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

        <div style={s.tabBar}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ ...s.tabBtn, ...(tab === t.id ? s.tabActive : {}) }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={s.card}>
          <div style={s.tableTitle}>All Reminders ({filtered.length})</div>
          {loading ? (
            <div style={{ padding: 40, color: '#64748b' }}>Loading reminders…</div>
          ) : error ? (
            <div style={{ padding: 40, color: '#dc2626' }}>{error}</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>{['ID', 'Pet Name', 'Owner', 'Contact', 'Type', 'Description', 'Due Date', 'Status', 'Actions'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ ...s.td, color: '#64748b' }}>No reminders found for this filter.</td></tr>
                ) : (
                  filtered.map((reminder) => (
                    <tr key={reminder.id}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{reminder.id}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{reminder.pet || 'N/A'}</td>
                      <td style={s.td}>{reminder.owner || 'N/A'}</td>
                      <td style={s.tdMuted}>{reminder.contact || 'N/A'}</td>
                      <td style={s.td}>{reminder.type || 'N/A'}</td>
                      <td style={s.tdMuted}>{reminder.description || 'N/A'}</td>
                      <td style={s.tdMuted}>{formatDate(reminder.due_date)}</td>
                      <td style={s.td}>{reminder.status || 'Unknown'}</td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={s.emailBtn} disabled>
                            <span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.mail}</span>
                            Email
                          </button>
                          <button style={s.smsBtn} disabled>
                            <span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.bell}</span>
                            SMS
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={s.tableTitle}>Quick Actions</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={s.quickBtn} disabled>
              <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.mail}</span>
              Send All Overdue Reminders
            </button>
            <button style={s.quickBtn} disabled>
              <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.bell}</span>
              Send All Due Soon Reminders
            </button>
          </div>
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
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  statCard: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '16px 20px' },
  tabBar: { display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 16, gap: 2 },
  tabBtn: { flex: 1, padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: '.82rem', color: '#64748b', background: 'transparent', cursor: 'pointer' },
  tabActive: { background: '#fff', color: '#0f1117', fontWeight: 500, boxShadow: '0 1px 3px rgba(0,0,0,.08)' },
  card: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '20px 24px' },
  tableTitle: { fontSize: '.9rem', fontWeight: 600, color: '#0f1117', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', paddingBottom: 10, borderBottom: '1px solid #f1f5f9' },
  td: { padding: '13px 0', fontSize: '.82rem', color: '#0f1117', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  tdMuted: { padding: '13px 0', fontSize: '.72rem', color: '#64748b', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  emailBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, fontSize: '.72rem', color: '#0f1117', cursor: 'pointer' },
  smsBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, fontSize: '.72rem', color: '#0f1117', cursor: 'pointer' },
  quickBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#fff', border: '1px solid #e8ecf0', borderRadius: 8, fontSize: '.82rem', color: '#0f1117', cursor: 'pointer' },
};