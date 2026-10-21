import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import Topbar from '../components/Topbar';
import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';
import { formatDateTimeText } from '../utils/dateFormatting';

const ACTION_META = {
  'alert acknowledged': { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  update: { color: '#005447', bg: '#e7f5f2', border: '#b7e4d7' },
  'report generated': { color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
  create: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  'data sync': { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  login: { color: '#64748b', bg: '#f4f6f9', border: '#e8ecf0' },
  logout: { color: '#64748b', bg: '#f4f6f9', border: '#e8ecf0' },
  delete: { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  'settings changed': { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
};

const ACTION_ICONS = {
  'alert acknowledged': '!',
  update: 'edit',
  'report generated': 'download',
  create: 'plus',
  'data sync': 'refresh',
  login: 'arrowRight',
  logout: 'logout',
  delete: 'trash',
  'settings changed': 'settings',
};

const AUDIT_LOGS = [
  { id: 'AUD-1045', timestamp: '2026-04-24 14:23:15', user: 'Dr. Sarah Chen', action: 'alert acknowledged', description: 'Acknowledged Parvovirus threshold alert', entity: 'Alert #ALT-2847', ip: '192.168.1.45' },
  { id: 'AUD-1044', timestamp: '2026-04-24 13:45:32', user: 'Dr. Sarah Chen', action: 'update', description: 'Updated pet vaccination record', entity: 'Pet #PET-1023', ip: '192.168.1.45' },
  { id: 'AUD-1043', timestamp: '2026-04-24 12:18:09', user: 'Dr. Sarah Chen', action: 'report generated', description: 'Generated Monthly Disease Summary report', entity: 'Report #RPT-789', ip: '192.168.1.45' },
  { id: 'AUD-1042', timestamp: '2026-04-24 11:30:22', user: 'Dr. Sarah Chen', action: 'create', description: 'Created new appointment for Max Johnson', entity: 'Appointment #APT-445', ip: '192.168.1.45' },
  { id: 'AUD-1041', timestamp: '2026-04-24 10:52:41', user: 'Dr. Sarah Chen', action: 'data sync', description: 'Synchronized 47 records with intelligence network', entity: '—', ip: '192.168.1.45' },
  { id: 'AUD-1040', timestamp: '2026-04-24 09:15:03', user: 'Dr. Sarah Chen', action: 'login', description: 'User logged in successfully', entity: '—', ip: '192.168.1.45' },
  { id: 'AUD-1039', timestamp: '2026-04-23 18:30:44', user: 'Dr. Sarah Chen', action: 'logout', description: 'User logged out', entity: '—', ip: '192.168.1.45' },
  { id: 'AUD-1038', timestamp: '2026-04-23 17:22:18', user: 'Dr. Sarah Chen', action: 'delete', description: 'Deleted cancelled appointment', entity: 'Appointment #APT-442', ip: '192.168.1.45' },
  { id: 'AUD-1037', timestamp: '2026-04-23 16:45:09', user: 'Dr. Sarah Chen', action: 'settings changed', description: 'Updated privacy settings for data sharing', entity: '—', ip: '192.168.1.45' },
  { id: 'AUD-1036', timestamp: '2026-04-23 15:12:33', user: 'Dr. Sarah Chen', action: 'update', description: 'Updated owner contact information', entity: 'Owner #OWN-234', ip: '192.168.1.45' },
];

function downloadAuditCsv(logs) {
  const rows = [
    ['Audit ID', 'Timestamp', 'User', 'Action', 'Description', 'Entity', 'IP Address'],
    ...logs.map(log => [log.id, log.timestamp, log.user, log.action, log.description, log.entity, log.ip]),
  ];
  const csv = rows
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'vetintel-audit-trail-report.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function downloadAuditPdf(logs) {
  const pdf = new jsPDF({ orientation: 'landscape' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const columns = [
    ['Audit ID', 25],
    ['Timestamp', 35],
    ['User', 34],
    ['Action', 31],
    ['Description', 73],
    ['Entity', 38],
    ['IP Address', 31],
  ];
  let y = 16;

  const drawHeader = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(23, 32, 51);
    pdf.text('VetIntel Audit Trail Report', margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Generated: ${formatDateTimeText(new Date(), 'en-PH')} | ${logs.length} entries`, margin, y + 6);
    y += 16;
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(51, 65, 85);
    let x = margin;
    columns.forEach(([label, width]) => {
      pdf.text(label, x + 2, y + 1);
      x += width;
    });
    y += 10;
  };

  drawHeader();
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.8);
  logs.forEach(log => {
    const values = [log.id, log.timestamp, log.user, log.action, log.description, log.entity, log.ip];
    const lines = values.map((value, index) => pdf.splitTextToSize(String(value), columns[index][1] - 4));
    const rowHeight = Math.max(...lines.map(line => line.length)) * 3.5 + 4;
    if (y + rowHeight > pageHeight - margin) {
      pdf.addPage();
      y = 16;
      drawHeader();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
    }
    let x = margin;
    lines.forEach((line, index) => {
      pdf.setTextColor(51, 65, 85);
      pdf.text(line, x + 2, y, { baseline: 'top' });
      x += columns[index][1];
    });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowHeight - 2, pageWidth - margin, y + rowHeight - 2);
    y += rowHeight;
  });
  pdf.save('vetintel-audit-trail-report.pdf');
}

const ActionBadge = ({ action }) => {
  const m = ACTION_META[action] || ACTION_META.login;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: m.bg, border: `1px solid ${m.border}`,
      fontSize: '.72rem', fontWeight: 600, color: m.color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 12, height: 12, display: 'flex' }}>{Icons[ACTION_ICONS[action]] || Icons.info}</span>
      {action}
    </span>
  );
};

/* ── VIEW DETAILS MODAL ── */
function DetailModal({ log, onClose }) {
  if (!log) return null;
  const additionalDetails = log.action === 'alert acknowledged'
    ? [['alert Type:', 'Threshold Exceeded'], ['disease:', 'Parvovirus']]
    : log.action === 'report generated'
      ? [['report Type:', 'Monthly Disease Summary'], ['format:', 'PDF']]
      : log.action === 'data sync'
        ? [['records:', '47'], ['status:', 'Completed']]
        : [['status:', 'Completed']];
  const actionMeta = ACTION_META[log.action] || ACTION_META.login;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 100 }} />
      <div style={m.panel}>
        <div style={m.header}>
          <div>
            <div style={m.titleRow}>
              <span style={{ ...m.actionBadge, color: actionMeta.color, background: actionMeta.bg }}>
                <span style={{ width: 13, height: 13, display: 'flex' }}>{Icons.info}</span>
                {log.action}
              </span>
              <div style={m.headerTitle}>Audit Log Details</div>
            </div>
            <div style={m.headerSub}>{log.id}</div>
          </div>
          <button type="button" aria-label="Close audit log details" style={m.closeBtn} onClick={onClose}>
            <span style={{ width: 18, height: 18, display: 'flex', color: '#64748b' }}>{Icons.close}</span>
          </button>
        </div>
        <div style={m.body}>
          <div style={m.metaGrid}>
            <div style={m.field}>
              <div style={m.fieldLabel}>Timestamp</div>
              <div style={m.fieldValue}>{formatDateTimeText(log.timestamp)}</div>
            </div>
            <div style={m.field}>
              <div style={m.fieldLabel}>User</div>
              <div style={m.fieldValue}>{log.user}</div>
            </div>
            <div style={m.field}>
              <div style={m.fieldLabel}>IP Address</div>
              <div style={m.fieldValue}>{log.ip}</div>
            </div>
            <div style={m.field}>
              <div style={m.fieldLabel}>Action Type</div>
              <div style={m.fieldValue}>{log.action}</div>
            </div>
          </div>
          <div style={m.stackedField}>
            <div style={m.fieldLabel}>Description</div>
            <div style={m.fieldValue}>{log.description}</div>
          </div>
          <div style={m.stackedField}>
            <div style={m.fieldLabel}>Entity</div>
            <div style={m.fieldValue}>{log.entity}</div>
          </div>
          <div style={m.stackedField}>
            <div style={m.fieldLabel}>Role / Change</div>
            <div style={m.fieldValue}>{log.role || '—'} · {log.previousValue || '—'} → {log.newValue || '—'}</div>
          </div>
          {log.reason && <div style={m.stackedField}>
            <div style={m.fieldLabel}>Reason</div>
            <div style={m.fieldValue}>{log.reason}</div>
          </div>}
          <div style={m.stackedField}>
            <div style={m.fieldLabel}>Additional Details</div>
            <div style={m.additionalDetails}>
              {additionalDetails.map(([label, value]) => (
                <div key={label} style={m.detailLine}>
                  <span style={m.detailLabel}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AuditTrailPage({ user }) {
  const [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setAction] = useState('All Actions');
  const [userFilter, setUser] = useState('All Users');
  const [dateFilter, setDate] = useState('Last 7 Days');
  const [modal, setModal] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (!user?.token) return undefined;
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    fetch(`${apiUrl}/audit-trail/filter?clinic_id=${encodeURIComponent(user.clinic_id || '')}&days=365`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(async response => {
        const payload = await response.json().catch(() => []);
        if (!response.ok) throw new Error(payload.error || 'Unable to load audit history.');
        return payload;
      })
      .then(rows => {
        setLogs(rows.map(row => {
          const oldData = row.old_data || {};
          const newData = row.new_data || {};
          return {
            id: `AUD-${String(row.id).padStart(4, '0')}`,
            timestamp: row.timestamp,
            user: row.user || 'System',
            action: String(row.action || '').toLowerCase(),
            description: row.reason || row.details || `${row.action || 'Updated'} ${row.category || 'clinic record'}`,
            entity: `${row.category || 'record'}${row.record_id ? ` #${row.record_id}` : ''}`,
            ip: row.ip_address || 'Local',
            role: row.role,
            reason: row.reason,
            previousValue: row.previousValue || oldData.status || oldData.value,
            newValue: row.newValue || newData.status || newData.value,
          };
        }));
      })
      .catch(error => setLoadError(error.message));
    return undefined;
  }, [user]);

  const canView = canViewFeature(user.permissions, user.role, 'Audit Trail');

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Audit Trail" subtitle="System-wide activity logs and security monitoring" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.95rem' }}>You don't have permission to view this feature</div>
        </div>
      </div>
    );
  }

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.description.toLowerCase().includes(search.toLowerCase()) || l.id.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'All Actions' || l.action === actionFilter.toLowerCase();
    const matchUser = userFilter === 'All Users' || l.user === userFilter;
    const ageDays = (Date.now() - new Date(l.timestamp).getTime()) / 86400000;
    const maxDays = dateFilter === 'Last 7 Days' ? 7 : dateFilter === 'Last 30 Days' ? 30 : 90;
    return matchSearch && matchAction && matchUser && Number.isFinite(ageDays) && ageDays <= maxDays;
  });
  const users = [...new Set(logs.map(log => log.user).filter(Boolean))];
  const today = new Date().toDateString();
  const criticalActions = logs.filter(log => ['delete', 'archive', 'unverify', 'override', 'cancel'].some(keyword => log.action.includes(keyword))).length;

  return (
    <div style={s.main}>
      <Topbar user={user} title="Audit Trail" subtitle="System-wide activity logs and security monitoring" />
      <div style={s.page}>

        {/* STAT CARDS */}
        <div style={s.statsGrid}>{[
        { icon: 'users', iconBg: '#d8f4e8', iconColor: '#005447', label: 'Active Users', value: String(users.length) },
        { icon: 'file', iconBg: '#dcfce7', iconColor: '#16a34a', label: 'Total Actions', value: String(logs.length) },
        { icon: 'calendar', iconBg: '#fef3c7', iconColor: '#f59e0b', label: "Today's Activity", value: String(logs.filter(log => new Date(log.timestamp).toDateString() === today).length) },
        { icon: 'info', iconBg: '#f3e8ff', iconColor: '#9333ea', label: 'Critical Actions', value: String(criticalActions) },
          ].map((c, i) => (
            <div key={i} style={s.statCard}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ ...s.statIcon, background: c.iconBg }}>
                  <span style={{ width: 18, height: 18, display: 'flex', color: c.iconColor }}>{Icons[c.icon]}</span>
                </div>
                <div>
                  <div style={s.statLabel}>{c.label}</div>
                  <div style={s.statValue}>{c.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FILTER BAR */}
        <div style={s.filterBar}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>{Icons.search}</span>
            <input
              style={s.searchInput}
              placeholder="Search by description or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select style={s.select} value={actionFilter} onChange={e => setAction(e.target.value)}>
            {['All Actions', 'Alert Acknowledged', 'Update', 'Report Generated', 'Create', 'Data Sync', 'Login', 'Logout', 'Delete', 'Settings Changed'].map(a => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select style={s.select} value={userFilter} onChange={e => setUser(e.target.value)}>
            {['All Users', ...users].map(u => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <select style={s.select} value={dateFilter} onChange={e => setDate(e.target.value)}>
            {['Last 7 Days', 'Last 30 Days', 'Last 90 Days'].map(d => <option key={d}>{d}</option>)}
          </select>
          <div style={s.exportWrap}>
          <button style={s.exportBtn} onClick={() => setShowExportMenu(current => !current)}>
            <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.download}</span>
            Export
          </button>
          {showExportMenu && (
            <div style={s.exportMenu}>
              <div style={s.exportMenuLabel}>Export report as</div>
              <button type="button" style={s.exportOption} onClick={() => { downloadAuditCsv(filtered); setShowExportMenu(false); }}>
                CSV
              </button>
              <button type="button" style={s.exportOption} onClick={() => { downloadAuditPdf(filtered); setShowExportMenu(false); }}>
                PDF
              </button>
            </div>
          )}
          </div>
        </div>

        {/* TABLE */}
        <div style={s.card}>
          {loadError && <div role="alert" style={{ color: '#b91c1c', marginBottom: 12 }}>{loadError}</div>}
          <div style={{ ...s.cardTitle, marginBottom: 16 }}>Activity Log ({filtered.length} entries)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Audit ID', 'Timestamp', 'User', 'Action', 'Description', 'Entity', 'IP Address', 'Actions'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => (
                  <tr key={log.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ ...s.td, fontFamily: 'monospace', color: '#64748b', fontSize: '.76rem' }}>{log.id}</td>
                    <td style={{ ...s.td, color: '#64748b', whiteSpace: 'nowrap', fontSize: '.78rem' }}>{formatDateTimeText(log.timestamp)}</td>
                    <td style={{ ...s.td, fontWeight: 500, color: '#0f1117', whiteSpace: 'nowrap' }}>{log.user}</td>
                    <td style={s.td}><ActionBadge action={log.action} /></td>
                    <td style={{ ...s.td, color: '#374151', maxWidth: 280 }}>{log.description}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace', color: '#64748b', fontSize: '.76rem', whiteSpace: 'nowrap' }}>{log.entity}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace', color: '#64748b', fontSize: '.76rem', whiteSpace: 'nowrap' }}>{log.ip}</td>
                    <td style={s.td}>
                      <button
                        style={s.detailsBtn}
                        onClick={() => setModal(log)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '.84rem' }}>
              No logs match your filters.
            </div>
          )}
        </div>

      </div>

      <DetailModal log={modal} onClose={() => setModal(null)} />
    </div>
  );
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f4f6f9' },
  page: { padding: '24px 22px 34px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  statCard: { background: '#fff', border: '1px solid #e1e6ec', borderRadius: 11, padding: '16px 20px' },
  statIcon: { width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statLabel: { fontSize: '.67rem', color: '#8aa0bd', marginBottom: 4 },
  statValue: { fontFamily: "'DM Sans', sans-serif", fontSize: '1.05rem', fontWeight: 700, color: '#111827', letterSpacing: '-.02em' },
  filterBar: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e1e6ec', borderRadius: 11, padding: '14px 20px', marginBottom: 20, flexWrap: 'wrap' },
  searchWrap: { flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', gap: 8, background: '#f1f2f5', border: 0, borderRadius: 7, padding: '8px 11px' },
  searchIcon: { width: 14, height: 14, display: 'flex', color: '#8aa0bd', flexShrink: 0 },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '.72rem', color: '#334155', width: '100%' },
  select: { minWidth: 145, padding: '8px 10px', border: 0, borderRadius: 7, fontSize: '.72rem', color: '#334155', background: '#f1f2f5', outline: 'none', cursor: 'pointer' },
  exportWrap: { position: 'relative' },
  exportBtn: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', background: '#fff', color: '#334155', border: '1px solid #dbe3ee', borderRadius: 7, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  exportMenu: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20, minWidth: 150, padding: 6, background: '#fff', border: '1px solid #dbe3ee', borderRadius: 8, boxShadow: '0 10px 24px rgba(15, 23, 42, .12)' },
  exportMenuLabel: { padding: '6px 8px 5px', fontSize: '.66rem', color: '#7185a2', fontWeight: 600 },
  exportOption: { display: 'block', width: '100%', padding: '8px', border: 0, borderRadius: 6, background: '#fff', color: '#334155', textAlign: 'left', fontSize: '.72rem', cursor: 'pointer' },
  card: { background: '#fff', border: '1px solid #e1e6ec', borderRadius: 11, padding: '20px 20px 10px' },
  cardTitle: { fontSize: '.78rem', fontWeight: 700, color: '#1e293b' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 900 },
  th: { textAlign: 'left', padding: '10px 7px', fontSize: '.68rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e5e9ee', whiteSpace: 'nowrap' },
  td: { padding: '8px 7px', fontSize: '.69rem', borderBottom: '1px solid #e5e9ee', verticalAlign: 'middle', color: '#334155' },
  detailsBtn: { padding: '6px 11px', background: '#fff', border: '1px solid #dbe3ee', borderRadius: 7, fontSize: '.68rem', fontWeight: 600, color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' },
};

const m = {
  panel: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 9, width: 600, maxWidth: 'calc(100vw - 32px)', zIndex: 101, boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 24px 0' },
  titleRow: { display: 'flex', alignItems: 'center', gap: 13 },
  actionBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, fontSize: '.72rem', fontWeight: 500, whiteSpace: 'nowrap' },
  headerTitle: { fontSize: '1.05rem', fontWeight: 700, color: '#172033' },
  headerSub: { fontSize: '.74rem', color: '#718096', marginTop: 8 },
  closeBtn: { background: 'none', border: '1px solid #b7bec8', cursor: 'pointer', padding: 3, borderRadius: 6, display: 'flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  body: { padding: '18px 24px 24px' },
  metaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 40, rowGap: 18 },
  field: { minWidth: 0 },
  fieldLabel: { fontSize: '.73rem', fontWeight: 600, color: '#7185a2', marginBottom: 6 },
  fieldValue: { fontSize: '.78rem', lineHeight: 1.4, color: '#172033', wordBreak: 'break-word' },
  stackedField: { marginTop: 18 },
  additionalDetails: { background: '#f5f7fa', borderRadius: 9, padding: '13px 12px', marginTop: 9 },
  detailLine: { display: 'grid', gridTemplateColumns: '128px 1fr', fontSize: '.75rem', lineHeight: 1.8, color: '#263348' },
  detailLabel: { fontWeight: 600, color: '#506480' },
};
