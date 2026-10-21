import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import Topbar from '../components/Topbar';
import { Icons } from '../icons';
import { canExportFeature, canInteractWithFeature, canViewFeature } from '../utils/permissionUtils';
import { formatDateText } from '../utils/dateFormatting';

const DISEASE_OPTIONS = ['Parvovirus', 'Kennel Cough', 'Distemper', 'Giardia', 'Leptospirosis'];
const TIME_OPTIONS    = ['Last 30 Days', 'Last 60 Days', 'Last 90 Days'];
const REGION_OPTIONS  = ['All Regions', 'East Region', 'West Region', 'North Region'];

const LINE_DATA = [
  { month: 'September', cases: 38 },
  { month: 'October', cases: 42 },
  { month: 'November', cases: 65 },
  { month: 'December', cases: 78 },
  { month: 'January', cases: 103 },
  { month: 'February', cases: 145 },
];

const CLINIC_DATA = [
  { name: 'City Pet',      cases: 39, you: false },
  { name: 'Happy Tails',   cases: 33, you: false },
  { name: 'Paws & Care',   cases: 28, you: false },
  { name: 'CLI-001 (You)', cases: 25, you: true  },
  { name: 'Pet Haven',     cases: 16, you: false },
  { name: 'Animal Clinic', cases: 8,  you: false },
];

const RECENT_ALERTS = [
  {
    title:    'Threshold Exceeded',
    desc:     'Cases have risen above safe levels',
    date:     'March 3, 2026',
    level:    'high',
    fullDesc: 'Cases have risen above safe levels',
    severity: 'HIGH',
    clinics: [
      'City Pet Clinic (38 cases)',
      'Happy Tails Veterinary (32 cases)',
      'Paws & Care Animal Hospital (28 cases)',
    ],
    actions: [
      'Increase vaccination coverage in affected areas',
      'Alert nearby clinics to watch for symptoms',
      'Monitor trend daily for next 2 weeks',
    ],
  },
  {
    title:    'Growth Rate Increased',
    desc:     '40% increase detected — month over month',
    date:     'February 28, 2026',
    level:    'mod',
    fullDesc: '40% increase detected — month over month',
    severity: 'MOD',
    clinics: [
      'City Pet Clinic (38 cases)',
      'Happy Tails Veterinary (32 cases)',
    ],
    actions: [
      'Review vaccination records across clinics',
      'Send advisory notice to network',
      'Schedule follow-up assessment in 1 week',
    ],
  },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8ecf0',
      borderRadius: 8, padding: '8px 12px',
      fontSize: '.75rem', boxShadow: '0 2px 8px rgba(0,0,0,.08)',
    }}>
      <div style={{ color: '#64748b', marginBottom: 3 }}>{label || payload[0].name}</div>
      <div style={{ fontWeight: 600, color: '#0f1117' }}>{payload[0].value} cases</div>
    </div>
  );
};

/* ── MODAL ── */
function AlertModal({ alert, onClose }) {
  if (!alert) return null;
  const isHigh = alert.severity === 'HIGH';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.35)',
          zIndex: 100,
        }}
      />

      {/* Panel */}
      <div style={m.panel}>

        {/* Header */}
        <div style={m.header}>
          <div style={m.headerLeft}>
            <div style={{
              ...m.headerIcon,
              background: isHigh ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${isHigh ? '#fca5a5' : '#fde68a'}`,
            }}>
              <span style={{
                width: 16, height: 16, display: 'flex',
                color: isHigh ? '#dc2626' : '#d97706',
              }}>
                {Icons.activity}
              </span>
            </div>
            <div>
              <div style={m.headerTitle}>{alert.title}</div>
              <div style={m.headerDate}>Alert triggered on {formatDateText(alert.date, undefined, alert.date)}</div>
            </div>
          </div>
          <button type="button" aria-label="Close disease alert details" style={m.closeBtn} onClick={onClose}>
            <span style={{ width: 18, height: 18, display: 'flex', color: '#64748b' }}>
              {Icons.close}
            </span>
          </button>
        </div>

        <div style={m.divider} />

        {/* Body */}
        <div style={m.body}>

          <div style={m.section}>
            <div style={m.sectionTitle}>Alert Description</div>
            <div style={m.sectionText}>{alert.fullDesc}</div>
          </div>

          <div style={m.section}>
            <div style={m.sectionTitle}>Severity Level</div>
            <span style={{
              ...m.badge,
              background: isHigh ? '#dc2626' : '#d97706',
            }}>
              {alert.severity}
            </span>
          </div>

          <div style={m.section}>
            <div style={m.sectionTitle}>Affected Clinics</div>
            {alert.clinics.map((c, i) => (
              <div key={i} style={m.listItem}>
                <span style={m.bullet}>•</span>
                {c}
              </div>
            ))}
          </div>

          <div style={m.section}>
            <div style={m.sectionTitle}>Recommended Actions</div>
            {alert.actions.map((a, i) => (
              <div key={i} style={m.listItem}>
                <span style={m.bullet}>•</span>
                {a}
              </div>
            ))}
          </div>

        </div>

        <div style={m.divider} />

        {/* Footer */}
        <div style={m.footer}>
          <button style={m.primaryBtn}>Alert Affected Clinics</button>
          <button style={m.secondaryBtn}>Export Report</button>
        </div>

      </div>
    </>
  );
}

/* ── MAIN PAGE ── */
export default function DiseaseMonitoringPage({ user }) {
  const [disease,   setDisease]   = useState('Parvovirus');
  const [timeRange, setTimeRange] = useState('Last 30 Days');
  const [region,    setRegion]    = useState('All Regions');
  const [showVacc,  setShowVacc]  = useState(false);
  const [modal,     setModal]     = useState(null);

  const canView = canViewFeature(user.permissions, user.role, 'Disease Monitoring');
  const canExportAlert = canExportFeature(user.permissions, user.role, 'Disease Monitoring');
  const canAlertClinics = canInteractWithFeature(user.permissions, user.role, 'Disease Monitoring');

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Disease Monitoring" subtitle="Monitor disease patterns and outbreak alerts" />
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
        title="Disease Monitoring"
        subtitle="Monitor disease patterns and outbreak alerts"
      />
      <div style={s.page}>

        {/* FILTER BAR */}
        <div style={s.filterBar}>
          <div style={s.filters}>
            <select
              disabled={!canExportAlert}
              style={{
                ...s.select,
                background: canExportAlert ? '#f4f6f9' : '#f8fafc',
                color: canExportAlert ? '#0f1117' : '#64748b',
                cursor: canExportAlert ? 'pointer' : 'not-allowed',
              }}
              value={disease}
              onChange={e => setDisease(e.target.value)}
            >
              {DISEASE_OPTIONS.map(d => <option key={d}>{d}</option>)}
            </select>
            <select
              disabled={!canExportAlert}
              style={{
                ...s.select,
                background: canExportAlert ? '#f4f6f9' : '#f8fafc',
                color: canExportAlert ? '#0f1117' : '#64748b',
                cursor: canExportAlert ? 'pointer' : 'not-allowed',
              }}
              value={timeRange}
              onChange={e => setTimeRange(e.target.value)}
            >
              {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
            <select
              disabled={!canExportAlert}
              style={{
                ...s.select,
                background: canExportAlert ? '#f4f6f9' : '#f8fafc',
                color: canExportAlert ? '#0f1117' : '#64748b',
                cursor: canExportAlert ? 'pointer' : 'not-allowed',
              }}
              value={region}
              onChange={e => setRegion(e.target.value)}
            >
              {REGION_OPTIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <button
            style={{
              ...s.exportBtn,
              opacity: canExportAlert ? 1 : 0.65,
              background: canExportAlert ? '#0f1117' : '#f8fafc',
              color: canExportAlert ? '#fff' : '#64748b',
              border: canExportAlert ? 'none' : '1px solid #cbd5e1',
              cursor: canExportAlert ? 'pointer' : 'not-allowed',
            }}
            disabled={!canExportAlert}
          >
            Export Alert
          </button>
        </div>

        {/* OUTBREAK BANNER */}
        <div style={s.banner}>
          <div style={s.bannerLeft}>
            <div style={s.bannerIcon}>
              <span style={{ width: 16, height: 16, display: 'flex', color: '#dc2626' }}>
                {Icons.activity}
              </span>
            </div>
            <div>
              <div style={s.bannerTitle}>{disease} growth exceeded safe threshold (+40%)</div>
              <div style={s.bannerSub}>Affecting: City Pet, Happy Tails, Paws &amp; Care</div>
            </div>
          </div>
          <button
            style={{
              ...s.alertBtn,
              opacity: canAlertClinics ? 1 : 0.65,
              background: canAlertClinics ? '#dc2626' : '#f8fafc',
              color: canAlertClinics ? '#fff' : '#64748b',
              border: canAlertClinics ? 'none' : '1px solid #cbd5e1',
              cursor: canAlertClinics ? 'pointer' : 'not-allowed',
            }}
            disabled={!canAlertClinics}
          >
            Alert Clinics
          </button>
        </div>

        {/* GROWTH STATS */}
        <div style={s.statsRow}>
          <div style={s.growthCard}>
            <div style={s.growthVal}>+40%</div>
            <div style={s.growthSub}>Compared to last 30 days</div>
          </div>
          <div style={s.casesCard}>
            <div style={s.casesVal}>145</div>
            <div style={s.casesSub}>cases this month</div>
          </div>
        </div>

        {/* CASES VS THRESHOLD */}
        <div style={s.card}>
          <div style={s.cardHd}>
            <div>
              <div style={s.cardTitle}>Cases vs. Threshold</div>
              <div style={s.cardDesc}>
                Compares reported cases against the safe threshold over time, with optional vaccination rate overlay to identify correlations.
              </div>
            </div>
            <div style={s.toggleRow}>
              <span style={s.toggleLabel}>Show Vaccination Rate</span>
              <div
                style={{ ...s.toggle, background: showVacc ? '#005447' : '#e2e8f0' }}
                onClick={() => setShowVacc(v => !v)}
              >
                <div style={{
                  ...s.toggleThumb,
                  transform: showVacc ? 'translateX(16px)' : 'translateX(2px)',
                }} />
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={LINE_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={50} stroke="#fca5a5" strokeDasharray="4 4"
                label={{ value: 'Threshold', position: 'insideTopRight', fontSize: 10, fill: '#dc2626' }}
              />
              <Line
                type="monotone" dataKey="cases"
                stroke="#139b76" strokeWidth={2}
                dot={{ r: 4, fill: '#139b76', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CLINIC COMPARISON */}
        <div style={s.card}>
          <div style={s.cardHd}>
            <div>
              <div style={s.cardTitle}>Clinic Comparison</div>
              <div style={s.cardDesc}>
                Compares case volumes across network clinics to identify hotspots and participation rates.
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={CLINIC_DATA} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" />
              <XAxis
                dataKey="name"
                tick={({ x, y, payload }) => (
                  <text
                    x={x} y={y + 12}
                    textAnchor="middle" fontSize={11}
                    fill={payload.value === 'CLI-001 (You)' ? '#005447' : '#64748b'}
                    fontWeight={payload.value === 'CLI-001 (You)' ? 600 : 400}
                  >
                    {payload.value}
                  </text>
                )}
                axisLine={false} tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={30} stroke="#fca5a5" strokeDasharray="4 4" />
              <Bar dataKey="cases" radius={[4, 4, 0, 0]}>
                {CLINIC_DATA.map((d, i) => (
                  <Cell key={i} fill={d.you ? '#1e3a8a' : '#139b76'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* RECENT ALERTS */}
        <div style={s.card}>
          <div style={{ ...s.cardTitle, marginBottom: 16 }}>Recent Alerts</div>
          {RECENT_ALERTS.map((a, i) => (
            <div key={i} style={s.alertItem}>
              <div style={s.alertLeft}>
                <div style={{
                  ...s.alertIcon,
                  background: a.level === 'high' ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${a.level === 'high' ? '#fca5a5' : '#fde68a'}`,
                }}>
                  <span style={{
                    width: 14, height: 14, display: 'flex',
                    color: a.level === 'high' ? '#dc2626' : '#d97706',
                  }}>
                    {Icons.activity}
                  </span>
                </div>
                <div>
                  <div style={s.alertTitle}>{a.title}</div>
                  <div style={s.alertDesc}>{a.desc}</div>
                  <div style={s.alertDate}>{formatDateText(a.date, undefined, a.date)}</div>
                </div>
              </div>
              <div
                style={s.viewDetails}
                onClick={() => setModal(a)}
              >
                View Details
                <span style={{ width: 13, height: 13, display: 'flex' }}>{Icons.arrowRight}</span>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* MODAL */}
      <AlertModal alert={modal} onClose={() => setModal(null)} />
    </div>
  );
}

/* ── STYLES ── */
const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f4f6f9' },
  page: { padding: '24px 28px' },
  filterBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '14px 20px', marginBottom: 16, gap: 12,
  },
  filters:   { display: 'flex', gap: 10 },
  select: {
    padding: '8px 12px', border: '1px solid #e8ecf0', borderRadius: 8,
    fontSize: '.82rem', color: '#0f1117', background: '#f4f6f9',
    outline: 'none', cursor: 'pointer',
  },
  exportBtn: {
    padding: '8px 18px', background: '#0f1117', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: '.82rem',
    fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  banner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fef2f2', border: '1px solid #fca5a5',
    borderRadius: 12, padding: '14px 18px', marginBottom: 16, gap: 12,
  },
  bannerLeft:  { display: 'flex', alignItems: 'center', gap: 12 },
  bannerIcon: {
    width: 32, height: 32, borderRadius: 8,
    background: '#fff', border: '1px solid #fca5a5',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bannerTitle: { fontSize: '.85rem', fontWeight: 600, color: '#dc2626' },
  bannerSub:   { fontSize: '.75rem', color: '#ef4444', marginTop: 2 },
  alertBtn: {
    padding: '8px 18px', background: '#dc2626', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: '.82rem',
    fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 },
  growthCard: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '22px 24px',
  },
  growthVal: {
    fontFamily: "'DM Sans', sans-serif", fontSize: '2.8rem',
    fontWeight: 700, color: '#dc2626', letterSpacing: '-.03em',
  },
  growthSub:  { fontSize: '.78rem', color: '#64748b', marginTop: 6 },
  casesCard: {
    background: '#fff', border: '1px solid #e8ecf0',
    borderRadius: 14, padding: '22px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
  },
  casesVal: {
    fontFamily: "'DM Sans', sans-serif", fontSize: '2.8rem',
    fontWeight: 700, color: '#0f1117', letterSpacing: '-.03em',
  },
  casesSub:  { fontSize: '.78rem', color: '#64748b', marginTop: 6 },
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
  toggleRow:   { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  toggleLabel: { fontSize: '.75rem', color: '#64748b', whiteSpace: 'nowrap' },
  toggle: {
    width: 36, height: 20, borderRadius: 20,
    position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
  },
  toggleThumb: {
    position: 'absolute', top: 2, width: 16, height: 16,
    borderRadius: '50%', background: '#fff',
    transition: 'transform .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
  },
  alertItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 0', borderBottom: '1px solid #f1f5f9', gap: 12,
  },
  alertLeft:   { display: 'flex', alignItems: 'flex-start', gap: 12 },
  alertIcon: {
    width: 32, height: 32, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  alertTitle:  { fontSize: '.84rem', fontWeight: 500, color: '#0f1117' },
  alertDesc:   { fontSize: '.75rem', color: '#64748b', marginTop: 2 },
  alertDate:   { fontSize: '.68rem', color: '#64748b', marginTop: 3 },
  viewDetails: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: '.75rem', color: '#005447',
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  },
};

const m = {
  panel: {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#fff',
    borderRadius: 16,
    width: 480,
    maxWidth: '90vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    zIndex: 101,
    boxShadow: '0 20px 60px rgba(0,0,0,.15)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '20px 22px 16px', gap: 12,
  },
  headerLeft:  { display: 'flex', alignItems: 'flex-start', gap: 12 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerTitle: { fontSize: '.95rem', fontWeight: 600, color: '#0f1117' },
  headerDate:  { fontSize: '.73rem', color: '#64748b', marginTop: 3 },
  closeBtn: {
    background: 'none', border: 'none',
    cursor: 'pointer', padding: 4,
    borderRadius: 6, flexShrink: 0,
    display: 'flex', alignItems: 'center',
  },
  divider: { height: 1, background: '#f1f5f9', margin: '0' },
  body:    { padding: '20px 22px' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: '.8rem', fontWeight: 600,
    color: '#0f1117', marginBottom: 8,
  },
  sectionText: { fontSize: '.82rem', color: '#64748b', lineHeight: 1.6 },
  badge: {
    display: 'inline-block',
    padding: '3px 12px', borderRadius: 20,
    fontSize: '.72rem', fontWeight: 700,
    color: '#fff', letterSpacing: '.04em',
  },
  listItem: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    fontSize: '.82rem', color: '#64748b',
    lineHeight: 1.6, marginBottom: 4,
  },
  bullet: { color: '#64748b', flexShrink: 0 },
  footer: {
    display: 'flex', gap: 10,
    padding: '16px 22px 20px',
  },
  primaryBtn: {
    flex: 1, padding: '10px 16px',
    background: '#0f1117', color: '#fff',
    border: 'none', borderRadius: 9,
    fontSize: '.84rem', fontWeight: 500, cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 16px',
    background: '#fff', color: '#0f1117',
    border: '1px solid #e8ecf0', borderRadius: 9,
    fontSize: '.84rem', fontWeight: 500, cursor: 'pointer',
  },
};
