import { usePageState } from '../utils/usePageState.js';
import { apiFetch as fetch } from '../utils/apiFetch.js';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { AlertDetails } from '../components/DiseaseMonitoringWorkspace';
import { useSurveillanceRefresh } from '../utils/useSurveillanceRefresh';
import Topbar from '../components/Topbar';
import FilterSelect from '../components/FilterSelect';
import { Icons } from '../icons';
import './dashboardPage.css';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const shortDate = value => new Date(value + 'T00:00:00Z').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return <div className="surveillance-tooltip"><strong>{point.label}</strong><p>{point.cases} released confirmed cases</p>{point.partial && <p>Partial week: selected dates only.</p>}{point.suppressed && <p>Some network data is withheld.</p>}</div>;
}
ChartTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({
    payload: PropTypes.shape({
      label: PropTypes.string,
      cases: PropTypes.number,
      partial: PropTypes.bool,
      suppressed: PropTypes.bool,
    }),
  })),
};
function Stat({ title, value, children, alert }) {
  return <section className={`surveillance-stat${alert ? ' is-alert' : ''}`}><h2>{title}</h2><strong>{value}</strong><div>{children}</div></section>;
}
Stat.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  children: PropTypes.node,
  alert: PropTypes.bool,
};
export default function DashboardPage({ user, onNavigate, initialFilters = {}, onFiltersChange }) {
  const revision = useSurveillanceRefresh();
  const [summary, setSummary] = usePageState(user, "pages/DashboardPage.jsx:summary", null);
  const [days, setDays] = useState(initialFilters.days || '30');
  const [clinic, setClinic] = useState(initialFilters.clinic_id || '');
  const [disease, setDisease] = useState(initialFilters.disease || '');
  const [area, setArea] = useState(initialFilters.area || '');
  const [monitoringSearch, setMonitoringSearch] = useState(initialFilters.search || '');
  const [options, setOptions] = usePageState(user, "pages/DashboardPage.jsx:options", { clinics: [], diseases: [] });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = usePageState(user, "pages/DashboardPage.jsx:error", '');
  const [loading, setLoading] = usePageState(user, "pages/DashboardPage.jsx:loading", true, "loading");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!user?.token) { setError('Sign in to load disease surveillance.'); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    const query = new URLSearchParams({ days, ...(clinic ? { clinic_id: clinic } : {}), ...(disease ? { disease } : {}), ...(area ? {area} : {}), ...(monitoringSearch ? {search:monitoringSearch} : {}) });
    fetch(`${api}/disease-intelligence/summary?${query}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error || 'Unable to load dashboard data.'); setSummary(data); setOptions({ clinics: data.clinic_options || [], diseases: data.disease_options || [] }); })
      .catch(failure => { if (failure.name !== 'AbortError') setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.token, user?.clinic_id, days, clinic, disease, area, monitoringSearch, refresh, revision]);
  useEffect(() => {
    const reload = () => setRefresh(value => value + 1);
    window.addEventListener('vetintel:appointment-updated', reload); window.addEventListener('focus', reload);
    return () => { window.removeEventListener('vetintel:appointment-updated', reload); window.removeEventListener('focus', reload); };
  }, []);
  useEffect(() => { onFiltersChange?.({days,disease,clinic_id:clinic,area,search:monitoringSearch}); }, [days,disease,clinic,area,monitoringSearch,onFiltersChange]);
  const alerts = (summary?.alerts || []).filter(item => item.status !== 'resolved');
  const rising = alerts.find(item => item.automatic);
  const warning = rising || alerts[0];
  const rows = alerts.filter(item => `${item.disease} ${item.area || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const cases = Number(summary?.total_cases) || 0;
  const previousCases = Number(summary?.previous_cases) || 0;
  const change = previousCases ? Math.round((cases - previousCases) / previousCases * 100) : null;
  const underReviewCount = alerts.filter(item => item.status === 'under_review').length;
  const topDiseases = [...(summary?.diseases || [])]
    .filter(item => Number(item.cases) > 0)
    .sort((a, b) => Number(b.cases) - Number(a.cases))
    .slice(0, 5)
    .map(item => ({ label: item.disease, name: item.disease, cases: Number(item.cases) }));
  const trend = (summary?.trend || []).map(point => ({ ...point, label: `${shortDate(point.case_date)}–${shortDate(point.period_end)}${point.partial ? '*' : ''}` }));
  const value = number => loading || error ? '—' : number;
  const navigate = page => onNavigate?.(page, { days, disease, clinic_id: clinic, area, search:monitoringSearch });
  return <main className="surveillance-dashboard">
    <Topbar user={user} title="Dashboard" subtitle="Reported infectious diseases across participating clinics in Santa Maria, Bulacan." className="surveillance-topbar" actions={<label className="surveillance-search">{Icons.search}<input aria-label="Search recent signals" placeholder="Search diseases or reporting areas…" value={search} onChange={event => setSearch(event.target.value)} /></label>} />
    <div className="surveillance-body">
      <div className="surveillance-filters">
        <div className="surveillance-filter-field"><span>Disease</span><FilterSelect className="surveillance-dashboard-filter" label="Disease" value={disease} onChange={setDisease} options={[{value:'',label:'All Diseases'},...options.diseases.map(item => ({value:item.disease_key,label:item.disease}))]} /></div>
        <div className="surveillance-filter-field"><span>Participating Clinic</span><FilterSelect className="surveillance-dashboard-filter" label="Reporting clinic" value={clinic} onChange={setClinic} options={[{value:'',label:'All Clinics'},...options.clinics.map(item => ({value:item.id,label:item.name}))]} /></div>
        <div className="surveillance-filter-field"><span>Date Range</span><FilterSelect className="surveillance-dashboard-filter" label="Reporting period" value={days} onChange={setDays} options={[30,60,90].map(number => ({value:String(number),label:`Last ${number} Days`}))} /></div>
      </div>
      {monitoringSearch && <p className="surveillance-scope">Monitoring search: {monitoringSearch} <button onClick={() => setMonitoringSearch('')}>Clear search filter</button></p>}
      {area && <p className="surveillance-scope">Reporting barangay: {area} <button onClick={() => setArea('')}>Clear barangay filter</button></p>}
      {error && <div role="alert" className="surveillance-error">{error}<button onClick={() => setRefresh(number => number + 1)}>Retry</button></div>}
      {loading && <p role="status" className="surveillance-loading">Loading disease surveillance…</p>}
      <div className="surveillance-stats" aria-busy={loading}>
        <Stat title="Connected Clinics" value={value(summary?.active_clinics ?? 0)}>{value(summary?.affected_clinics ?? 0)} reporting cases in this period.</Stat>
        <Stat title="Reported Disease Cases" value={value(cases)}>{change !== null ? <span className="surveillance-change">{change >= 0 ? '↑ +' : '↓ '}{change}% from previous {days} days</span> : `Reported in the last ${days} days`}</Stat>
        <Stat title="Potential Disease Alerts" value={value(alerts.length)} alert>Open signals requiring review.</Stat>
        <Stat title="Signals Under Review" value={value(underReviewCount)}>Signals currently being reviewed.</Stat>
      </div>
      {!error && (warning ? <section className="surveillance-banner surveillance-trend-banner" aria-label="Disease trend detected">
        <div className="surveillance-trend-icon" aria-hidden="true">{Icons.activity}</div>
        <div className="surveillance-trend-copy"><p className="surveillance-trend-label">Disease trend detected</p><h2>{warning.disease} {rising ? 'Cases Increasing' : 'Signal to Review'}</h2><p>{warning.area}. Review the signal before deciding whether to send an advisory.</p></div>
        <dl className="surveillance-trend-counts">
          <div><dt>{rising ? 'Latest completed week' : 'Signal week'}</dt><dd>{warning.observed_cases}</dd></div>
          <div><dt>Previous week</dt><dd>{warning.baseline_cases ?? 'Withheld'}</dd></div>
          {rising && <div><dt>Increase</dt><dd>{rising.baseline_cases ? '+' + Math.round((rising.observed_cases - rising.baseline_cases) / rising.baseline_cases * 100) + '%' : 'New activity'}</dd></div>}
        </dl>
        <button type="button" className="surveillance-primary" onClick={() => setSelected(warning)}>Review Signal</button>
      </section> : <section className="surveillance-banner is-clear" role="status"><div><h2>{loading && !summary ? 'Checking disease activity' : 'Disease Monitoring Active'}</h2><p>{loading && !summary ? 'Reviewing recorded cases in the selected period.' : 'Confirmed disease cases are being monitored automatically. No potential disease signals currently require review.'}</p></div>{Icons.shield}</section>)}
      <p className="surveillance-scope">Open signals are unresolved signals for reporting weeks overlapping the selected period and matching your filters.</p>
      <div className="surveillance-charts">
        <section className="surveillance-card"><header><h2>New Confirmed Cases per Week</h2><button className="surveillance-link" onClick={() => navigate('disease')}>Explore cases →</button></header><p>Finalized, confirmed case episodes recorded each week.</p>
          <div className="surveillance-chart">{summary ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 25, right: 22, left: -16, bottom: 12 }}><defs><linearGradient id="dashboardCases" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16953b" stopOpacity={0.2} /><stop offset="100%" stopColor="#16953b" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#e4ece7" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Area dataKey="cases" type="linear" stroke="#078225" strokeWidth={2.5} fill="url(#dashboardCases)" dot={{ r: 4, fill: '#0c8b28' }} connectNulls={false}><LabelList dataKey="cases" position="top" fill="#115327" fontSize={12} /></Area></AreaChart></ResponsiveContainer> : <div className="surveillance-chart-empty">{loading ? 'Loading trends…' : 'Trend unavailable.'}</div>}</div>
          <div className="surveillance-chart-note"><strong>Total: {value(summary?.total_cases ?? 0)} confirmed cases</strong><span>Based on diagnosis episode date (first recorded).</span></div>
          <p className="surveillance-period">{summary?.period && `${shortDate(summary.period.start)} – ${shortDate(summary.period.end)} · ${days} days (Asia/Manila). `}* Partial week: only dates inside the selected period are included.</p>
        </section>
        <section className="surveillance-card"><h2>Most Reported Diseases</h2><p>Released cases in the selected period.</p>
          <div className="surveillance-chart">{topDiseases.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={topDiseases} layout="vertical" margin={{ top: 14, right: 34, left: 0, bottom: 0 }} barSize={17}><CartesianGrid stroke="#e8eee9" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#40564b' }} axisLine={{ stroke: '#bcc9c0' }} tickLine={false} /><YAxis type="category" dataKey="name" width={135} tick={{ fontSize: 10, fill: '#193a2a' }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="cases" name="Cases">{topDiseases.map((item, index) => <Cell key={item.name} fill={['#00731c', '#69bd17', '#94d76d', '#b6e883', '#e3f5d0'][index]} />)}<LabelList dataKey="cases" position="right" fill="#193a2a" fontSize={11} fontWeight={700} /></Bar></BarChart></ResponsiveContainer> : <div className="surveillance-chart-empty">{loading ? 'Loading diseases…' : 'No diseases reported in this period.'}</div>}</div>
        </section>
        <section className="surveillance-card surveillance-alerts"><header><h2>Recent Disease Signals</h2><button className="surveillance-link" onClick={() => navigate('risk')}>View all signals →</button></header><p>Potential disease signals by reporting area.</p>
          <div className="surveillance-table-wrap"><table><thead><tr><th>Disease /<br />Reporting Area</th><th>Cases<small>Signal week vs.<br />previous week</small></th><th>Status</th><th><span className="surveillance-sr">Review</span></th></tr></thead><tbody>{rows.slice(0, 4).map(alert => <tr key={alert.id}><td><strong>{alert.disease}</strong><span className="surveillance-area">{alert.area}</span></td><td><strong className="surveillance-case-comparison">{alert.observed_cases} vs {alert.baseline_cases ?? 'Withheld'}</strong></td><td><span className={`surveillance-status ${alert.status}`}><i />{alert.status === 'under_review' ? 'Under Review' : 'Needs Review'}</span></td><td><button aria-label={`Review ${alert.disease} signal in ${alert.area}`} onClick={() => setSelected(alert)}>{Icons.chevronRight}</button></td></tr>)}{!rows.length && <tr><td colSpan={4} className="surveillance-table-empty">{loading ? 'Loading signals…' : error ? 'Signals unavailable.' : search ? 'No signals match your search.' : 'No open signals for this period.'}</td></tr>}</tbody></table></div>
          <p className="surveillance-signal-note">{Icons.info} Signals require verification and do not confirm an outbreak.</p>
        </section>
      </div>
      <footer className="surveillance-footer"><span>{Icons.info}{summary?.privacy?.notice || 'Individual patient records remain private. Shared counts follow privacy safeguards.'}</span><span>Last updated {summary?.checked_at ? new Date(summary.checked_at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '—'}</span></footer>
    </div>
    {selected && <AlertDetails row={selected} user={user} onNavigate={onNavigate} filters={{days,disease,clinic_id:clinic,area,search:monitoringSearch}} onClose={() => setSelected(null)} onSaved={() => setRefresh(number => number + 1)} />}
  </main>;
}
DashboardPage.propTypes = {
  user: PropTypes.shape({
    token: PropTypes.string,
    clinic_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  onNavigate: PropTypes.func,
  initialFilters: PropTypes.object,
  onFiltersChange: PropTypes.func,
};
