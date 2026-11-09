import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Topbar from '../components/Topbar';
import { canViewFeature } from '../utils/permissionUtils';

/* â”€â”€ DATA â”€â”€ */
const ChartTooltip = ({ active, payload, label, suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={tt.box}>
      <div style={tt.label}>{label}</div>
      <div style={tt.val}>{payload[0].value}{suffix}</div>
    </div>
  );
};

/* â”€â”€ MAIN PAGE â”€â”€ */
export function CommunityAnalyticsPage({ user }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const canView = canViewFeature(user.permissions, user.role, 'Community Analytics');

  useEffect(() => {
    if (!user?.token) { setError('Sign in to load community analytics.'); setLoading(false); return undefined; }
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    fetch(`${apiUrl}/disease-intelligence/summary?days=90`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Unable to load community analytics (HTTP ${response.status}).`);
        setSummary(payload); setError('');
      }).catch(loadError => { if (loadError.name !== 'AbortError') setError(loadError.message || 'Unable to load community analytics.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.token]);

  const monthlyCases = useMemo(() => {
    const grouped = new Map();
    (summary?.trend || []).forEach(item => {
      const date = new Date(item.case_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      grouped.set(key, { month: label, cases: (grouped.get(key)?.cases || 0) + Number(item.cases || 0) });
    });
    return [...grouped.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([, item]) => item);
  }, [summary?.trend]);
  const vaccinationData = useMemo(() => (summary?.vaccination_trend || []).map(item => ({
    month: new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    records: Number(item.records) || 0,
  })), [summary?.vaccination_trend]);
  const diseaseData = (summary?.diseases || []).slice(0, 10).map(item => ({ disease: item.disease, cases: Number(item.cases) || 0 }));
  const severityData = (summary?.risk_distribution || []).map(item => ({ level: item.risk_level, cases: Number(item.cases) || 0 }));
  const activePets = Number(summary?.active_pets) || 0;
  const currentVaccinePets = Number(summary?.pets_with_current_vaccine_record) || 0;
  const coverage = activePets ? Math.round(currentVaccinePets * 100 / activePets) : 0;
  const highCritical = severityData.filter(item => ['High', 'Critical'].includes(item.level)).reduce((total, item) => total + item.cases, 0);
  const cases = Number(summary?.total_cases) || 0;
  const previousCases = Number(summary?.previous_cases) || 0;
  const caseChange = previousCases ? Math.round((cases - previousCases) * 100 / previousCases) : 0;
  const leadingDisease = diseaseData[0];

  if (!canView) {
    return <div style={s.main}><Topbar user={user} title="Community Analytics" subtitle="Aggregated disease and vaccination records" />
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', color: '#64748b' }}>You don't have permission to view this feature.</div>
    </div>;
  }

  return <div style={s.main}>
    <Topbar user={user} title="Community Analytics" subtitle="Aggregated diagnoses and vaccination records from connected clinics" />
    <div style={s.page}>
      {error && <div role="alert" style={{ ...s.card, color: '#b42318' }}>{error}</div>}
      {loading && <div role="status" style={{ ...s.card, color: '#64748b' }}>Loading clinic reports…</div>}
      <div style={s.statsRow}>
        <StatCard label="Patients with current vaccine record" value={`${coverage}%`} detail={`${currentVaccinePets} of ${activePets} active patients have a recorded administered vaccine that is not past its due date.`} />
        <StatCard label="Diagnosed cases · 90 days" value={cases} detail={`${caseChange > 0 ? '+' : ''}${caseChange}% compared with the previous 90-day period.`} />
        <StatCard label="High / critical severity" value={highCritical} detail="Based on severity or inpatient urgency explicitly saved by clinic staff." />
      </div>
      <div style={s.card}>
        <div style={s.cardHd}><div><div style={s.cardTitle}>Monthly Diagnosed Cases</div><div style={s.cardDesc}>Diagnosis entries deduplicated by patient, diagnosis, clinic, and day.</div></div><span style={s.cardDesc}>{summary?.affected_clinics || 0} clinics reporting</span></div>
        {monthlyCases.length ? <ResponsiveContainer width="100%" height={220}><LineChart data={monthlyCases}>
          <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip suffix=" cases" />} />
          <Line type="monotone" dataKey="cases" stroke="#139b76" strokeWidth={2.5} dot={{ r: 4, fill: '#139b76' }} />
        </LineChart></ResponsiveContainer> : <p style={{ color: '#64748b', fontSize: '.8rem' }}>No diagnoses were recorded in the last 90 days.</p>}
      </div>
      <div style={s.chartsRow}>
        <div style={s.card}>
          <div style={s.cardHd}><div><div style={s.cardTitle}>Vaccination Records Added</div><div style={s.cardDesc}>Administered vaccination records by month.</div></div></div>
          {vaccinationData.length ? <ResponsiveContainer width="100%" height={210}><LineChart data={vaccinationData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip suffix=" records" />} />
            <Line type="monotone" dataKey="records" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} />
          </LineChart></ResponsiveContainer> : <p style={{ color: '#64748b', fontSize: '.8rem' }}>No administered vaccination records in the last six months.</p>}
        </div>
        <div style={s.card}>
          <div style={s.cardHd}><div><div style={s.cardTitle}>Cases by Disease</div><div style={s.cardDesc}>Most frequently recorded diagnosis names in the selected period.</div></div></div>
          {diseaseData.length ? <ResponsiveContainer width="100%" height={210}><BarChart data={diseaseData} layout="vertical" barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" /><XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="disease" width={130} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip suffix=" cases" />} />
            <Bar dataKey="cases" radius={[0, 5, 5, 0]}>{diseaseData.map((item, index) => <Cell key={index} fill="#139b76" />)}</Bar>
          </BarChart></ResponsiveContainer> : <p style={{ color: '#64748b', fontSize: '.8rem' }}>No diagnosis records to compare.</p>}
        </div>
      </div>
      <div style={s.card}>
        <div style={s.cardHd}><div><div style={s.cardTitle}>Recorded Severity Summary</div><div style={s.cardDesc}>Counts reflect only recorded severity and urgency, with unrated diagnoses kept visible.</div></div></div>
        {severityData.length ? <ResponsiveContainer width="100%" height={190}><BarChart data={severityData} barSize={42}>
          <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" /><XAxis dataKey="level" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip suffix=" cases" />} />
          <Bar dataKey="cases" radius={[4, 4, 0, 0]}>{severityData.map((item, index) => <Cell key={index} fill={({ Critical: '#dc2626', High: '#f97316', Moderate: '#f59e0b', Low: '#16a34a', Unrated: '#94a3b8' })[item.level]} />)}</Bar>
        </BarChart></ResponsiveContainer> : <p style={{ color: '#64748b', fontSize: '.8rem' }}>No saved diagnosis records to summarize.</p>}
      </div>
      <div style={s.insightsRow}>
        <Insight title="Leading recorded diagnosis" description={leadingDisease ? `${leadingDisease.disease} has ${leadingDisease.cases} deduplicated cases in the last 90 days.` : 'No diagnoses are available in this period.'} />
        <Insight title="Severity data coverage" description={`${highCritical} cases have an explicitly recorded high or critical severity. Other diagnoses remain unrated unless the clinic records a severity.`} />
        <Insight title="Vaccination record coverage" description={`${coverage}% of active patients have at least one administered vaccination record with a future due date. This is a record-based indicator, not a complete vaccine schedule assessment.`} />
      </div>
      <div style={s.card}>
        <div style={{ ...s.cardTitle, marginBottom: 12 }}>Monthly Case Summary</div>
        {monthlyCases.length ? <div style={{ display: 'grid', gap: 8 }}>{monthlyCases.map(item => <div key={item.month} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #f1f5f9', padding: '8px 0', fontSize: '.8rem' }}><span>{item.month}</span><strong>{item.cases} diagnoses</strong></div>)}</div> : <div style={{ color: '#64748b', fontSize: '.8rem' }}>No monthly case data is available.</div>}
      </div>
    </div>
  </div>;
}

function Insight({ title, description }) {
  return <article style={s.insightCard}><div style={s.insightTitle}>{title}</div><p style={s.insightDesc}>{description}</p></article>;
}
function StatCard({ label, value, detail }) {
  return <div style={s.statCard}><div style={s.statLabel}>{label}</div><div style={s.statVal}>{value}</div><div style={{ fontSize: '.72rem', color: '#64748b', marginTop: 6, lineHeight: 1.45 }}>{detail}</div></div>;
}
const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f1f6ef' },
  page: { padding: '24px 28px' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 },
  chartsRow: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, alignItems: 'start' },
  statCard: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '20px 22px',
  },
  statLabel: { fontSize: '.78rem', color: '#64748b', marginBottom: 10 },
  statVal:   { fontFamily: "'DM Sans', sans-serif", fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-.03em' },

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

  warningBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fffbeb', border: '1px solid #fde68a',
    borderRadius: 8, padding: '10px 14px', marginTop: 14,
  },

  currentBadge: {
    textAlign: 'center', marginTop: 8,
    fontSize: '.88rem', color: '#dc2626', fontWeight: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  insightsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 },
  insightCard: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '18px 18px',
  },
  insightTitle:       { fontSize: '.85rem', fontWeight: 600, color: '#0f1117', marginBottom: 8 },
  insightDesc:        { fontSize: '.77rem', color: '#64748b', lineHeight: 1.55, marginBottom: 14 },
  insightActionLabel: { fontSize: '.72rem', fontWeight: 600, color: '#64748b', marginBottom: 4 },
  insightAction:      { fontSize: '.77rem', color: '#64748b', lineHeight: 1.5 },

  accordion: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, marginBottom: 10, overflow: 'hidden',
  },
  accordionHd: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', cursor: 'pointer',
  },
  accordionTitle: { fontSize: '.86rem', fontWeight: 500, color: '#0f1117' },
  accordionBody:  { padding: '4px 20px 20px', borderTop: '1px solid #f1f5f9' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 },
  metricItem:  {},
  metricLabel: { fontSize: '.72rem', color: '#64748b', marginBottom: 6 },
  metricVal:   { fontFamily: "'DM Sans', sans-serif", fontSize: '1.4rem', fontWeight: 700, color: '#0f1117', letterSpacing: '-.02em' },
  metricChange:{ fontSize: '.72rem', marginTop: 4 },
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




