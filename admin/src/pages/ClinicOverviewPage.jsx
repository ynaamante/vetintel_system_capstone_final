import { usePageState } from '../utils/usePageState.js';
import { apiFetch as fetch } from '../utils/apiFetch.js';
import RequestDetails from '../components/RestockRequestDetails';
import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Topbar from '../components/Topbar';
import { Icons } from '../icons';
import { canViewFeature, hasAction, roleProfile } from '../utils/permissionUtils';
import './clinicOverview.css';

const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
const money=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(Number(value)||0);
const date=value=>value?new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'Not recorded';
const humanize=value=>String(value||'Activity recorded').replace(/_/g,' ');
const relative=value=>{const minutes=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));return minutes<1?'Just now':minutes<60?`${minutes} min${minutes===1?'':'s'} ago`:minutes<1440?`${Math.floor(minutes/60)} hours ago`:date(value);};
const change=(current,previous)=>previous?`${current>=previous?'↑ +':'↓ '}${Math.round((current-previous)/previous*100)}% vs last month`:`${current||0} this month`;
async function request(user,path,body,signal){const response=await fetch(api+path,{method:body?'PATCH':'GET',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},signal,...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load clinic information.');return data;}

function Dialog({title,onClose,children}){
  const ref=useRef(null);
  useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>previous?.focus();},[]);
  return <dialog className="co-dialog" ref={ref} onCancel={event=>{event.preventDefault();onClose();}}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog">×</button></header>{children}</dialog>;
}
function StockStatus({value}){return <span className={`co-status ${value==='Out of Stock'?'danger':value==='In Stock'?'good':'warning'}`}><i/>{value}</span>;}

export default function ClinicOverviewPage({user}){
  const allowed=roleProfile(user?.role)==='owner'&&canViewFeature(user?.permissions,user?.role,'Clinic Overview');
  const [data,setData]=usePageState(user, "pages/ClinicOverviewPage.jsx:data", null),[requests,setRequests]=usePageState(user, "pages/ClinicOverviewPage.jsx:requests", []),[error,setError]=usePageState(user, "pages/ClinicOverviewPage.jsx:error", ''),[loading,setLoading]=usePageState(user, "pages/ClinicOverviewPage.jsx:loading", true, "loading");
  const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[revision,setRevision]=useState(0),[selected,setSelected]=useState(null),[modal,setModal]=useState(null);
  const canInventory=hasAction(user?.permissions,user?.role,'View Clinic Overview')||hasAction(user?.permissions,user?.role,'View Inventory');
  const canRevenue=hasAction(user?.permissions,user?.role,'View Clinic Overview')||hasAction(user?.permissions,user?.role,'View Revenue')||hasAction(user?.permissions,user?.role,'View Financial Reports');
  const refresh=()=>setRevision(value=>value+1);
  useEffect(()=>{const timer=window.setTimeout(()=>setQuery(search.trim()),300);return()=>window.clearTimeout(timer);},[search]);
  useEffect(()=>{
    if(!allowed||!user?.token){setLoading(false);return undefined;}
    const controller=new AbortController();setLoading(true);
    Promise.all([request(user,`/owner-monitoring/overview?search=${encodeURIComponent(query)}`,null,controller.signal),canInventory?request(user,'/clinic-records/restock-requests',null,controller.signal):Promise.resolve([])])
      .then(([overview,rows])=>{if(!controller.signal.aborted){setData(overview);setRequests(rows);setError('');}})
      .catch(failure=>{if(failure.name!=='AbortError')setError(failure.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[user?.token,user?.clinic_id,allowed,canInventory,query,revision]);
  useEffect(()=>{const update=()=>{if(!document.hidden)setRevision(value=>value+1);};const timer=window.setInterval(update,30000);window.addEventListener('focus',update);window.addEventListener('vetintel:appointment-updated',update);return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('vetintel:appointment-updated',update);};},[]);
  const visibleRequests=requests.filter(row=>`${row.item} ${row.requested_by_name} ${row.stock_status}`.toLowerCase().includes(query.toLowerCase()));
  const activity=(data?.activity||[]).filter(row=>`${row.actor} ${row.action}`.toLowerCase().includes(query.toLowerCase()));
  const count=value=>data?Number(value||0).toLocaleString():'—';
  const cards=[
    ['Total Patients',count(data?.total_patients),data?change(data.patients_this_month,data.patients_previous_month):'Registered clinic patients',data&&data.patients_this_month<data.patients_previous_month],
    ['Appointments',count(data?.appointments_this_month),data?change(data.appointments_this_month,data.appointments_previous_month):'This calendar month',data&&data.appointments_this_month<data.appointments_previous_month],
    ['Clinic Revenue',canRevenue?(data?money(data.revenue_this_month):'—'):'Restricted','Received this month',false],
    ['Pending Restock Requests',canInventory?count(data?.pending_restock_requests):'Restricted','From the doctors',false],
  ];
  if(!allowed)return <main className="co-page"><Topbar user={user} title="Clinic Overview" subtitle="Clinic performance, operations, and inventory requests"/><p className="co-empty">Clinic owner access is required.</p></main>;
  return <main className="co-page">
    <Topbar user={user} title="Clinic Overview" subtitle="Clinic performance, operations, and inventory requests" className="co-topbar" actions={<label className="co-search">{Icons.search}<input aria-label="Search patients, items, or requests" placeholder="Search patients, items, or requests…" value={search} onChange={event=>setSearch(event.target.value)}/></label>}/>
    <div className="co-body">
      {error&&<div role="alert" className="co-error">{error} <button type="button" onClick={refresh}>Retry</button></div>}
      {loading&&!data&&<p role="status" className="co-muted">Loading your clinic overview…</p>}
      {query&&data?.patient_matches?.length>0&&<section className="co-panel co-search-results"><h2>Matching Patients</h2>{data.patient_matches.map(patient=><button type="button" key={patient.id} onClick={()=>setModal({title:'Patient Details',rows:[patient],type:'patients'})}><strong>{patient.name}</strong><span>{patient.species} · {patient.owner||'Owner not recorded'}</span>{Icons.chevronRight}</button>)}</section>}
      <section className="co-stats" aria-label="Clinic statistics">{cards.map(([label,value,sub,negative],index)=><article key={label}><h2>{label}</h2><strong>{value}</strong><p className={index<2?(negative?'negative':'positive'):''}>{sub}</p></article>)}</section>
      <section className="co-panel co-restock"><header><div><h2>Pending Restock Requests</h2><p>Item requests from the doctors for inventory replenishment.</p></div></header><div className="co-table-scroll"><table><thead><tr><th>Item Requested</th><th>Requested by</th><th>Date Requested</th><th>Status</th><th><span className="co-sr-only">Details</span></th></tr></thead><tbody>{visibleRequests.slice(0,3).map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={event=>{if(event.target===event.currentTarget&&["Enter"," "].includes(event.key)){event.preventDefault();setSelected(row);}}}><td><strong>{row.item}</strong></td><td>{row.requested_by_name}</td><td>{date(row.created_at)}</td><td><StockStatus value={row.stock_status}/></td><td><button type="button" className="co-row-open" aria-label={`Review ${row.item} request`} onClick={()=>setSelected(row)}>{Icons.chevronRight}</button></td></tr>)}{!visibleRequests.length&&<tr><td colSpan={5} className="co-empty">{!canInventory?'Inventory access is not enabled.':loading?'Loading requests…':query?'No requests match your search.':'No pending restock requests.'}</td></tr>}</tbody></table></div></section>
      <div className="co-grid"><section className="co-panel co-revenue"><h2>Revenue Overview</h2><p>Total clinic revenue for the last 4 months.</p><div className="co-chart">{canRevenue&&data?<ResponsiveContainer width="100%" height="100%"><BarChart data={data.revenue} margin={{top:16,right:8,bottom:0,left:0}} barSize={72}><defs><linearGradient id="coRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#078249"/><stop offset="100%" stopColor="#004c2b"/></linearGradient></defs><CartesianGrid stroke="#d4ded9" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" axisLine={{stroke:'#89978f'}} tickLine={false} tick={{fontSize:12,fill:'#172b22'}}/><YAxis width={64} allowDecimals={false} axisLine={false} tickLine={false} tick={{fontSize:12,fill:'#334b40'}} tickFormatter={value=>Number(value).toLocaleString()}/><Tooltip formatter={value=>[money(value),'Received revenue']}/><Bar dataKey="revenue" fill="url(#coRevenue)" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer>:<p className="co-empty">{canRevenue?'Loading revenue…':'Financial report access is not enabled.'}</p>}</div></section>
      <div className="co-right"><section className="co-panel co-today"><h2>Today’s Overview</h2>{[["Today’s Appointments",data?.appointments_today,Icons.calendar,'appointments',data?.today_appointments],['New Patients',data?.new_patients_today,Icons.users,'patients',data?.new_patients]].map(([label,value,icon,type,rows])=><button type="button" key={type} onClick={()=>setModal({title:label,type,rows:rows||[]})}><span className="co-today-icon">{icon}</span><span>{label}</span><strong>{count(value)}</strong>{Icons.chevronRight}</button>)}</section>
      <section className="co-panel co-activity"><header><h2>Recent Activity</h2><button type="button" onClick={()=>setModal({title:'Recent Activity',type:'activity',rows:activity})}>View All</button></header><ul>{activity.slice(0,3).map(row=><li key={row.id}><i/><span><strong>{row.actor}</strong> {humanize(row.action)}</span><time dateTime={row.timestamp}>{relative(row.timestamp)}</time></li>)}</ul>{!activity.length&&<p className="co-empty">{query?'No activity matches your search.':'No recent clinic activity.'}</p>}</section></div></div>
      <p className="co-updated">{data?.checked_at?`Last refreshed ${date(data.checked_at)}`:''}</p>
    </div>
    {selected&&<RequestDetails key={selected.id} row={selected} user={user} onClose={()=>setSelected(null)} onSaved={refresh}/>}
    {modal&&<Dialog title={modal.title} onClose={()=>setModal(null)}><div className="co-detail-list">{modal.rows.map((row,index)=><article key={row.id||index}>{modal.type==='appointments'?<><strong>{row.pet||'Patient'} · {new Date(row.start_time).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'})}</strong><span>{row.reason} · {row.doctor||'Unassigned'} · {humanize(row.status)}</span></>:modal.type==='patients'?<><strong>{row.name}</strong><span>{row.species} · {row.owner||'Owner not recorded'} · Registered {date(row.created_at)}</span></>:<><strong>{row.actor} {humanize(row.action)}</strong><span>{date(row.timestamp)}</span></>}</article>)}{!modal.rows.length&&<p className="co-empty">No records to display.</p>}</div></Dialog>}
  </main>;
}
