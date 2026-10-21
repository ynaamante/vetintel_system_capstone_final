import { useState } from 'react';
import Topbar from '../components/Topbar';
import StatusIndicator from '../components/StatusIndicator';
import { Icons } from '../icons';
import { formatDateText, formatDateTimeText } from '../utils/dateFormatting';
import { canExportFeature, canInteractWithFeature, canViewFeature } from '../utils/permissionUtils';

/* ── DATA ── */
const SYNC_HISTORY = [
  { datetime: '2026-03-03 09:45 AM', synced: 47, failed: 0,  status: 'success' },
  { datetime: '2026-03-03 03:45 AM', synced: 52, failed: 0,  status: 'success' },
  { datetime: '2026-03-02 09:45 PM', synced: 0,  failed: 3,  status: 'failed',  expandable: true },
  { datetime: '2026-03-02 03:45 PM', synced: 38, failed: 0,  status: 'success' },
  { datetime: '2026-03-02 09:45 AM', synced: 44, failed: 0,  status: 'success' },
  { datetime: '2026-03-01 09:45 PM', synced: 61, failed: 0,  status: 'success' },
];

const FAILED_DETAIL = [
  { record: 'RECORD-7821', reason: 'Schema validation error — missing required field',      clinic: 'City Pet Clinic'   },
  { record: 'RECORD-7819', reason: 'Duplicate entry detected — record already synchronized', clinic: 'Happy Tails Vet'   },
  { record: 'RECORD-7814', reason: 'Network timeout — retry limit exceeded',                 clinic: 'Paws & Care'       },
];

const SYNCED_ITEMS = [
  { label: 'Disease Type & Category', sub: 'Anonymized disease classifications' },
  { label: 'Risk Level Score',        sub: 'Calculated indicators (no identifiers)' },
  { label: 'Vaccination Status',      sub: 'Aggregated vaccination data' },
  { label: 'Time-Based Trends',       sub: 'Temporal patterns and counts' },
];

const NEVER_SYNCED = [
  { label: 'Pet Names',              sub: 'Patient identifiers stay local' },
  { label: 'Owner Names & Contact Info', sub: 'Client data remains local only' },
  { label: 'Detailed Medical Records',  sub: 'Full histories stay private' },
  { label: 'Appointment Details',       sub: 'Scheduling info is local only' },
];

/* ── MAIN PAGE ── */
export function DataSyncPage({ user }) {
  const [expanded,   setExpanded]   = useState(null);
  const [manualSync, setManualSync] = useState(false);
  const [autoSync,   setAutoSync]   = useState(true);

  const canView = canViewFeature(user.permissions, user.role, 'Data Sync Status');
  const canChangeSync = canInteractWithFeature(user.permissions, user.role, 'Data Sync Status');
  const canManualSync = canInteractWithFeature(user.permissions, user.role, 'Data Sync Status');
  const canChangeInterval = canInteractWithFeature(user.permissions, user.role, 'Data Sync Status');

  function triggerManualSync() {
    if (!canManualSync) return;
    setManualSync(true);
    setTimeout(() => setManualSync(false), 2000);
  }

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Data Sync Status" subtitle="Monitor synchronization and privacy settings" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.95rem' }}>You don't have permission to view this feature</div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.main}>
      <Topbar
        user={user}
        title="Data Sync Status"
        subtitle="Monitor synchronization and privacy settings"
      />
      <div style={s.page}>

        {/* TOP STAT CARDS */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Sync Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={s.activeDot} />
              <span style={s.activeText}>ACTIVE</span>
            </div>
            <div style={s.statSub}>Connection healthy</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Last Sync</div>
            <div style={s.statVal}>09:45 AM</div>
            <div style={s.statSub}>{formatDateText('2026-03-03')}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Records Synced</div>
            <div style={{ ...s.statVal, color: '#0f1117' }}>47</div>
            <div style={s.statSub}>This sync cycle</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Pending Records</div>
            <div style={{ ...s.statVal, color: '#f59e0b' }}>3</div>
            <div style={s.statSub}>Awaiting sync</div>
          </div>
        </div>

        {/* SYNC CONTROLS */}
        <div style={s.card}>
          <div style={s.cardTitle}>Sync Controls</div>

          <div style={s.controlRow}>
            <div>
              <div style={s.controlLabel}>Next Scheduled Sync</div>
              <div style={s.controlVal}>{formatDateTimeText('2026-03-03T15:45:00')}</div>
            </div>
          </div>

          <div style={s.divider} />

          <div style={s.controlRow}>
            <div>
              <div style={s.controlLabel}>Automatic synchronization every 6 hours</div>
              <a
                href="#"
                style={{
                  ...s.changeLink,
                  opacity: canChangeInterval ? 1 : 0.45,
                  color: canChangeInterval ? '#005447' : '#64748b',
                  pointerEvents: canChangeInterval ? 'auto' : 'none',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  if (!canChangeInterval) return;
                }}
              >Change interval →</a>
            </div>
            <div
              style={{
                ...s.toggle,
                background: canChangeSync ? (autoSync ? '#0f1117' : '#e2e8f0') : '#e2e8f0',
                opacity: canChangeSync ? 1 : 0.45,
                cursor: canChangeSync ? 'pointer' : 'not-allowed',
              }}
              onClick={() => canChangeSync && setAutoSync(v => !v)}
            >
              <div style={{
                ...s.toggleThumb,
                transform: autoSync ? 'translateX(18px)' : 'translateX(2px)',
              }} />
            </div>
          </div>

          <div style={s.divider} />

          <div style={{ paddingTop: 14 }}>
            <button
              style={{
                ...s.manualBtn,
                opacity: canManualSync ? (manualSync ? 0.7 : 1) : 0.65,
                background: canManualSync ? '#fff' : '#f8fafc',
                color: canManualSync ? '#0f1117' : '#64748b',
                border: canManualSync ? '1px solid #e8ecf0' : '1px solid #cbd5e1',
                cursor: canManualSync ? 'pointer' : 'not-allowed',
              }}
              onClick={triggerManualSync}
              disabled={!canManualSync}
            >
              <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.refresh}</span>
              {manualSync ? 'Syncing…' : 'Manual Sync'}
            </button>
          </div>
        </div>

        {/* PRIVACY PANEL */}
        <div style={s.privacyRow}>
          {/* What Gets Synchronized */}
          <div style={{ ...s.privacyCard, ...s.privacyGreen }}>
            <div style={s.privacyHd}>
              <span style={{ width: 16, height: 16, display: 'flex', color: '#16a34a' }}>{Icons.activity}</span>
              <span style={s.privacyTitle}>What Gets Synchronized</span>
            </div>
            {SYNCED_ITEMS.map((item, i) => (
              <div key={i} style={s.privacyItem}>
                <span style={{ width: 16, height: 16, display: 'flex', color: '#16a34a', flexShrink: 0 }}>{Icons.activity}</span>
                <div>
                  <div style={{ fontSize: '.82rem', fontWeight: 500, color: '#15803d' }}>{item.label}</div>
                  <div style={{ fontSize: '.72rem', color: '#4ade80', marginTop: 1 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* What NEVER Gets Synchronized */}
          <div style={{ ...s.privacyCard, ...s.privacyRed }}>
            <div style={s.privacyHd}>
              <span style={{ width: 16, height: 16, display: 'flex', color: '#dc2626' }}>{Icons.activity}</span>
              <span style={{ ...s.privacyTitle, color: '#dc2626' }}>What NEVER Gets Synchronized</span>
            </div>
            {NEVER_SYNCED.map((item, i) => (
              <div key={i} style={s.privacyItem}>
                <span style={{ width: 16, height: 16, display: 'flex', color: '#dc2626', flexShrink: 0 }}>{Icons.activity}</span>
                <div>
                  <div style={{ fontSize: '.82rem', fontWeight: 500, color: '#991b1b' }}>{item.label}</div>
                  <div style={{ fontSize: '.72rem', color: '#f87171', marginTop: 1 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SYNC HISTORY */}
        <div style={s.card}>
          <div style={{ ...s.cardTitle, marginBottom: 16 }}>Sync History</div>
          <div style={s.tableHead}>
            {['Date & Time', 'Records Synchronized', 'Records Failed', 'Status'].map(h => (
              <div key={h} style={s.th}>{h}</div>
            ))}
          </div>
          {SYNC_HISTORY.map((row, i) => (
            <div key={i}>
              <div
                style={{
                  ...s.tableRow,
                  borderBottom: (expanded === i || i < SYNC_HISTORY.length - 1) ? '1px solid #f1f5f9' : 'none',
                  background: row.status === 'failed' ? '#fef2f2' : 'transparent',
                  cursor: row.expandable ? 'pointer' : 'default',
                }}
                onClick={() => row.expandable && setExpanded(expanded === i ? null : i)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {row.expandable && (
                    <span style={{
                      width: 14, height: 14, display: 'flex', color: '#64748b',
                      transform: expanded === i ? 'rotate(90deg)' : 'none',
                      transition: 'transform .15s',
                    }}>
                      {Icons.arrowRight}
                    </span>
                  )}
                  <span style={{ fontSize: '.8rem', color: '#64748b', paddingLeft: row.expandable ? 0 : 20 }}>
                    {formatDateTimeText(row.datetime)}
                  </span>
                </div>
                <div style={{ fontSize: '.8rem', color: '#64748b', paddingLeft: 8 }}>{row.synced}</div>
                <div style={{ fontSize: '.8rem', color: row.failed > 0 ? '#dc2626' : '#64748b', paddingLeft: 8 }}>
                  {row.failed > 0 ? row.failed : '0'}
                </div>
                <div>
                  <StatusBadge status={row.status} />
                </div>
              </div>

              {/* Expanded failed detail */}
              {row.expandable && expanded === i && (
                <div style={s.expandedPanel}>
                  <div style={s.expandedTitle}>Failed Record Details</div>
                  <div style={s.failedHead}>
                    {['Record ID', 'Failure Reason', 'Clinic'].map(h => (
                      <div key={h} style={s.th}>{h}</div>
                    ))}
                  </div>
                  {FAILED_DETAIL.map((f, fi) => (
                    <div key={fi} style={{
                      ...s.failedRow,
                      borderBottom: fi < FAILED_DETAIL.length - 1 ? '1px solid #fecaca' : 'none',
                    }}>
                      <div style={{ fontSize: '.78rem', color: '#991b1b', fontFamily: 'monospace' }}>{f.record}</div>
                      <div style={{ fontSize: '.78rem', color: '#64748b' }}>{f.reason}</div>
                      <div style={{ fontSize: '.78rem', color: '#64748b' }}>{f.clinic}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

/* ── STATUS BADGE ── */
function StatusBadge({ status }) {
  return <StatusIndicator status={status} />;
}

/* ── STYLES ── */
const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f4f6f9' },
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
  changeLink:   { fontSize: '.75rem', color: '#005447', textDecoration: 'none' },
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
