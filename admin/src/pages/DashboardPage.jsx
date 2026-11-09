import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import Topbar from '../components/Topbar';
import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';
import './dashboardPage.css';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const palette = ['#00731c', '#69bd17', '#94d76d', '#b6e883', '#e3f5d0'];
const dateTime = value => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not recorded';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="surveillance-tooltip"><strong>{label}</strong>{payload.map(item => <p key={item.dataKey} style={{ color: item.color }}>{item.name}: {item.value} cases</p>)}</div>;
}
function Stat({ title, value, children, alert }) {
  return <section className="surveillance-stat"><h2>{title}</h2><strong className={alert ? 'is-alert' : ''}>{value}</strong><div>{children}</div></section>;
}
function AlertReview({ alert, days, user, onClose, onNavigate }) {
  const ref = useRef(null);
  useEffect(() => { const previous = document.activeElement; ref.current.showModal(); return () => previous?.focus(); }, []);
  return <dialog ref={ref} className="surveillance-review" onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="surveillance-review-title"><header><div><h2 id="surveillance-review-title">{alert.disease}</h2><p>Potential disease alert</p></div><button type="button" onClick={onClose} aria-label="Close alert review">{Icons.close}</button></header><span className="surveillance-status"><i />Pending Review</span><dl>{[['Current period', `${alert.cases} cases in the last ${days} days`], ['Previous period', `${alert.previous_cases} cases`], ['Reporting clinics', alert.reporting_clinics], ['Reporting area', alert.reporting_area || 'Not recorded'], ['Last reported', dateTime(alert.last_reported)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="surveillance-review-note">This increase is detected from recorded diagnoses. It requires review before it can be considered a verified alert.</p><footer><button type="button" onClick={onClose}>Close</button>{onNavigate && canViewFeature(user.permissions, user.role, 'Disease Monitoring') && <button type="button" className="surveillance-primary" onClick={() => { onClose(); onNavigate('disease'); }}>Open Disease Monitoring</button>}</footer></dialog>;
}

export default function DashboardPage({ user, onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [days, setDays] = useState(30);
  const [clinic, setClinic] = useState('all');
  const [clinicOptions, setClinicOptions] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!user?.token) { setError('Sign in to load disease surveillance.'); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    const query = new URLSearchParams({ days: String(days) });
    if (clinic !== 'all') query.set('clinic_id', clinic);
    fetch(`${api}/disease-intelligence/summary?${query}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error || 'Unable to load dashboard data.'); setSummary(data); if (Array.isArray(data.clinic_options) && clinic === 'all') setClinicOptions(data.clinic_options); })
      .catch(error => { if (error.name !== 'AbortError') { setError(error.message); setSummary(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.token, user?.clinic_id, days, clinic, refresh]);
  useEffect(() => {
    const reload = () => setRefresh(value => value + 1);
    window.addEventListener('vetintel:appointment-updated', reload);
    window.addEventListener('focus', reload);
    return () => { window.removeEventListener('vetintel:appointment-updated', reload); window.removeEventListener('focus', reload); };
  }, []);
  const diseases = useMemo(() => [...(summary?.diseases || [])].filter(item => Number(item.cases) > 0).sort((a, b) => Number(b.cases) - Number(a.cases)), [summary]);
  const alerts = diseases.filter(item => Number(item.cases) >= 3 && Number(item.cases) > Number(item.previous_cases) * 1.4);
  const alertRows = alerts.filter(item => `${item.disease} ${item.reporting_area || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const cases = Number(summary?.total_cases) || 0;
  const previous = Number(summary?.previous_cases) || 0;
  const change = previous ? Math.round((cases - previous) / previous * 100) : null;
  const topDiseases = diseases.slice(0, 5).map(item => ({ name: item.disease, cases: Number(item.cases) }));
  const trend = useMemo(() => {
    const raw = summary?.monthly_disease_trend || [];
    const totals = new Map();
    raw.forEach(item => totals.set(item.disease, (totals.get(item.disease) || 0) + Number(item.cases)));
    const names = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name]) => name);
    const now = new Date(summary?.checked_at || Date.now());
    const points = Array.from({ length: 6 }, (_, index) => { const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1); return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, month: date.toLocaleDateString('en-US', { month: 'short' }), a: 0, b: 0 }; });
    raw.forEach(item => { const point = points.find(point => point.key === String(item.month).slice(0, 7)); const index = names.indexOf(item.disease); if (point && index >= 0) point[index === 0 ? 'a' : 'b'] += Number(item.cases); });
    return { points, names };
  }, [summary]);
  const value = number => loading ? '—' : error ? '—' : number;
  return <main className="surveillance-dashboard">
    <Topbar user={user} title="Dashboard" subtitle="Community-wide veterinary disease surveillance" className="surveillance-topbar" actions={<label className="surveillance-search">{Icons.search}<input aria-label="Search disease alerts" placeholder="Search diseases or reporting clinics..." value={search} onChange={event => setSearch(event.target.value)} /></label>} />
    <div className="surveillance-body">
      <div className="surveillance-filters"><label>{Icons.calendar}<select aria-label="Reporting period" value={days} onChange={event => setDays(Number(event.target.value))}>{[30, 60, 90].map(value => <option key={value} value={value}>Last {value} Days</option>)}</select><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></label><label>{Icons.building}<select aria-label="Reporting clinic" value={clinic} onChange={event => setClinic(event.target.value)}><option value="all">All Clinics</option>{clinicOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></label></div>
      {error && <div role="alert" className="surveillance-error">{error}<button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
      {loading && <p role="status" className="surveillance-loading">Loading disease surveillance…</p>}
      <div className="surveillance-stats">
        <Stat title="Connected Clinics" value={value(summary?.active_clinics ?? 0)}>Participating veterinary clinics</Stat>
        <Stat title="Reported Disease Cases" value={value(cases)}>{change !== null ? <span className="surveillance-change">{change >= 0 ? '↑ +' : '↓ '}{change}% from previous {days} days</span> : `Reported in the last ${days} days`}</Stat>
        <Stat title="Potential Disease Alerts" value={value(alerts.length)} alert>Unusual increase in cases</Stat>
        <Stat title="Verified Alerts" value={value(summary?.verified_alerts ?? 0)}>No verified alerts recorded</Stat>
      </div>
      {alerts.length > 0 ? <section className="surveillance-banner"><div><h2>Unusual {alerts[0].disease} Activity</h2><p>Cases above recent baseline · {alerts[0].reporting_clinics || 1} reporting clinic{Number(alerts[0].reporting_clinics) === 1 ? '' : 's'}</p></div><button type="button" className="surveillance-primary" onClick={() => setSelectedAlert(alerts[0])}>Review Alert</button></section> : <section className="surveillance-banner is-clear"><div><h2>{loading ? 'Checking disease activity' : 'No unusual disease activity detected'}</h2><p>{loading ? 'Reviewing recorded cases in the selected period.' : 'No case increases meet the alert threshold in the selected period.'}</p></div>{Icons.shield}</section>}
      <div className="surveillance-charts">
        <section className="surveillance-card"><h2>Reported Disease Trends</h2><p>Monthly reported cases for selected common diseases over time.</p><div className="surveillance-chart">{trend.names.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trend.points} margin={{ top: 15, right: 18, left: -15, bottom: 0 }}><CartesianGrid stroke="#e8eee9" strokeDasharray="2 2" vertical /><XAxis dataKey="month" tick={{ fontSize: 11, fill: '#29483c' }} axisLine={{ stroke: '#bcc9c0' }} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#40564b' }} axisLine={{ stroke: '#bcc9c0' }} tickLine={false} /><Tooltip content={<ChartTooltip />} />{trend.names.map((name, index) => <Line key={name} name={name} dataKey={index === 0 ? 'a' : 'b'} type="linear" stroke={palette[index]} strokeWidth={2.4} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />)}</LineChart></ResponsiveContainer> : <div className="surveillance-chart-empty">{loading ? 'Loading trends…' : 'No disease trends recorded yet.'}</div>}</div><div className="surveillance-legend">{trend.names.map((name, index) => <span key={name}><i style={{ background: palette[index] }} />{name}</span>)}</div></section>
        <section className="surveillance-card"><h2>Most Reported Diseases</h2><p>Number of reported cases in the last {days} days.</p><div className="surveillance-chart">{topDiseases.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={topDiseases} layout="vertical" margin={{ top: 14, right: 34, left: 0, bottom: 0 }} barSize={17}><CartesianGrid stroke="#e8eee9" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#40564b' }} axisLine={{ stroke: '#bcc9c0' }} tickLine={false} /><YAxis type="category" dataKey="name" width={135} tick={{ fontSize: 10, fill: '#193a2a' }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="cases" name="Cases">{topDiseases.map((item, index) => <Cell key={item.name} fill={palette[index]} />)}<LabelList dataKey="cases" position="right" fill="#193a2a" fontSize={11} fontWeight={700} /></Bar></BarChart></ResponsiveContainer> : <div className="surveillance-chart-empty">{loading ? 'Loading diseases…' : 'No diseases reported in this period.'}</div>}</div></section>
      </div>
      <section className="surveillance-card surveillance-alerts"><h2>Recent Disease Alerts</h2><p>Latest disease alerts from across the clinic network.</p><div className="surveillance-table-wrap"><table><thead><tr><th>Disease</th><th>Reporting Area</th><th>Status</th><th>Last Updated</th><th>Action</th></tr></thead><tbody>{alertRows.map(alert => <tr key={alert.disease}><td><strong>{alert.disease}</strong></td><td>{alert.reporting_area || 'Not recorded'}</td><td><span className="surveillance-status"><i />Pending Review</span></td><td>{dateTime(alert.last_reported)}</td><td><button type="button" onClick={() => setSelectedAlert(alert)}>Review {Icons.chevronRight}</button></td></tr>)}{!alertRows.length && <tr><td colSpan="5" className="surveillance-table-empty">{loading ? 'Checking recorded cases…' : search ? 'No disease alerts match your search.' : 'No recent disease alerts in the selected period.'}</td></tr>}</tbody></table></div></section>
      <footer className="surveillance-footer"><span>{Icons.info}Aggregated surveillance data only · Individual patient records remain private</span><span>Last updated {summary?.checked_at ? new Date(summary.checked_at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '—'}</span></footer>
    </div>
    {selectedAlert && <AlertReview alert={selectedAlert} days={days} user={user} onClose={() => setSelectedAlert(null)} onNavigate={onNavigate} />}
  </main>;
}
