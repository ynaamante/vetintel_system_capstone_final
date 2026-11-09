import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';
import Topbar from '../components/Topbar';
import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';
import { formatDateText } from '../utils/dateFormatting';

/* â”€â”€ DATA â”€â”€ */
const TIME_OPTIONS = ['Last 30 Days', 'Last 60 Days', 'Last 90 Days'];

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={tt.box}>
      <div style={tt.label}>{label || payload[0].name}</div>
      <div style={tt.val}>{payload[0].value} cases</div>
    </div>
  );
};

const StackedTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={tt.box}>
      <div style={{ ...tt.label, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
          <span style={{ fontSize: '.73rem', color: '#64748b' }}>{p.name}:</span>
          <span style={{ fontSize: '.73rem', fontWeight: 600, color: '#0f1117' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* â”€â”€ MAIN PAGE â”€â”€ */
export function RiskMonitoringPage({ user }) {
  const [disease, setDisease] = useState('All Diseases');
  const [clinic, setClinic] = useState('all');
  const [timeRange, setTimeRange] = useState('Last 30 Days');
  const [summary, setSummary] = useState(null);
  const [clinicOptions, setClinicOptions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const days = Number.parseInt(timeRange.match(/\d+/)?.[0] || '30', 10);
  const canView = canViewFeature(user.permissions, user.role, 'Risk Monitoring');

  useEffect(() => {
    if (!user?.token) { setError('Sign in to load recorded risk data.'); setLoading(false); return undefined; }
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const query = new URLSearchParams({ days: String(days) });
    if (disease !== 'All Diseases') query.set('disease', disease);
    if (clinic !== 'all') query.set('clinic_id', clinic);
    setLoading(true);
    fetch(`${apiUrl}/disease-intelligence/summary?${query}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Unable to load risk data (HTTP ${response.status}).`);
        setSummary(payload);
        if (clinic === 'all') setClinicOptions(payload.clinics || []);
        setError('');
      }).catch(loadError => { if (loadError.name !== 'AbortError') setError(loadError.message || 'Unable to load risk data.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.token, days, disease, clinic]);

  const riskDistribution = (summary?.risk_distribution || []).map(item => ({
    label: item.risk_level,
    value: Number(item.cases) || 0,
    color: ({ Critical: '#dc2626', High: '#f97316', Moderate: '#f59e0b', Low: '#16a34a', Unrated: '#94a3b8' })[item.risk_level],
  }));
  const diseaseCounts = (summary?.diseases || []).map(item => ({ label: item.disease, value: Number(item.cases) || 0 }));
  const riskByClinic = summary?.risk_by_clinic || [];
  const highRiskCases = summary?.high_risk_cases || [];
  const riskCount = level => Number(riskDistribution.find(item => item.label === level)?.value || 0);

  if (!canView) {
    return <div style={s.main}><Topbar user={user} title="Risk Monitoring" subtitle="Track and analyze recorded clinical severity" />
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', color: '#64748b' }}>You don't have permission to view this feature.</div>
    </div>;
  }

  return <div style={s.main}>
    <Topbar user={user} title="Risk Monitoring" subtitle="Review diagnosis counts and severity recorded by clinics" />
    <div style={s.page}>
      {error && <div role="alert" style={{ ...s.card, color: '#b42318' }}>{error}</div>}
      {loading && <div role="status" style={{ ...s.card, color: '#64748b' }}>Loading saved diagnoses and severity records…</div>}
      <div style={s.statsRow}>
        <StatCard label="Diagnosed Cases" value={summary?.total_cases ?? 0} sub="Selected period" color="#0f1117" />
        <StatCard label="High / Critical" value={riskCount('High') + riskCount('Critical')} sub="Explicit severity only" color="#dc2626" />
        <StatCard label="Moderate" value={riskCount('Moderate')} sub="Documented moderate severity" color="#f59e0b" />
        <StatCard label="Low" value={riskCount('Low')} sub="Documented low or mild severity" color="#16a34a" />
      </div>
      <div style={s.filterBar}><div style={s.filters}>
        <select aria-label="Filter by disease" style={s.select} value={disease} onChange={event => setDisease(event.target.value)}>
          <option>All Diseases</option>{(summary?.disease_options || []).map(item => <option key={item.disease}>{item.disease}</option>)}
        </select>
        <select aria-label="Filter by clinic" style={s.select} value={clinic} onChange={event => setClinic(event.target.value)}>
          <option value="all">All Clinics</option>{clinicOptions.map(item => <option key={item.clinic_id} value={item.clinic_id}>{item.clinic_name}</option>)}
        </select>
        <select aria-label="Filter by period" style={s.select} value={timeRange} onChange={event => setTimeRange(event.target.value)}>
          {TIME_OPTIONS.map(option => <option key={option}>{option}</option>)}
        </select>
      </div></div>
      <div style={s.card}>
        <div style={s.cardHd}><div><div style={s.cardTitle}>Recorded Severity Distribution</div><div style={s.cardDesc}>Severity is taken from saved clinical assessments; diagnoses without severity are listed as unrated.</div></div></div>
        {riskDistribution.length ? <ResponsiveContainer width="100%" height={220}><BarChart data={riskDistribution} barSize={60}>
          <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
          <Bar dataKey="value" radius={[5, 5, 0, 0]}>{riskDistribution.map((item, index) => <Cell key={index} fill={item.color} />)}</Bar>
        </BarChart></ResponsiveContainer> : <p style={{ color: '#64748b', fontSize: '.8rem' }}>No diagnosis records in this period.</p>}
      </div>
      <div style={s.card}>
        <div style={s.cardHd}><div><div style={s.cardTitle}>Recorded Severity by Clinic</div><div style={s.cardDesc}>Only saved severity and admission urgency values are included.</div></div></div>
        {riskByClinic.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={riskByClinic} layout="vertical" barSize={18} barCategoryGap={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" /><XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="clinic_name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={120} />
          <Tooltip content={<StackedTooltip />} cursor={{ fill: 'rgba(0,0,0,.03)' }} /><Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: '.75rem', paddingTop: 8 }} />
          <Bar dataKey="low" name="Low" stackId="a" fill="#4ade80" /><Bar dataKey="moderate" name="Moderate" stackId="a" fill="#f59e0b" />
          <Bar dataKey="high" name="High" stackId="a" fill="#f97316" /><Bar dataKey="critical" name="Critical" stackId="a" fill="#dc2626" />
        </BarChart></ResponsiveContainer> : <p style={{ color: '#64748b', fontSize: '.8rem' }}>No clinics have severity-rated diagnosis records in this period.</p>}
      </div>
      <div style={s.card}>
        <div style={s.cardHd}><div><div style={s.cardTitle}>Reported Cases by Disease</div><div style={s.cardDesc}>Counts are based on diagnoses saved in treatment plans, treatment records, consultations, and inpatient assessments.</div></div></div>
        {diseaseCounts.length ? <ResponsiveContainer width="100%" height={220}><BarChart data={diseaseCounts} layout="vertical" barSize={20} barCategoryGap={10}>
          <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" /><XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={160} /><Tooltip content={<BarTooltip />} />
          <Bar dataKey="value" radius={[0, 5, 5, 0]} fill="#139b76" />
        </BarChart></ResponsiveContainer> : <p style={{ color: '#64748b', fontSize: '.8rem' }}>No reported diagnoses match these filters.</p>}
      </div>
      <div style={s.card}>
        <div style={{ ...s.cardTitle, marginBottom: 16 }}>High / Critical Cases (Anonymized)</div>
        <div style={s.table}>
          <div style={s.thead}>{['Case ID', 'Disease', 'Severity', 'Clinic', 'Date'].map(label => <div key={label} style={s.th}>{label}</div>)}</div>
          {highRiskCases.length ? highRiskCases.map((item, index) => <div key={item.case_id} style={{ ...s.trow, borderBottom: index < highRiskCases.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <div style={s.td}><span style={s.caseId}>{item.case_id}</span></div><div style={s.td}><span style={s.tdText}>{item.disease}</span></div>
            <div style={s.td}><span style={s.tdText}>{item.risk_level}</span></div><div style={s.td}><span style={s.tdText}>{item.clinic_name}</span></div>
            <div style={s.td}><span style={s.tdMuted}>{formatDateText(item.case_date)}</span></div>
          </div>) : <div style={{ padding: '18px 0', color: '#64748b', fontSize: '.8rem' }}>{loading ? 'Loading risk cases…' : 'No high or critical severity was recorded for these filters.'}</div>}
        </div>
        <div style={s.privacyNote}><span style={{ color: '#139b76', flexShrink: 0 }}>{Icons.activity}</span><span style={{ fontSize: '.72rem', color: '#64748b' }}>Severity is not inferred where clinics have not recorded it. Case references are anonymized; patient and owner identifiers are not returned.</span></div>
      </div>
    </div>
  </div>;
}
function StatCard({ label, value, sub, color }) {
  return (
    <div style={s.statCard}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statVal, color }}>{value}</div>
      <div style={s.statSub}>{sub}</div>
    </div>
  );
}

/* â”€â”€ STYLES â”€â”€ */
const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f1f6ef' },
  page: { padding: '24px 28px' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 },
  statCard: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '20px 22px',
  },
  statLabel: { fontSize: '.78rem', color: '#64748b', marginBottom: 10 },
  statVal:   { fontFamily: "'DM Sans', sans-serif", fontSize: '2rem', fontWeight: 700, letterSpacing: '-.03em' },
  statSub:   { fontSize: '.72rem', color: '#64748b', marginTop: 4 },

  filterBar: {
    display: 'flex', alignItems: 'center',
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '14px 20px', marginBottom: 16,
  },
  filters: { display: 'flex', gap: 10 },
  select: {
    padding: '8px 12px', border: '1px solid #e8ecf0', borderRadius: 8,
    fontSize: '.82rem', color: '#0f1117', background: '#f1f6ef',
    outline: 'none', cursor: 'pointer',
  },

  card: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '20px 22px', marginBottom: 16,
  },
  cardHd: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 16, gap: 12,
  },
  cardTitle: { fontSize: '.88rem', fontWeight: 600, color: '#0f1117', letterSpacing: '-.01em' },
  cardDesc:  { fontSize: '.7rem', color: '#64748b', marginTop: 3, lineHeight: 1.5 },

  infoBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fffbeb', border: '1px solid #fde68a',
    borderRadius: 8, padding: '10px 14px',
  },

  table: { width: '100%' },
  thead: {
    display: 'grid',
    gridTemplateColumns: '140px minmax(160px, 1fr) 110px minmax(140px, 1fr) 120px',
    padding: '0 0 10px', borderBottom: '1px solid #f1f5f9',
    gap: 8,
  },
  th: { fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' },
  trow: {
    display: 'grid',
    gridTemplateColumns: '140px minmax(160px, 1fr) 110px minmax(140px, 1fr) 120px',
    padding: '14px 0', alignItems: 'center', gap: 8,
  },
  td:      { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  caseId:  { fontSize: '.8rem', fontWeight: 500, color: '#0f1117', fontFamily: 'monospace' },
  tdText:  { fontSize: '.8rem', color: '#0f1117' },
  tdMuted: { fontSize: '.78rem', color: '#64748b' },
  followBtn: {
    padding: '6px 12px', background: '#fff',
    border: '1px solid #e8ecf0', borderRadius: 7,
    fontSize: '.75rem', fontWeight: 500, color: '#0f1117',
    cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'background .12s',
  },

  privacyNote: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    marginTop: 18, padding: '12px 14px',
    background: '#f0f9ff', border: '1px solid #bae6fd',
    borderRadius: 8,
  },
};

const tt = {
  box: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 8, padding: '8px 12px',
    fontSize: '.75rem', boxShadow: '0 2px 8px rgba(0,0,0,.08)',
  },
  label: { color: '#64748b', marginBottom: 3 },
  val:   { fontWeight: 600, color: '#0f1117' },
};



