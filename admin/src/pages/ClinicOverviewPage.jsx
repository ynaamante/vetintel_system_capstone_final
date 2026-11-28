import { usePageState } from '../utils/usePageState.js';
import { apiFetch as fetch } from '../utils/apiFetch.js';
import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Topbar from '../components/Topbar';
import DateRangeFilter from '../components/DateRangeFilter';
import FilterSelect from '../components/FilterSelect';
import { dateInRange } from '../utils/dateFilters';
import { Icons } from '../icons';
import { canViewFeature, hasAction, roleProfile } from '../utils/permissionUtils';
import { ActivityDetailsDrawer } from './AuditTrailPage';
import './clinicOverview.css';

const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
const money=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(Number(value)||0);
const date=value=>value?new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'Not recorded';
const humanize=value=>String(value||'Activity recorded').replace(/_/g,' ');
const relative=value=>{const minutes=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));return minutes<1?'Just now':minutes<60?`${minutes} min${minutes===1?'':'s'} ago`:minutes<1440?`${Math.floor(minutes/60)} hours ago`:date(value);};
const change=(current,previous)=>previous?`${current>=previous?'↑ +':'↓ '}${Math.round((current-previous)/previous*100)}% vs last month`:`${current||0} this month`;
async function request(user,path,body,signal){const response=await fetch(api+path,{method:body?'PATCH':'GET',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},signal,...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load clinic information.');return data;}

function Dialog({title,onClose,children,subtitle,className=''}){
  const ref=useRef(null);
  useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>previous?.focus();},[]);
  return <dialog className={`co-dialog ${className}`} ref={ref} aria-label={title} onCancel={event=>{event.preventDefault();onClose();}}><header><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" onClick={onClose} aria-label="Close dialog">{subtitle?'Close':'×'}</button></header>{children}</dialog>;
}

const ACTIVITY_TYPES = {
  appointments: 'Appointment Management',
  patient_queue: 'Patient Queue',
  patient_registration_intakes: 'Patient Registration & Intakes',
  clients: 'Client Management',
  pets: 'Patient Records',
  consultations: 'Visits & Consultations',
  prescriptions: 'Medications & Prescriptions',
  vaccinations: 'Vaccinations',
  clinic_inpatient_stays: 'Inpatient Care',
  lab_results: 'Laboratory',
  invoices: 'Billing & Payments',
  payments: 'Billing & Payments',
  clinic_reminder_deliveries: 'Due Dates & Reminders',
  clinic_reports: 'Files & Documents',
};

const ACTIVITY_ACTIONS = {
  create_diagnosis: 'Added diagnosis',
  update_diagnosis: 'Updated diagnosis',
  request_restock: 'Requested inventory restock',
  upload_report: 'Uploaded report',
  upload_attachment: 'Uploaded attachment',
};

function activityCategory(row) {
  const category = String(row.category || '').toLowerCase();
  const action = String(row.action_code || row.action || '').toLowerCase();
  if (/^(check_?in|queue_)/.test(action)) return 'Patient Queue';
  if (/^upload_(report|attachment|document|file)$/.test(action)) return 'Files & Documents';
  if (category.includes('inventory') || category.includes('restock')) return 'Inventory';
  if (category.includes('diagnos')) return 'Diagnosis';
  if (/(file|document|attachment)/.test(category)) return 'Files & Documents';
  return ACTIVITY_TYPES[category] || 'Uncategorized';
}

function activityRole(role) {
  const normalized = String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (normalized === 'assistant_doctor') return 'Assistant Doctor';
  if (normalized === 'doctor' || normalized === 'veterinarian') return 'Doctor';
  if (normalized === 'receptionist') return 'Receptionist';
  return '';
}

function ActivityDialog({ rows, onClose }) {
  const [activityType, setActivityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const formatDay = value => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(`${value}T00:00:00+08:00`));
  const rangeLabel = dateFrom && dateTo ? `${formatDay(dateFrom)} – ${formatDay(dateTo)}`
    : dateFrom ? `From ${formatDay(dateFrom)}` : dateTo ? `Through ${formatDay(dateTo)}` : undefined;
  const entries = rows.map(row => ({ ...row, activityType: activityCategory(row), roleLabel: activityRole(row.actor_role) }));
  const types = [...new Set(entries.map(row => row.activityType))].sort();
  const options = [{ value: '', label: 'All Activities' }, ...types.map(type => ({ value: type, label: type }))];
  const filtered = entries.filter(row => (!activityType || row.activityType === activityType)
    && dateInRange(row.timestamp, dateFrom, dateTo));

  return <Dialog title="Recent Activity" subtitle="Review recent actions and updates from your clinic team." className="co-activity-dialog" onClose={onClose}>
    <section className="co-activity-filters" aria-label="Activity Log filters">
      <h3>Activity Log</h3>
      <div className="co-activity-filter-fields">
        <div><span>Activity Type</span><FilterSelect label="Activity Type" value={activityType} options={options} onChange={setActivityType} /></div>
        <div><span>Date Range</span><DateRangeFilter label="Date Range" rangeLabel={rangeLabel} dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} /></div>
      </div>
    </section>
    <ul className="co-activity-log">
      {filtered.map(row => <li key={row.id}>
        <span className="co-activity-category">{row.activityType}</span>
        <div><strong><span>{row.actor}</span> {ACTIVITY_ACTIONS[row.action_code] || humanize(row.action)}</strong><div className="co-activity-meta">{row.roleLabel && <span>{row.roleLabel} · </span>}<time dateTime={row.timestamp}>{date(row.timestamp)}</time></div></div>
      </li>)}
      {!filtered.length && <li className="co-activity-empty">{rows.length ? 'No activity matches these filters.' : 'No recent clinic activity.'}</li>}
    </ul>
  </Dialog>;
}

const appointmentTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

function OverviewListDialog({ modal, onClose }) {
  const appointments = modal.type === 'appointments';
  const columns = appointments
    ? ['Time', 'Pet & Owner', 'Reason for Visit', 'Consulting Veterinarian', 'Status']
    : ['Date Registered', 'Pet & Owner', 'Species', 'Breed', 'Registered By'];
  const title = modal.title;
  const listTitle = appointments ? 'Appointment List' : 'New Patient List';

  return <Dialog title={title} subtitle={appointments ? 'View and monitor all scheduled consultations for today.' : 'List of recently registered patients in the clinic.'} className="co-activity-dialog co-overview-list-dialog" onClose={onClose}>
    <div className="co-overview-list-heading"><h3>{listTitle}</h3><span>{appointments ? 'Total Appointments' : 'Total New Patients'}: {modal.total ?? modal.rows.length}</span></div>
    <div className="co-overview-list-scroll">
      <table aria-label={listTitle}>
        <thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {modal.rows.map(row => <tr key={row.id}>
            <td><time dateTime={appointments ? row.start_time : row.created_at}>{appointments ? (row.start_time ? appointmentTime.format(new Date(row.start_time)) : 'Not recorded') : date(row.created_at)}</time></td>
            <td><strong>{appointments ? row.pet || 'Patient' : row.name}{appointments && row.species ? ` (${row.species})` : ''}</strong><span className="co-overview-owner">{row.owner || 'Owner not recorded'}</span></td>
            {appointments ? <>
              <td>{row.reason || 'Not recorded'}</td><td>{row.doctor || 'Unassigned'}</td>
              <td><span className="co-overview-appointment-status" data-status={row.status}><i aria-hidden="true" />{humanize(row.status)}</span></td>
            </> : <>
              <td>{row.species || 'Not recorded'}</td><td>{row.breed || 'Not recorded'}</td><td className="co-overview-role">{activityRole(row.registered_by) || (row.registered_by ? humanize(row.registered_by) : 'Not recorded')}</td>
            </>}
          </tr>)}
          {!modal.rows.length && <tr><td className="co-empty" colSpan={columns.length}>{appointments ? 'No appointments scheduled for today.' : 'No patients registered today.'}</td></tr>}
        </tbody>
      </table>
    </div>
    {modal.total > modal.rows.length && <p className="co-overview-list-note">Showing {modal.rows.length} of {modal.total} records.</p>}
  </Dialog>;
}
export default function ClinicOverviewPage({user,onNavigate}){
  const allowed=roleProfile(user?.role)==='owner'&&canViewFeature(user?.permissions,user?.role,'Clinic Overview');
  const [data,setData]=usePageState(user, "pages/ClinicOverviewPage.jsx:data", null),[error,setError]=usePageState(user, "pages/ClinicOverviewPage.jsx:error", ''),[loading,setLoading]=usePageState(user, "pages/ClinicOverviewPage.jsx:loading", true, "loading");
  const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[revision,setRevision]=useState(0),[modal,setModal]=useState(null),[activityDetail,setActivityDetail]=useState(null);
  const canRevenue=hasAction(user?.permissions,user?.role,'View Clinic Overview')||hasAction(user?.permissions,user?.role,'View Revenue')||hasAction(user?.permissions,user?.role,'View Financial Reports');
  const refresh=()=>setRevision(value=>value+1);
  useEffect(()=>{const timer=window.setTimeout(()=>setQuery(search.trim()),300);return()=>window.clearTimeout(timer);},[search]);
  useEffect(()=>{
    if(!allowed||!user?.token){setLoading(false);return undefined;}
    const controller=new AbortController();setLoading(true);
    request(user,`/owner-monitoring/overview?search=${encodeURIComponent(query)}`,null,controller.signal)
      .then(overview=>{if(!controller.signal.aborted){setData(overview);setError('');}})
      .catch(failure=>{if(failure.name!=='AbortError')setError(failure.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[user?.token,user?.clinic_id,allowed,query,revision]);
  useEffect(()=>{const update=()=>{if(!document.hidden)setRevision(value=>value+1);};const timer=window.setInterval(update,30000);window.addEventListener('focus',update);window.addEventListener('vetintel:appointment-updated',update);return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('vetintel:appointment-updated',update);};},[]);
  const activity=(data?.activity||[]).map(row=>({...row,actor:row.actor||row.user||'System'})).filter(row=>`${row.actor} ${row.action}`.toLowerCase().includes(query.toLowerCase()));
  const count=value=>data?Number(value||0).toLocaleString():'—';
  const cards=[
    ['Total Patients',count(data?.total_patients),data?change(data.patients_this_month,data.patients_previous_month):'Registered clinic patients',data&&data.patients_this_month<data.patients_previous_month],
    ['Appointments',count(data?.appointments_this_month),data?change(data.appointments_this_month,data.appointments_previous_month):'This calendar month',data&&data.appointments_this_month<data.appointments_previous_month],
    ['Clinic Revenue',canRevenue?(data?money(data.revenue_this_month):'—'):'Restricted','Received this month',false],
  ];
  if(!allowed)return <main className="co-page"><Topbar user={user} title="Clinic Overview" subtitle="Clinic performance and operations"/><p className="co-empty">Clinic owner access is required.</p></main>;
  return <main className="co-page">
    <Topbar user={user} title="Clinic Overview" subtitle="Clinic performance and operations" className="co-topbar" actions={<label className="co-search">{Icons.search}<input aria-label="Search patients and clinic activity" placeholder="Search patients and clinic activity…" value={search} onChange={event=>setSearch(event.target.value)}/></label>}/>
    <div className="co-body">
      {error&&<div role="alert" className="co-error">{error} <button type="button" onClick={refresh}>Retry</button></div>}
      {loading&&!data&&<p role="status" className="co-muted">Loading your clinic overview…</p>}
      {query&&data?.patient_matches?.length>0&&<section className="co-panel co-search-results"><h2>Matching Patients</h2>{data.patient_matches.map(patient=><button type="button" key={patient.id} onClick={()=>setModal({title:'Patient Details',rows:[patient],type:'patients'})}><strong>{patient.name}</strong><span>{patient.species} · {patient.owner||'Owner not recorded'}</span>{Icons.chevronRight}</button>)}</section>}
      <section className="co-stats" aria-label="Clinic statistics">{cards.map(([label,value,sub,negative],index)=><article key={label}><h2>{label}</h2><strong>{value}</strong><p className={index<2?(negative?'negative':'positive'):''}>{sub}</p></article>)}</section>
      <div className="co-grid"><section className="co-panel co-revenue"><h2>Revenue Overview</h2><p>Total clinic revenue for the last 4 months.</p><div className="co-chart">{canRevenue&&data?<ResponsiveContainer width="100%" height="100%"><BarChart data={data.revenue} margin={{top:16,right:8,bottom:0,left:0}} barSize={72}><defs><linearGradient id="coRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#078249"/><stop offset="100%" stopColor="#004c2b"/></linearGradient></defs><CartesianGrid stroke="#d4ded9" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" axisLine={{stroke:'#89978f'}} tickLine={false} tick={{fontSize:12,fill:'#172b22'}}/><YAxis width={64} allowDecimals={false} axisLine={false} tickLine={false} tick={{fontSize:12,fill:'#334b40'}} tickFormatter={value=>Number(value).toLocaleString()}/><Tooltip formatter={value=>[money(value),'Received revenue']}/><Bar dataKey="revenue" fill="url(#coRevenue)" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer>:<p className="co-empty">{canRevenue?'Loading revenue…':'Financial report access is not enabled.'}</p>}</div></section>
      <div className="co-right"><section className="co-panel co-today"><h2>Today’s Overview</h2>{[["Today’s Appointments",data?.appointments_today,'appointments',data?.today_appointments],['New Patients',data?.new_patients_today,'patients',data?.new_patients]].map(([label,value,type,rows])=><button type="button" key={type} onClick={()=>setModal({title:label,type,rows:rows||[],total:value})}><span>{label}</span><strong>{count(value)}</strong>{Icons.chevronRight}</button>)}</section>
      </div></div>
      <section className="co-panel co-activity co-activity-lower"><header><div><h2>Recent Activity</h2><p>Latest actions and updates recorded in your clinic.</p></div><button type="button" className="co-activity-view-all" onClick={()=>onNavigate?.('audit')}>View All</button></header><ul>{activity.slice(0,3).map(row=>{const failed=/unauthorized|denied|fail|reject/i.test(String(row.action_code||row.action||''));const role=activityRole(row.actor_role)||'Staff';const title=String(row.action_code||row.action||'Activity').replace(/[_-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());return <li key={row.id}><i className={failed?'is-failed':''}/><button type="button" className="co-activity-row" onClick={()=>setActivityDetail({...row,rawId:row.id,id:row.id,description:title,role:row.actor_role,user:row.actor})}><span><strong>{title}</strong><small>{row.actor} · {role}</small></span><time dateTime={row.timestamp}>{relative(row.timestamp)}</time>{Icons.chevronRight}</button></li>;})}</ul>{!activity.length&&<p className="co-empty">{query?'No activity matches your search.':'No recent clinic activity.'}</p>}</section>
      <p className="co-updated">{data?.checked_at?`Last refreshed ${date(data.checked_at)}`:''}</p>
    </div>
    {modal?.type==='activity'?<ActivityDialog rows={activity} onClose={()=>setModal(null)}/>:modal&&<OverviewListDialog modal={modal} onClose={()=>setModal(null)}/>}
    {activityDetail&&<ActivityDetailsDrawer log={activityDetail} token={user.token} onClose={()=>setActivityDetail(null)}/>}
  </main>;
}
