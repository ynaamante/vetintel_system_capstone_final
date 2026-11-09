import { jsPDF } from 'jspdf';
import { csvCell } from '../utils/billingView';
import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import StatusIndicator from '../components/StatusIndicator';
import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';
import { canInteractWithFeature } from '../utils/permissionUtils';

/* ── DATA ── */
const REPORT_CARDS = [
  {
    category: 'Disease Intelligence',
    title: 'Monthly Disease Summary',
    desc: 'Comprehensive overview of disease trends and patterns',
    lastGen: 'Not generated this session',
    size: '-',
    status: 'Ready',   // fresh | stale | outdated
  },
  {
    category: 'Risk Analysis',
    title: 'Risk Assessment Report',
    desc: 'Community-wide risk analysis and contributing factors',
    lastGen: 'Not generated this session',
    size: '-',
    status: 'Ready',
  },
  {
    category: 'Prevention',
    title: 'Vaccination Coverage Report',
    desc: 'Network vaccination rates and coverage gaps',
    lastGen: 'Not generated this session',
    size: '-',
    status: 'Ready',
  },
  {
    category: 'Surveillance',
    title: 'Outbreak Alert Summary',
    desc: 'All active and resolved outbreak alerts',
    lastGen: 'Not generated this session',
    size: '-',
    status: 'Ready',
  },
  {
    category: 'Network Health',
    title: 'Clinic Network Analysis',
    desc: 'Performance and participation metrics across network',
    lastGen: 'Not generated this session',
    size: '-',
    status: 'Ready',
  },
  {
    category: 'Executive',
    title: 'Quarterly Intelligence Brief',
    desc: 'Executive summary of key trends and insights',
    lastGen: 'Not generated this session',
    size: '-',
    status: 'Ready',
  },
];

const REPORT_TYPES  = ['Disease Summary', 'Risk Assessment', 'Vaccination Coverage', 'Outbreak Alert', 'Clinic Network', 'Quarterly Brief'];

const TIME_OPTS = ['Last 30 Days', 'Last 60 Days', 'Last 90 Days'];
const FORMAT_OPTS = ['PDF', 'CSV'];



/* ── MAIN PAGE ── */
export function ReportsPage({ user }) {
  const [reportType, setReportType] = useState('Disease Summary');
  const [disease,    setDisease]    = useState('All Diseases');
  const [timeRange,  setTimeRange]  = useState('Last 30 Days');
  const [format,     setFormat]     = useState('PDF');
  const [generating, setGenerating] = useState(null);
  const [RECENT_REPORTS, setReports] = useState([]);
  const [error, setError] = useState('');
  const [DISEASE_OPTS, setDiseaseOptions] = useState(['All Diseases']);

  const canView = canViewFeature(user.permissions, user.role, 'Reports');
  const canGenerateReport = canInteractWithFeature(user.permissions, user.role, 'Reports');
  const canBuildCustomReport = canInteractWithFeature(user.permissions, user.role, 'Reports');
  const canManageReportActions = canInteractWithFeature(user.permissions, user.role, 'Reports');

  useEffect(() => {
    if (!canView) return;
    const controller = new AbortController();
    const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    fetch(api + '/owner-monitoring/report?days=90', { headers: { Authorization: 'Bearer ' + user.token }, signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load report options.'); if (!controller.signal.aborted) setDiseaseOptions(['All Diseases', ...(data.disease_options || []).map(row => row.disease)]); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [canView, user.token, user.clinic_id]);
  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  async function handleGenerate(title) {
    if (!canGenerateReport || generating) return;
    setGenerating(title); setError('');
    try {
      const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const query = new URLSearchParams({ days: String(parseInt(timeRange.match(/\d+/)?.[0] || '30', 10)) });
      if (disease !== 'All Diseases') query.set('disease', disease);
      const response = await fetch(api + '/owner-monitoring/report?' + query, { headers: { Authorization: 'Bearer ' + user.token } });
      const summary = await response.json();
      if (!response.ok) throw new Error(summary.error || 'Unable to load report data.');
      const riskReport = /risk/i.test(title);
      const vaccineReport = /vaccin/i.test(title);
      const clinicReport = /clinic|network/i.test(title);
      const alertReport = /outbreak|alert/i.test(title);
      const source = riskReport ? summary.risk_distribution : vaccineReport ? summary.vaccination_trend : clinicReport ? summary.clinics : alertReport ? (summary.diseases || []).filter(row => Number(row.cases) >= 3 && Number(row.cases) > Number(row.previous_cases) * 1.4) : summary.diseases;
      const entries = source || [];
      const columns = [...new Set(entries.flatMap(row => Object.keys(row)))];
      const rows = [[title], ['Clinic', summary.clinic_id], ['Generated', summary.generated_at], ['Period', timeRange], ['Disease', disease], [], columns, ...entries.map(row => columns.map(key => row[key]))];
      if (!entries.length) rows.push(['No recorded data for these filters.']);
      if (alertReport) rows.push(['Alerts are calculated from recorded case increases, not confirmed outbreaks.']);
      let blob;
      if (format === 'CSV') blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      else {
        const doc = new jsPDF({ orientation: 'landscape' }); let y = 16;
        doc.setFontSize(9);
        for (const row of rows) {
          const lines = doc.splitTextToSize(row.join(' | '), 265);
          for (const line of lines) { if (y > 190) { doc.addPage(); y = 16; } doc.text(line, 14, y); y += 6; }
        }
        blob = doc.output('blob');
      }
      const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.' + format.toLowerCase();
      download(blob, filename);
      setReports(previous => [{ name: title, type: format, date: new Date(summary.generated_at).toLocaleString('en-PH'), size: (blob.size / 1024).toFixed(1) + ' KB', blob, filename }, ...previous]);
    } catch (failure) { setError(failure.message); } finally { setGenerating(null); }
  }

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Reports" subtitle="Generate and manage custom reports" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.95rem' }}>You don't have permission to view this feature</div>
        </div>
      </div>
    );
  }

  const previewText = `${reportType} report for ${disease} for your clinic - ${timeRange} (${format})`;

  return (
    <div style={s.main}>
      <Topbar
        user={user}
        title="Reports"
        subtitle="Generate and manage intelligence reports"
      />
      <div style={s.page}>
        {error && <p role="alert">{error}</p>}

        {/* REPORT CARDS GRID */}
        <div style={s.grid}>
          {REPORT_CARDS.map((r, i) => (
            <div key={i} style={s.reportCard}>
              <div style={s.reportTop}>
                <span style={s.categoryTag}>{r.category}</span>
              </div>
              <div style={s.reportTitle}>{r.title}</div>
              <div style={s.reportDesc}>{r.desc}</div>
              <div style={s.reportMeta}>
                <StatusIndicator status={RECENT_REPORTS.some(row => row.name === r.title) ? 'Generated' : 'Ready'} />
                <span style={s.metaText}>Last generated: {RECENT_REPORTS.find(row => row.name === r.title)?.date || 'Not generated this session'}</span>
              </div>
              <div style={s.reportSize}>Size: {RECENT_REPORTS.find(row => row.name === r.title)?.size || '-'}</div>
              <button
                style={{
                  ...s.generateBtn,
                  opacity: !canGenerateReport ? 0.45 : generating === r.title ? 0.7 : 1,
                  cursor: canGenerateReport ? 'pointer' : 'not-allowed',
                }}
                onClick={() => handleGenerate(r.title)}
                disabled={!canGenerateReport || !!generating}
              >
                <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.file}</span>
                {generating === r.title ? 'Generating…' : 'Generate Report'}
              </button>
            </div>
          ))}
        </div>

        {/* CUSTOM REPORT BUILDER */}
        <div style={s.card}>
          <div style={s.cardTitle}>Custom Report Builder</div>
          <div style={s.cardDesc}>Create a customized report with specific parameters</div>

          <div style={s.builderRow}>
            <select
              disabled={!canBuildCustomReport}
              style={{
                ...s.select,
                background: canBuildCustomReport ? '#f1f6ef' : '#f8fafc',
                color: canBuildCustomReport ? '#0f1117' : '#64748b',
                cursor: canBuildCustomReport ? 'pointer' : 'not-allowed',
              }}
              value={reportType}
              onChange={e => setReportType(e.target.value)}
            >
              {REPORT_TYPES.map(r => <option key={r}>{r}</option>)}
            </select>
            <select
              disabled={!canBuildCustomReport}
              style={{
                ...s.select,
                background: canBuildCustomReport ? '#f1f6ef' : '#f8fafc',
                color: canBuildCustomReport ? '#0f1117' : '#64748b',
                cursor: canBuildCustomReport ? 'pointer' : 'not-allowed',
              }}
              value={disease}
              onChange={e => setDisease(e.target.value)}
            >
              {DISEASE_OPTS.map(d => <option key={d}>{d}</option>)}
            </select>
            <select
              disabled={!canBuildCustomReport}
              style={{
                ...s.select,
                background: canBuildCustomReport ? '#f1f6ef' : '#f8fafc',
                color: canBuildCustomReport ? '#0f1117' : '#64748b',
                cursor: canBuildCustomReport ? 'pointer' : 'not-allowed',
              }}
              value={timeRange}
              onChange={e => setTimeRange(e.target.value)}
            >
              {TIME_OPTS.map(t => <option key={t}>{t}</option>)}
            </select>
            <select
              disabled={!canBuildCustomReport}
              style={{
                ...s.select,
                background: canBuildCustomReport ? '#f1f6ef' : '#f8fafc',
                color: canBuildCustomReport ? '#0f1117' : '#64748b',
                cursor: canBuildCustomReport ? 'pointer' : 'not-allowed',
              }}
              value={format}
              onChange={e => setFormat(e.target.value)}
            >
              {FORMAT_OPTS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>

          <div style={s.previewBox}>
            <div style={s.previewLabel}>Live Preview</div>
            <div style={s.previewText}>{previewText}</div>
          </div>

          <button
            style={{
              ...s.buildBtn,
              opacity: canBuildCustomReport ? 1 : 0.65,
              background: canBuildCustomReport ? '#0f1117' : '#f8fafc',
              color: canBuildCustomReport ? '#fff' : '#64748b',
              border: canBuildCustomReport ? 'none' : '1px solid #cbd5e1',
              cursor: canBuildCustomReport ? 'pointer' : 'not-allowed',
            }}
            disabled={!canBuildCustomReport || !!generating} onClick={() => handleGenerate(reportType)}
          >
            Build Custom Report
          </button>
        </div>

        {/* RECENT REPORTS */}
        <div style={s.card}>
          <div style={{ ...s.cardTitle, marginBottom: 16 }}>Recent Reports (this session)</div>
          <div style={s.tableHead}>
            {['Report Name', 'Type', 'Generated Date', 'File Size', 'Actions'].map(h => (
              <div key={h} style={s.th}>{h}</div>
            ))}
          </div>
          {!RECENT_REPORTS.length && <p>No reports generated this session.</p>}
          {RECENT_REPORTS.map((r, i) => (
            <div key={i} style={{
              ...s.tableRow,
              borderBottom: i < RECENT_REPORTS.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div style={{ ...s.td, fontWeight: 500, color: '#0f1117', fontSize: '.82rem' }}>{r.name}</div>
              <div style={s.td}>
                <span style={{
                  ...s.typeBadge,
                  background: r.type === 'PDF' ? '#0f1117' : '#139b76',
                }}>
                  {r.type}
                </span>
              </div>
              <div style={{ ...s.td, color: '#64748b', fontSize: '.78rem' }}>{r.date}</div>
              <div style={{ ...s.td, color: '#64748b', fontSize: '.78rem' }}>{r.size}</div>
              <div style={{ ...s.td, gap: 12 }}>
                <button type="button" onClick={() => download(r.blob, r.filename)} disabled={!canManageReportActions}>Download</button>
                
                <button type="button" onClick={() => setReports(rows => rows.filter(item => item !== r))} disabled={!canManageReportActions}>Remove</button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f1f6ef' },
  page: { padding: '24px 28px' },

  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 14, marginBottom: 16,
  },
  reportCard: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '20px 20px',
    display: 'flex', flexDirection: 'column',
  },
  reportTop:    { marginBottom: 10 },
  categoryTag: {
    display: 'inline-block', fontSize: '.67rem', fontWeight: 600,
    color: '#64748b', background: '#f1f6ef',
    border: '1px solid #e8ecf0', borderRadius: 6,
    padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '.05em',
  },
  reportTitle: { fontSize: '.9rem', fontWeight: 600, color: '#0f1117', marginBottom: 6, letterSpacing: '-.01em' },
  reportDesc:  { fontSize: '.75rem', color: '#64748b', lineHeight: 1.5, marginBottom: 14, flex: 1 },
  reportMeta:  { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  statusDot:   { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  metaText:    { fontSize: '.72rem', color: '#64748b' },
  reportSize:  { fontSize: '.7rem', color: '#64748b', marginBottom: 14 },
  generateBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '9px 0', background: '#fff',
    border: '1px solid #e8ecf0', borderRadius: 9,
    fontSize: '.8rem', fontWeight: 500, color: '#0f1117',
    cursor: 'pointer', width: '100%', transition: 'background .12s',
  },

  card: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '20px 22px', marginBottom: 16,
  },
  cardTitle: { fontSize: '.88rem', fontWeight: 600, color: '#0f1117', letterSpacing: '-.01em', marginBottom: 4 },
  cardDesc:  { fontSize: '.73rem', color: '#64748b', marginBottom: 18 },

  builderRow: { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  select: {
    flex: 1, minWidth: 140,
    padding: '9px 12px', border: '1px solid #e8ecf0', borderRadius: 8,
    fontSize: '.82rem', color: '#0f1117', background: '#f1f6ef',
    outline: 'none', cursor: 'pointer',
  },
  previewBox: {
    background: '#f1f6ef', border: '1px solid #e8ecf0',
    borderRadius: 8, padding: '12px 16px', marginBottom: 14,
  },
  previewLabel: { fontSize: '.7rem', fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' },
  previewText:  { fontSize: '.82rem', color: '#64748b' },
  buildBtn: {
    width: '100%', padding: '11px 0',
    background: '#0f1117', color: '#fff',
    border: 'none', borderRadius: 9,
    fontSize: '.84rem', fontWeight: 500, cursor: 'pointer',
  },

  tableHead: {
    display: 'grid', gridTemplateColumns: '1fr 80px 160px 100px 100px',
    paddingBottom: 10, borderBottom: '1px solid #f1f5f9', gap: 12,
  },
  th: { fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' },
  tableRow: {
    display: 'grid', gridTemplateColumns: '1fr 80px 160px 100px 100px',
    padding: '14px 0', alignItems: 'center', gap: 12,
  },
  td: { display: 'flex', alignItems: 'center' },
  typeBadge: {
    display: 'inline-block', padding: '2px 10px',
    color: '#fff', fontSize: '.7rem', fontWeight: 700,
    borderRadius: 5, letterSpacing: '.04em',
  },
};
