import useOwnerMonitoring from '../utils/useOwnerMonitoring';
import { financialData, money } from '../utils/ownerMonitoring';
import { useState } from 'react';
import './summaryStats.css';
import { createFinancialMonitoringPdf } from '../utils/financialMonitoringPdf';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import Topbar from '../components/Topbar';
import StatusIndicator from '../components/StatusIndicator';
import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';
import { formatDateText } from '../utils/dateFormatting';



const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 8, padding: '8px 12px', fontSize: '.75rem', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
      <div style={{ color: '#64748b', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {pesoFormatter.format(p.value)}
        </div>
      ))}
    </div>
  );
};

const ServiceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 8, padding: '8px 12px', fontSize: '.75rem', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
      <div style={{ color: '#64748b', marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 600, color: '#0f1117' }}>{pesoFormatter.format(payload[0].value)}</div>
    </div>
  );
};

export default function FinancialMonitoringPage({ user, onNavigate }) {
  const [period, setPeriod] = useState('Monthly');
  const [exportFormat, setExportFormat] = useState('csv');

  const canView = canViewFeature(user.permissions, user.role, 'Financial Monitoring');
  const { data, error, loading } = useOwnerMonitoring(user, canView);
  const financial = financialData(data, period);
  const TREND_DATA = financial.trend;
  const SERVICE_DATA = financial.services;
  const TRANSACTIONS = financial.transactions;
  const reportFileName = `financial-monitoring-${period.toLowerCase()}`;

  const exportCsv = () => {
    const rows = [
      ['Financial Monitoring Report', ''],
      ['Period', period],
      [''],
      ['Revenue Trend', '', '', ''],
      ['Period', 'Revenue'],
      ...TREND_DATA.map(row => [row.month, row.revenue]),
      [''],
      ['Revenue by Service Type', ''],
      ['Service', 'Revenue'],
      ...SERVICE_DATA.map(row => [row.service, row.revenue]),
      [''],
      ['Recent Transactions', '', '', '', ''],
      ['Transaction ID', 'Date', 'Service', 'Amount', 'Status'],
      ...TRANSACTIONS.map(row => [row.id, row.date, row.service, row.amount, row.status]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportFileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = createFinancialMonitoringPdf({ user, data, financial, period });
    doc.save(`${reportFileName}.pdf`);
  };

  const exportReport = () => {
    if (exportFormat === 'pdf') {
      exportPdf();
      return;
    }
    exportCsv();
  };

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Financial Monitoring" subtitle="Track income, expenses, and revenue analytics" />
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
      <Topbar user={user} title="Financial Monitoring" subtitle="Track income, expenses, and revenue analytics" />
      <div style={s.page}>
        {error && <p role="alert">{error}</p>}

        <section className="financial-overview-panel">
        {/* PERIOD + EXPORT */}
        <div className="financial-overview-header" style={s.toolbar}>
          <div>
            <div style={s.toolbarTitle}>Financial Overview</div>
            <div style={s.toolbarSubtitle}>Review income, expenses, and profit performance.</div>
          </div>
          <div className="financial-export-group" style={s.exportGroup}>
            <select style={s.select} value={period} onChange={e => setPeriod(e.target.value)}>
              {['Monthly', 'Quarterly', 'Yearly'].map(p => <option key={p}>{p}</option>)}
            </select>
            <select
              aria-label="Export format"
              style={s.exportSelect}
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value)}
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button type="button" style={s.exportBtn} onClick={exportReport} disabled={loading || !!error || !data}>
              <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.file}</span>
              Export {exportFormat.toUpperCase()}
            </button>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="overview-stats-band" style={s.statsGrid}>
          {[
            ["Today's Income", data ? money(financial.today) : '-', 'Recorded payments today'],
            ['Monthly Income', data ? money(financial.monthly) : '-', 'Recorded payments this month'],
            ['Yearly Income', data ? money(financial.yearly) : '-', 'Recorded payments this year'],
            ['Outstanding', data ? money(financial.outstanding) : '-', 'Unpaid invoice balances'],
          ].map(([label, value, sub], index) => (
            <article className="overview-stats-cell" style={index ? s.statDivider : undefined} key={label}>
              <div className="overview-stats-label">{label}</div>
              <strong className="overview-stats-value">{value}</strong>
              <small className="overview-stats-note">{sub}</small>
            </article>
          ))}
        </div>
        </section>

        {['owner', 'clinic_owner'].includes(String(user.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_')) && <section className="financial-payment-qr financial-payment-qr-card">
          <div className="financial-payment-qr-content">
            <span className="financial-payment-qr-icon" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.8"><path d="M4 4h12v12H4zM24 4h12v12H24zM4 24h12v12H4z"/><path d="M8 8h4v4H8zM28 8h4v4h-4zM8 28h4v4H8zM24 24h5v5h-5zM33 24h3v3h-3zM31 31h5v5h-5zM24 33h4v3h-4z" fill="currentColor" stroke="none"/></svg></span>
            <span className="financial-payment-qr-copy"><strong>Manage Payment QR Codes</strong><small>View, update, or add your clinic's payment QR code.</small></span>
            <button type="button" className="financial-payment-qr-cta" onClick={() => onNavigate?.('payment-qr-settings')}>Manage {Icons.chevronRight}</button>
          </div>
        </section>}

        {/* REVENUE TREND CHART */}
        <div className="financial-dashboard-charts" style={s.chartGrid}>
          <div className="financial-dashboard-chart-card" style={{ ...s.card, marginBottom: 0, padding: '12px 16px 10px', borderColor: '#d7e5dd', borderRadius: 11, background: 'linear-gradient(120deg, #fff 40%, #fbfdfb)' }}>
            <div style={s.cardHeader}>
              <div>
                <div className="financial-dashboard-chart-title" style={s.cardTitle}>Recorded Payment Trend</div>
                <div className="financial-dashboard-chart-description" style={s.cardDescription}>Payments for the selected calendar period</div>
              </div>
              <span style={s.periodBadge}>{period}</span>
            </div>
            <div className="financial-dashboard-chart"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={TREND_DATA} margin={{ top: 15, right: 18, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#e8eee9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#29483c' }} axisLine={{ stroke: '#bcc9c0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#40564b' }} axisLine={{ stroke: '#bcc9c0' }} tickLine={false} />
                <Tooltip content={<TrendTooltip />} />
                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: '.72rem', color: '#64748b' }}>{v.charAt(0).toUpperCase() + v.slice(1)}</span>} />
                <Line type="linear" dataKey="revenue" stroke="#00731c" strokeWidth={2.4} dot={{ r: 3, fill: '#fff', stroke: '#00731c', strokeWidth: 2 }} activeDot={{ r: 5 }} name="revenue" />
              </LineChart>
            </ResponsiveContainer></div>
          </div>
          <div className="financial-dashboard-chart-card" style={{ ...s.card, marginBottom: 0, padding: '12px 16px 10px', borderColor: '#d7e5dd', borderRadius: 11, background: 'linear-gradient(120deg, #fff 40%, #fbfdfb)' }}>
            <div style={s.cardHeader}>
              <div>
                <div className="financial-dashboard-chart-title" style={s.cardTitle}>Revenue by Service Type</div>
                <div className="financial-dashboard-chart-description" style={s.cardDescription}>Income contribution by service</div>
              </div>
            </div>
            <div className="financial-dashboard-chart"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={SERVICE_DATA} barSize={36} margin={{ top: 15, right: 18, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#e8eee9" />
                <XAxis dataKey="service" tick={{ fontSize: 11, fill: '#29483c' }} axisLine={{ stroke: '#bcc9c0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#40564b' }} axisLine={{ stroke: '#bcc9c0' }} tickLine={false} />
                <Tooltip content={<ServiceTooltip />} />
                <Bar dataKey="revenue" fill="#00731c" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          </div>
        </div>

        {/* TRANSACTIONS TABLE */}
        <div className="financial-transactions-panel" style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <div style={s.cardTitle}>Recent Transactions</div>
              <div style={s.cardDescription}>Latest completed financial activity</div>
            </div>
            <span style={s.transactionCount}>{TRANSACTIONS.length} transactions</span>
          </div>
          <div className="financial-dashboard-table-wrap"><table className="financial-dashboard-table" style={s.table}>
            <thead>
              <tr>
                {['Transaction ID', 'Date', 'Service', 'Amount', 'Status'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && !TRANSACTIONS.length && <tr><td colSpan="5" style={s.td}>No payments recorded for this period.</td></tr>}
              {TRANSACTIONS.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...s.td, fontFamily: 'monospace', color: '#64748b', fontSize: '.78rem' }}>{t.id}</td>
                  <td style={{ ...s.td, color: '#64748b' }}>{formatDateText(t.date)}</td>
                  <td style={{ ...s.td, color: '#0f1117', fontWeight: 500 }}>{t.service}</td>
                  <td style={{ ...s.td, color: 'var(--success)', fontWeight: 600 }}>{pesoFormatter.format(t.amount)}</td>
                  <td style={s.td}><StatusIndicator status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>

      </div>
    </div>
  );
}

const s = {
  main: { minWidth: 0, flex: 1, overflowY: 'auto', background: '#f8fafc' },
  page: { padding: '24px 34px 48px', maxWidth: 1500, margin: '0 auto' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 0, marginBottom: 20 },
  statDivider: { borderLeft: '1px solid #c5d8cb' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 16 },
  toolbarTitle: { color: '#0f172a', fontSize: '.95rem', fontWeight: 600 },
  toolbarSubtitle: { color: '#64748b', fontSize: '.74rem', marginTop: 3 },
  select: { padding: '8px 12px', border: '1px solid #dbe3ee', borderRadius: 8, fontSize: '.78rem', color: '#0f1117', background: '#f8fafc', outline: 'none', cursor: 'pointer' },
  exportGroup: { display: 'flex', alignItems: 'stretch', gap: 6 },
  exportSelect: { padding: '0 8px', border: '1px solid #dbe3ee', borderRadius: 8, fontSize: '.78rem', color: 'var(--ink)', background: 'var(--primary-soft)', outline: 'none', cursor: 'pointer', fontWeight: 600 },
  exportBtn: { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: '#087341', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer' },
  chartGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.03fr) minmax(0, 1fr)', gap: 10, marginBottom: 10 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px', marginBottom: 20 },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  cardTitle: { fontSize: '.88rem', fontWeight: 600, color: '#0f1117', letterSpacing: '-.01em' },
  cardDescription: { fontSize: '.72rem', color: '#94a3b8', marginTop: 4 },
  periodBadge: { padding: '4px 9px', borderRadius: 6, background: 'var(--primary-soft)', color: 'var(--ink)', fontSize: '.68rem', fontWeight: 600 },
  transactionCount: { color: '#64748b', fontSize: '.72rem', paddingTop: 2 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '.7rem', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '12px', fontSize: '.78rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
};
