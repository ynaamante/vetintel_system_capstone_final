import { useState } from 'react';
import { jsPDF } from 'jspdf';
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

const TREND_DATA = [
  { month: 'Sep', revenue: 20200, expenses: 12400, profit: 7800 },
  { month: 'Oct', revenue: 21000, expenses: 12800, profit: 8200 },
  { month: 'Nov', revenue: 20600, expenses: 12200, profit: 8400 },
  { month: 'Dec', revenue: 21400, expenses: 13100, profit: 8300 },
  { month: 'Jan', revenue: 23100, expenses: 13500, profit: 9600 },
  { month: 'Feb', revenue: 26300, expenses: 14200, profit: 12100 },
];

const SERVICE_DATA = [
  { service: 'Checkups', revenue: 8200 },
  { service: 'Vaccinations', revenue: 6400 },
  { service: 'Surgeries', revenue: 13500 },
  { service: 'Dental', revenue: 4100 },
  { service: 'Emergency', revenue: 3800 },
];

const TRANSACTIONS = [
  { id: 'TXN-1245', date: '2026-04-27', service: 'Surgery - Max', amount: 450, status: 'Completed' },
  { id: 'TXN-1244', date: '2026-04-27', service: 'Vaccination - Luna', amount: 85, status: 'Completed' },
  { id: 'TXN-1243', date: '2026-04-26', service: 'Checkup - Charlie', amount: 120, status: 'Completed' },
  { id: 'TXN-1242', date: '2026-04-26', service: 'Dental - Bella', amount: 280, status: 'Completed' },
  { id: 'TXN-1241', date: '2026-04-25', service: 'Emergency - Rocky', amount: 520, status: 'Completed' },
];

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
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

export default function FinancialMonitoringPage({ user }) {
  const [period, setPeriod] = useState('Monthly');
  const [exportFormat, setExportFormat] = useState('csv');

  const canView = canViewFeature(user.permissions, user.role, 'Financial Monitoring');
  const reportFileName = `financial-monitoring-${period.toLowerCase()}`;
  const pdfPesoFormatter = value => `PHP ${Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

  const exportCsv = () => {
    const rows = [
      ['Financial Monitoring Report', ''],
      ['Period', period],
      [''],
      ['Revenue Trend', '', '', ''],
      ['Month', 'Revenue', 'Expenses', 'Profit'],
      ...TREND_DATA.map(row => [row.month, row.revenue, row.expenses, row.profit]),
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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    const drawHeader = () => {
      doc.setFillColor(15, 17, 23);
      doc.rect(0, 0, pageWidth, 39, 'F');
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 35, pageWidth, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(19);
      doc.text('VetIntel', margin, 17);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text('ADMINISTRATION & INSIGHTS', margin, 25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('Financial Monitoring Report', pageWidth - margin, 18, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text(`${period} overview`, pageWidth - margin, 26, { align: 'right' });
    };

    const ensureSpace = (height) => {
      if (y + height > pageHeight - 18) {
        doc.addPage();
        drawHeader();
        y = 50;
      }
    };

    const sectionTitle = (title) => {
      ensureSpace(18);
      doc.setTextColor(15, 17, 23);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(title, margin, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 4, pageWidth - margin, y + 4);
      y += 13;
    };

    const drawTable = (headers, rows, widths) => {
      const rowHeight = 8;
      ensureSpace(rowHeight * (rows.length + 1) + 8);
      doc.setFillColor(239, 246, 255);
      doc.rect(margin, y - 5, contentWidth, rowHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 64, 175);
      let x = margin + 3;
      headers.forEach((header, index) => {
        doc.text(header, x, y);
        x += widths[index];
      });
      y += rowHeight;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      rows.forEach((row, rowIndex) => {
        if (rowIndex % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 5, contentWidth, rowHeight, 'F');
        }
        x = margin + 3;
        row.forEach((value, index) => {
          const text = String(value);
          doc.text(text.length > 30 ? `${text.slice(0, 27)}...` : text, x, y);
          x += widths[index];
        });
        y += rowHeight;
      });
      y += 5;
    };

    drawHeader();
    y = 52;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated ${formatDateText(new Date(), 'en-PH')}`, pageWidth - margin, y, { align: 'right' });
    y += 12;

    sectionTitle('Financial Summary');
    const summary = [
      ['Today\'s Income', pdfPesoFormatter(2450), 'Monthly Income', pdfPesoFormatter(26300)],
      ['Yearly Income', pdfPesoFormatter(142700), 'Profit Margin', '63.9%'],
    ];
    summary.forEach((row) => {
      ensureSpace(16);
      const boxWidth = (contentWidth - 8) / 2;
      [0, 2].forEach((index, boxIndex) => {
        const x = margin + boxIndex * (boxWidth + 8);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y - 5, boxWidth, 14, 2, 2, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(row[index], x + 4, y + 1);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 17, 23);
        doc.text(row[index + 1], x + boxWidth - 4, y + 1, { align: 'right' });
      });
      y += 18;
    });

    sectionTitle('Revenue, Expenses & Profit Trend');
    drawTable(
      ['Month', 'Revenue', 'Expenses', 'Profit'],
      TREND_DATA.map(row => [row.month, pdfPesoFormatter(row.revenue), pdfPesoFormatter(row.expenses), pdfPesoFormatter(row.profit)]),
      [35, 47, 47, 47],
    );
    sectionTitle('Revenue by Service Type');
    drawTable(
      ['Service', 'Revenue'],
      SERVICE_DATA.map(row => [row.service, pdfPesoFormatter(row.revenue)]),
      [110, 113],
    );
    sectionTitle('Recent Transactions');
    drawTable(
      ['Transaction ID', 'Date', 'Service', 'Amount', 'Status'],
      TRANSACTIONS.map(row => [row.id, row.date, row.service, pdfPesoFormatter(row.amount), row.status]),
      [34, 29, 61, 35, 34],
    );

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('VetIntel Admin', margin, pageHeight - 6);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }
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

        {/* PERIOD + EXPORT */}
        <div style={s.toolbar}>
          <div>
            <div style={s.toolbarTitle}>Financial overview</div>
            <div style={s.toolbarSubtitle}>Review income, expenses, and profit performance.</div>
          </div>
          <div style={s.exportGroup}>
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
            <button type="button" style={s.exportBtn} onClick={exportReport}>
              <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.file}</span>
              Export {exportFormat.toUpperCase()}
            </button>
          </div>
        </div>

        {/* STAT CARDS */}
        <div style={s.statsGrid}>
          {[
            ['Today\'s Income', '₱2,450', '↗ +15% vs yesterday', '#f0fdf4', '#16a34a', Icons.dollar],
            ['Monthly Income', '₱26,300', '↗ +19% vs last month', '#e7f5f2', '#005447', Icons.calendar],
            ['Yearly Income', '₱142,700', '↗ +12% vs last year', '#faf5ff', '#7c3aed', Icons.file],
            ['Profit Margin', '63.9%', '↗ +2.1% this month', '#fffbeb', '#d97706', Icons.dollar],
          ].map(([label, value, sub, iconBg, color, icon]) => (
            <div style={s.statCard} key={label}>
              <div style={{ ...s.statIcon, background: iconBg, color }}>
                <span style={{ width: 18, height: 18, display: 'flex', color }}>{icon}</span>
              </div>
              <div style={s.statContent}>
                <div style={s.statLabel}>{label}</div>
                <div style={{ ...s.statValue, color }}>{value}</div>
                <div style={{ ...s.statSub, color: '#64748b' }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* REVENUE TREND CHART */}
        <div style={s.chartGrid}>
          <div style={{ ...s.card, marginBottom: 0 }}>
            <div style={s.cardHeader}>
              <div>
                <div style={s.cardTitle}>Revenue, Expenses & Profit Trend</div>
                <div style={s.cardDescription}>Monthly financial performance</div>
              </div>
              <span style={s.periodBadge}>{period}</span>
            </div>
            <ResponsiveContainer width="100%" height={275}>
              <LineChart data={TREND_DATA} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#dbe3ee" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#94a3b8' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#94a3b8' }} tickLine={false} />
                <Tooltip content={<TrendTooltip />} />
                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: '.72rem', color: '#64748b' }}>{v.charAt(0).toUpperCase() + v.slice(1)}</span>} />
                <Line type="monotone" dataKey="revenue" stroke="#139b76" strokeWidth={2} dot={{ r: 3, fill: '#139b76', strokeWidth: 0 }} activeDot={{ r: 5 }} name="revenue" />
                <Line type="monotone" dataKey="expenses" stroke="#f87171" strokeWidth={2} dot={{ r: 3, fill: '#f87171', strokeWidth: 0 }} activeDot={{ r: 5 }} name="expenses" />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} name="profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...s.card, marginBottom: 0 }}>
            <div style={s.cardHeader}>
              <div>
                <div style={s.cardTitle}>Revenue by Service Type</div>
                <div style={s.cardDescription}>Income contribution by service</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={275}>
              <BarChart data={SERVICE_DATA} barSize={36} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#dbe3ee" />
                <XAxis dataKey="service" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#94a3b8' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#94a3b8' }} tickLine={false} />
                <Tooltip content={<ServiceTooltip />} />
                <Bar dataKey="revenue" fill="#7c3aed" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TRANSACTIONS TABLE */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <div style={s.cardTitle}>Recent Transactions</div>
              <div style={s.cardDescription}>Latest completed financial activity</div>
            </div>
            <span style={s.transactionCount}>{TRANSACTIONS.length} transactions</span>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                {['Transaction ID', 'Date', 'Service', 'Amount', 'Status'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRANSACTIONS.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...s.td, fontFamily: 'monospace', color: '#64748b', fontSize: '.78rem' }}>{t.id}</td>
                  <td style={{ ...s.td, color: '#64748b' }}>{formatDateText(t.date)}</td>
                  <td style={{ ...s.td, color: '#0f1117', fontWeight: 500 }}>{t.service}</td>
                  <td style={{ ...s.td, color: '#16a34a', fontWeight: 600 }}>{pesoFormatter.format(t.amount)}</td>
                  <td style={s.td}><StatusIndicator status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

const s = {
  main: { minWidth: 0, flex: 1, overflowY: 'auto', background: '#f8fafc' },
  page: { padding: '24px 34px 48px', maxWidth: 1500, margin: '0 auto' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 20 },
  statCard: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' },
  statIcon: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statContent: { minWidth: 0 },
  statLabel: { fontSize: '.73rem', color: '#64748b', marginBottom: 4, whiteSpace: 'nowrap' },
  statValue: { fontFamily: "'DM Sans', sans-serif", fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.1 },
  statSub: { fontSize: '.68rem', marginTop: 6, whiteSpace: 'nowrap' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 16 },
  toolbarTitle: { color: '#0f172a', fontSize: '.95rem', fontWeight: 600 },
  toolbarSubtitle: { color: '#64748b', fontSize: '.74rem', marginTop: 3 },
  select: { padding: '8px 12px', border: '1px solid #dbe3ee', borderRadius: 8, fontSize: '.78rem', color: '#0f1117', background: '#f8fafc', outline: 'none', cursor: 'pointer' },
  exportGroup: { display: 'flex', alignItems: 'stretch', gap: 6 },
  exportSelect: { padding: '0 8px', border: '1px solid #dbe3ee', borderRadius: 8, fontSize: '.78rem', color: '#005447', background: '#e7f5f2', outline: 'none', cursor: 'pointer', fontWeight: 600 },
  exportBtn: { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: '#0f1117', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer' },
  chartGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(320px, 1fr)', gap: 20, marginBottom: 20 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px', marginBottom: 20 },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  cardTitle: { fontSize: '.88rem', fontWeight: 600, color: '#0f1117', letterSpacing: '-.01em' },
  cardDescription: { fontSize: '.72rem', color: '#94a3b8', marginTop: 4 },
  periodBadge: { padding: '4px 9px', borderRadius: 6, background: '#e7f5f2', color: '#005447', fontSize: '.68rem', fontWeight: 600 },
  transactionCount: { color: '#64748b', fontSize: '.72rem', paddingTop: 2 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '.7rem', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '12px', fontSize: '.78rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
};
