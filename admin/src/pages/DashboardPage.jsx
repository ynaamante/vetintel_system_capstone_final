import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import Topbar from '../components/Topbar';
import { Icons } from '../icons';
import { LINE_DATA, BAR_DATA, RISK_DATA, ALERTS } from '../data/mockData';
import { formatDateText } from '../utils/dateFormatting';

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

function StatCard({ label, value, valueRed, icon, iconBg, iconColor, sub, subType, isAlert, extra }) {
  return (
    <div style={{
      ...s.stat,
      ...(isAlert ? s.statAlert : {}),
    }}>
      <div style={s.statLabel}>{label}</div>
      <div style={s.statRow}>
        <div style={{ ...s.statVal, ...(valueRed ? { color: '#dc2626' } : {}) }}>{value}</div>
        <div style={{ ...s.statMarker, background: iconBg }}>
          <span style={{ color: iconColor, display: 'flex', width: 16, height: 16 }}>{icon}</span>
        </div>
      </div>
      {sub && (
        <div style={{
          ...s.statSub,
          color: subType === 'up' ? '#16a34a' : subType === 'down' ? '#dc2626' : '#64748b',
        }}>
          {sub}
        </div>
      )}
      {extra}
    </div>
  );
}

export default function DashboardPage({ user }) {
  return (
    <div style={s.main}>
      <Topbar user={user} title="Intelligence Dashboard" subtitle="Community-wide disease surveillance and analytics" />
      <div style={s.page}>

        {/* STATS */}
        <div style={s.statsGrid}>
          <StatCard
            label="Total Clinics Connected"
            value="6"
            icon={Icons.building}
            iconBg="#e7f5f2" iconColor="#005447"
            sub="6 of 8 clinics reporting"
          />
          <StatCard
            label="Active Outbreak Alerts"
            value="3" valueRed
            icon={Icons.activity}
            iconBg="#fef2f2" iconColor="#dc2626"
            isAlert
            extra={<div style={s.viewAllLink}>View all <span style={{ width: 12, height: 12, display: 'inline-flex' }}>{Icons.arrowRight}</span></div>}
          />
          <StatCard
            label="Total Disease Cases"
            value="547"
            icon={Icons.trendUp}
            iconBg="#fffbeb" iconColor="#d97706"
            sub="+8% from last month" subType="up"
          />
          <StatCard
            label="High Risk Cases"
            value="79"
            icon={Icons.shield}
            iconBg="#fef2f2" iconColor="#dc2626"
            sub="+12 since last week" subType="down"
          />
        </div>

        {/* CHARTS */}
        <div style={s.chartsRow}>
          <div style={s.card}>
            <div style={s.cardHd}>
              <div>
                <div style={s.cardTitle}>Monthly disease growth</div>
                <div style={s.cardDesc}>Reported cases over time — identifies emerging trends and seasonal patterns</div>
              </div>
              <select style={s.select}><option>All diseases</option></select>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={LINE_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={80} stroke="#fca5a5" strokeDasharray="4 4"
                  label={{ value: 'Threshold', position: 'insideTopRight', fontSize: 10, fill: '#dc2626' }} />
                <Line type="monotone" dataKey="cases" stroke="#005447" strokeWidth={2}
                  dot={{ r: 3, fill: '#005447', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={s.card}>
            <div style={s.cardHd}>
              <div>
                <div style={s.cardTitle}>Top 5 diseases</div>
                <div style={s.cardDesc}>Most prevalent — red bars indicate cases above the alert threshold</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={BAR_DATA} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#b8c4d3" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={100} stroke="#fca5a5" strokeDasharray="4 4" />
                <Bar dataKey="cases" radius={[4, 4, 0, 0]}>
                  {BAR_DATA.map((d, i) => (
                    <Cell key={i} fill={d.cases >= 100 ? '#dc2626' : '#139b76'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RISK DISTRIBUTION */}
        <div style={{ ...s.card, marginBottom: 14 }}>
          <div style={s.cardTitle}>Risk Distribution</div>
          <div style={{ ...s.cardDesc, marginBottom: 20 }}>
            Proportion of cases by risk level — assesses overall network health
          </div>
          {RISK_DATA.map(r => (
            <div key={r.label} style={s.riskRow}>
              <div style={s.riskLabel}>
                <div style={{ ...s.riskCircle, background: r.color }} />
                {r.label}
              </div>
              <div style={s.riskTrack}>
                <div style={{ ...s.riskFill, width: r.pct + '%' }} />
              </div>
              <span style={s.riskPct}>{r.pct}% · {r.cases}</span>
            </div>
          ))}
        </div>

        {/* ALERTS */}
        <div style={s.card}>
          <div style={{ ...s.cardTitle, marginBottom: 16 }}>Active alerts</div>
          {ALERTS.map(a => (
            <div key={a.name} style={s.alertItem}>
              <div style={s.alertTop}>
                <div style={s.alertName}>
                  <div style={{ ...s.alertPip, background: a.color }} />
                  {a.name}
                </div>
                <span style={{
                  ...s.pill,
                  background: a.level === 'HIGH' ? '#e11d48' : '#f59e0b',
                  color: '#fff',
                }}>
                  {a.level}
                </span>
              </div>
              <div style={s.alertDesc}>{a.desc}</div>
              <div style={s.alertDate}>{formatDateText(a.date, undefined, a.date)}</div>
            </div>
          ))}
          <button style={s.viewAllBtn}>View all alerts</button>
        </div>

      </div>
    </div>
  );
}

const s = {
  main:       { flex: 1, overflowY: 'auto', background: '#f5f7fa' },
  page:       { padding: '24px 28px 36px' },
  statsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 20 },
  stat:       { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px', minHeight: 118 },
  statAlert:  { borderTop: '3px solid #f43f4c', paddingTop: 17 },
  statLabel:  { fontSize: '.82rem', fontWeight: 500, color: '#64748b', marginBottom: 12 },
  statRow:    { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' },
  statVal:    { fontFamily: "'DM Sans', sans-serif", fontSize: '2rem', fontWeight: 600, lineHeight: 1, letterSpacing: '-.03em' },
  statMarker: { width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statSub:    { fontSize: '.78rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 },
  viewAllLink:{ fontSize: '.78rem', color: '#005447', fontWeight: 600, marginTop: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 },
  chartsRow:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 },
  card:       { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px', marginBottom: 14 },
  cardHd:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  cardTitle:  { fontSize: '1rem', fontWeight: 600, color: '#0f1117', letterSpacing: '-.01em' },
  cardDesc:   { fontSize: '.82rem', color: '#64748b', marginTop: 4, lineHeight: 1.45, maxWidth: 620 },
  select:     { padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '.8rem', color: '#334155', background: '#f8fafc', outline: 'none' },
  riskRow:   { display: 'grid', gridTemplateColumns: '150px 1fr 120px', alignItems: 'center', gap: 12, marginBottom: 14 },
  riskLabel:  { display: 'flex', alignItems: 'center', gap: 7, fontSize: '.84rem', color: '#0f1117', flexShrink: 0 },
  riskCircle: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  riskTrack:  { height: 10, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden' },
  riskFill:   { height: '100%', borderRadius: 10, background: '#090817' },
  riskPct:    { fontSize: '.82rem', color: '#334155', minWidth: 100, textAlign: 'right', fontWeight: 600 },
  alertItem:  { padding: '16px 18px', border: '1px solid #dbe3ee', borderRadius: 10, marginBottom: 10 },
  alertTop:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  alertName:  { display: 'flex', alignItems: 'center', gap: 9, fontSize: '.95rem', fontWeight: 600 },
  alertPip:   { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  pill:       { padding: '2px 9px', borderRadius: 20, fontSize: '.65rem', fontWeight: 600, letterSpacing: '.04em' },
  alertDesc:  { fontSize: '.82rem', color: '#64748b', marginTop: 6, paddingLeft: 16 },
  alertDate:  { fontSize: '.78rem', color: '#64748b', marginTop: 5, paddingLeft: 16 },
  viewAllBtn: { width: '100%', padding: 11, border: '1px solid #dbe3ee', borderRadius: 8, fontSize: '.82rem', color: '#334155', background: '#fff', cursor: 'pointer', fontWeight: 600 },
};