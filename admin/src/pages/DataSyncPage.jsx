import Topbar from '../components/Topbar';
import { formatDateTimeText } from '../utils/dateFormatting';
import { canViewFeature } from '../utils/permissionUtils';
import useOwnerMonitoring from '../utils/useOwnerMonitoring';

export function DataSyncPage({ user, embedded = false }) {
  const canView = canViewFeature(user.permissions, user.role, 'Data Sync Status');
  const { data, error, loading, refresh } = useOwnerMonitoring(user, canView, 'data-status');
  if (!canView) return <div style={s.main}><Topbar user={user} title="Data Sync Status" subtitle="Monitor clinic data availability" /><div style={s.page}>You do not have permission to view this feature.</div></div>;
  return <div style={embedded ? { minWidth: 0 } : s.main}>
    {!embedded && <Topbar user={user} title="Data Sync Status" subtitle="Monitor the shared clinic data used by doctors, receptionists, and owners" />}
    <div style={embedded ? { padding: 0 } : s.page}>
      {error && <p role="alert">{error}</p>}
      <div style={s.card}><div style={s.cardTitle}>Shared clinic database</div><p>Doctor records, receptionist appointments and payments, and owner monitoring use the same database. Saved changes are available without a separate transfer.</p><p>There is no scheduled synchronization service or transfer queue configured.</p><button type="button" style={s.manualBtn} disabled={loading} onClick={refresh}>{loading ? 'Checking...' : 'Refresh data status'}</button></div>
      <div style={s.statsRow}>
        {[['Connection', loading ? 'Checking...' : error ? 'Unavailable' : data ? 'Connected' : 'Unknown'], ['Last checked', data ? formatDateTimeText(data.checked_at) : '?'], ['Appointments', data?.appointments ?? '?'], ['Payments', data?.payments ?? '?']].map(([label, value]) => <div key={label} style={s.statCard}><div style={s.statLabel}>{label}</div><div style={s.statVal}>{value}</div></div>)}
      </div>
      <div style={s.card}><div style={s.cardTitle}>Recorded clinic data</div><table style={{width:'100%', textAlign:'left'}}><thead><tr><th>Record type</th><th>Records</th><th>Latest recorded entry</th></tr></thead><tbody>
        {[['Patients', data?.patients, data?.latest_patient], ['Appointments', data?.appointments, null], ['Invoices', data?.invoices, data?.latest_invoice], ['Payments', data?.payments, data?.latest_payment], ['Vaccinations', data?.vaccinations, null]].map(([label, count, date]) => <tr key={label}><td style={{padding:'14px 0'}}>{label}</td><td>{count ?? '?'}</td><td>{date ? formatDateTimeText(date) : '?'}</td></tr>)}
      </tbody></table></div>
      <div style={s.card}><div style={s.cardTitle}>Clinic access</div><p>These totals are restricted to your assigned clinic. The owner sees the records saved by clinic staff; this page does not transfer patient data to another clinic.</p></div>
    </div>
  </div>;
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f1f6ef' },
  page: { padding: '24px 28px' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 },
  statCard: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '20px 22px',
  },
  statLabel:  { fontSize: '.78rem', color: '#64748b' },
  statVal:    { fontFamily: "'DM Sans', sans-serif", fontSize: '1.9rem', fontWeight: 700, letterSpacing: '-.03em', marginTop: 8 },
  statSub:    { fontSize: '.72rem', color: '#64748b', marginTop: 4 },
  activeDot:  { width: 9, height: 9, borderRadius: '50%', background: '#16a34a', flexShrink: 0 },
  activeText: { fontFamily: "'DM Sans', sans-serif", fontSize: '1.4rem', fontWeight: 700, color: '#16a34a', letterSpacing: '-.01em' },

  card: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '20px 22px', marginBottom: 16,
  },
  cardTitle: { fontSize: '.88rem', fontWeight: 600, color: '#0f1117', letterSpacing: '-.01em', marginBottom: 16 },

  controlRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 14, paddingBottom: 14,
  },
  controlLabel: { fontSize: '.82rem', color: '#0f1117', marginBottom: 4 },
  controlVal:   { fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', fontWeight: 600, color: '#0f1117' },
  changeLink:   { fontSize: '.75rem', color: '#013826', textDecoration: 'none' },
  divider:      { height: 1, background: '#f1f5f9' },

  toggle: {
    width: 40, height: 22, borderRadius: 22,
    position: 'relative', cursor: 'pointer',
    transition: 'background .2s', flexShrink: 0,
  },
  toggleThumb: {
    position: 'absolute', top: 2, width: 18, height: 18,
    borderRadius: '50%', background: '#fff',
    transition: 'transform .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
  },
  manualBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '9px 18px', background: '#fff',
    border: '1px solid #e8ecf0', borderRadius: 8,
    fontSize: '.82rem', fontWeight: 500, color: '#0f1117',
    cursor: 'pointer',
  },

  privacyRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 },
  privacyCard: { borderRadius: 14, padding: '18px 20px' },
  privacyGreen: { background: '#f0fdf4', border: '1px solid #bbf7d0' },
  privacyRed:   { background: '#fef2f2', border: '1px solid #fecaca' },
  privacyHd: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginBottom: 16,
  },
  privacyTitle: { fontSize: '.85rem', fontWeight: 600, color: '#15803d' },
  privacyItem: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    marginBottom: 12,
  },

  tableHead: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 130px',
    paddingBottom: 10, borderBottom: '1px solid #f1f5f9',
  },
  th: { fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' },
  tableRow: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 130px',
    padding: '12px 0', alignItems: 'center',
    transition: 'background .1s',
  },

  expandedPanel: {
    background: '#fff8f8', border: '1px solid #fecaca',
    borderRadius: 8, margin: '0 0 10px 20px', padding: '14px 16px',
  },
  expandedTitle: { fontSize: '.75rem', fontWeight: 600, color: '#991b1b', marginBottom: 10 },
  failedHead: {
    display: 'grid', gridTemplateColumns: '120px 1fr 140px',
    paddingBottom: 8, borderBottom: '1px solid #fecaca',
  },
  failedRow: {
    display: 'grid', gridTemplateColumns: '120px 1fr 140px',
    padding: '10px 0', gap: 8,
  },
};
