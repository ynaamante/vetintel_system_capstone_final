import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import Topbar from '../components/Topbar';
import FilterSelect from '../components/FilterSelect';
import { Icons } from '../icons';
import { canViewFeature, hasAction } from '../utils/permissionUtils';
import { signalStatus } from '../utils/diseaseSignals';
import { useSurveillanceRefresh } from '../utils/useSurveillanceRefresh';
import { REPORT_TYPES, buildSurveillanceReport, reportTime } from '../utils/surveillanceReports';
import './reportsPage.css';

const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
async function get(user,path,signal) {
  const response=await fetch(`${api}/${path}`,{cache:'no-store',headers:{Authorization:`Bearer ${user.token}`},signal});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Unable to load report data.');
  return data;
}
function ReportTable({section,limit}) {
  const rows=limit?section.rows.slice(0,limit):section.rows;
  return <><div className="reports-table-scroll"><table><thead><tr>{section.columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{row.map((cell,cellIndex)=><td key={cellIndex}>{cell}</td>)}</tr>)}{!rows.length&&<tr><td className="reports-empty" colSpan={section.columns.length}>No matching data for these filters.</td></tr>}</tbody></table></div>{limit&&section.rows.length>limit&&<p className="reports-caption">Showing {limit} of {section.rows.length} rows. All matching rows are included in the file.</p>}</>;
}
export function ReportsPage({user,initialFilters={},generatedReports=[],onReportsChange}) {
  const revision=useSurveillanceRefresh();
  const [type,setType]=useState(REPORT_TYPES.some(item=>item.id===initialFilters.report_type)?initialFilters.report_type:'disease');
  const [filters,setFilters]=useState({days:initialFilters.days||'30',disease:initialFilters.disease||'',clinic_id:initialFilters.clinic_id||'',area:initialFilters.area||'',search:initialFilters.search||''});
  const [search,setSearch]=useState(initialFilters.search||'');
  const [status,setStatus]=useState(initialFilters.report_status||'');
  const [activeFormat,setActiveFormat]=useState('');
  const [format,setFormat]=useState('PDF');
  const [options,setOptions]=useState({diseases:[],clinics:[],areas:[]});
  const [snapshot,setSnapshot]=useState(null);
  const [loading,setLoading]=useState(true);
  const [generating,setGenerating]=useState(false);
  const [downloading,setDownloading]=useState(null);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const canView=canViewFeature(user.permissions,user.role,'Reports');
  const canGenerate=hasAction(user.permissions,user.role,'Generate Reports');
  const canExport=hasAction(user.permissions,user.role,'Export Reports');
  const query=new URLSearchParams({days:filters.days,...(filters.disease?{disease:filters.disease}:{}),...(filters.clinic_id?{clinic_id:filters.clinic_id}:{}),...(filters.area?{area:filters.area}:{}),...(filters.search?{search:filters.search}:{})}).toString();
  const searchPending=search.trim()!==filters.search;
  useEffect(()=>{const timer=setTimeout(()=>setFilters(current=>({...current,search:search.trim()})),300);return()=>clearTimeout(timer);},[search]);
  useEffect(()=>{
    if(!canView||generating)return;
    const controller=new AbortController();setLoading(true);setError('');setSnapshot(null);
    get(user,`disease-intelligence/summary?${query}`,controller.signal).then(data=>{
      buildSurveillanceReport(data,filters,'disease');
      setOptions({diseases:data.disease_options||[],clinics:data.clinic_options||[],areas:data.area_options||[]});
      setSnapshot({key:query,data});
    }).catch(failure=>{if(failure.name!=='AbortError')setError(failure.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
    // Query is the canonical representation of the API filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[canView,user.token,user.clinic_id,query,revision,refresh,generating]);
  const reportState=useMemo(()=>{
    if(!snapshot||snapshot.key!==query)return {report:null,error:''};
    try{return {report:buildSurveillanceReport(snapshot.data,filters,type,type==='signals'?status:''),error:''};}catch(failure){return {report:null,error:failure.message};}
  },[snapshot,query,filters,type,status]);
  const report=reportState.report;
  const ready=!!report&&!loading&&!searchPending&&!error&&!reportState.error;
  const setFilter=(key,value)=>setFilters(current=>({...current,[key]:value}));
  const verifyPermissions=async generate=>{
    const current=await get(user,'me');
    if(!canViewFeature(current.permissions,current.role,'Reports')||!hasAction(current.permissions,current.role,'Export Reports')||(generate&&!hasAction(current.permissions,current.role,'Generate Reports')))throw new Error('Your report permissions changed. Refresh the page to load your current access.');
  };
  const saveFile=(blob,filename)=>{
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const generate=async selectedFormat=>{
    if(!ready||!canGenerate||!canExport||generating)return;
    // Capture exactly what is displayed, before awaiting permission/file work.
    const captured=report,generatedAt=new Date().toISOString();
    setGenerating(true);setActiveFormat(selectedFormat);setError('');
    try {
      await verifyPermissions(true);
      const {createSurveillanceFile}=await import('../utils/surveillanceReportExport');
      const blob=await createSurveillanceFile(captured,selectedFormat,generatedAt);
      const filename=`${captured.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${captured.period.start}-to-${captured.period.end}-${generatedAt.replace(/[:.]/g,'-')}.${selectedFormat.toLowerCase()}`;
      saveFile(blob,filename);
      onReportsChange?.(previous=>[{id:filename,name:`${captured.title} – ${captured.period.start} to ${captured.period.end}`,generatedAt,snapshotAt:captured.snapshotAt,format:selectedFormat,scope:captured.scope,filename,blob},...previous]);
    }catch(failure){setError(failure.message);}finally{setGenerating(false);setActiveFormat('');}
  };
  const download=async row=>{
    if(!canExport||downloading)return;
    setDownloading(row.id);setError('');
    try {
      await verifyPermissions(false);
      saveFile(row.blob,row.filename);
    }catch(failure){setError(failure.message);}finally{setDownloading(null);}
  };
  const field=(key,label,items)=><div className="reports-field"><span>{label}</span><FilterSelect label={label} value={filters[key]} onChange={value=>setFilter(key,value)} options={items}/></div>;
  return <main className="reports-page">
    <Topbar className="reports-topbar" user={user} title="Reports" subtitle="Create and export disease surveillance summaries." actions={<label className="reports-search">{Icons.search}<input aria-label="Search report scope" placeholder="Search diseases, clinics, or barangays…" value={search} disabled={generating} onChange={event=>setSearch(event.target.value)}/></label>}/>
    {!canView?<p className="reports-body">You do not have permission to view Reports.</p>:<div className="reports-body">
      <section className="reports-panel"><h2>Report Type</h2><p>Choose the type of report to generate.</p><fieldset className="reports-types" disabled={generating}><legend className="reports-sr">Report type</legend>{REPORT_TYPES.map(item=><label key={item.id} className={type===item.id?'selected':''}><input type="radio" name="report-type" value={item.id} checked={type===item.id} onChange={()=>setType(item.id)}/><span><strong>{item.title}</strong><small>{item.description}</small></span></label>)}</fieldset></section>
      <section className="reports-panel reports-controls"><h2>Filters</h2><p>Refine the report scope.</p>
        <fieldset className="reports-filter-fields reports-unified-filters" disabled={generating}><legend className="reports-sr">Report filters</legend>
          {field('disease','Disease',[{value:'',label:'All Diseases'},...options.diseases.map(row=>({value:row.disease_key,label:row.disease}))])}
          {field('clinic_id','Participating Clinic',[{value:'',label:'All Clinics'},...options.clinics.map(row=>({value:String(row.id),label:row.name}))])}
          {field('area','Reporting Barangay',[{value:'',label:'All Barangays'},...[...new Set([...options.areas,...(filters.area?[filters.area]:[])])].map(area=>({value:area,label:area}))])}
          {field('days','Date Range',[30,60,90].map(days=>({value:String(days),label:'Last '+days+' Days'})))}
          {type==='signals'&&<div className="reports-field"><span>Status</span><FilterSelect label="Status" value={status} onChange={setStatus} options={[{value:'',label:'All Statuses'},...['new','under_review','resolved'].map(value=>({value,label:signalStatus(value)}))]}/></div>}
        </fieldset>
        <div className="reports-export-row"><fieldset className="reports-format" disabled={generating}><legend>Export Format</legend>{['PDF','CSV'].map(value=><label key={value}><input type="radio" name="report-format" checked={format===value} onChange={()=>setFormat(value)}/>{value}</label>)}</fieldset><button className="reports-primary" disabled={!ready||!canGenerate||!canExport||generating||!!downloading} onClick={()=>generate(format)}>{generating?'Preparing '+activeFormat+'...':'Generate Report'}</button></div>
        {(!canGenerate||!canExport)&&<p className="reports-caption">Report downloads are not enabled for your account.</p>}
      </section>
      {(error||reportState.error)&&<div className="reports-error" role="alert">{error||reportState.error}<button onClick={()=>setRefresh(value=>value+1)}>Refresh Preview</button></div>}
      <section className="reports-panel reports-preview" aria-busy={loading||searchPending}><header><div><h2>Report Preview</h2><p>Preview your selected report.</p></div>{report&&<span className="reports-snapshot">Snapshot: {reportTime(report.snapshotAt)} (Asia/Manila)</span>}</header>
        {loading||searchPending?<p role="status" className="reports-empty">Updating report preview…</p>:!report?<p className="reports-empty">Report data is unavailable. Refresh the preview to try again.</p>:<>
          <div className="reports-scope"><strong>{report.title}</strong><span>{report.period.start} – {report.period.end} · {report.scope.disease} · {report.scope.clinic} · {report.scope.area}{type==='signals'?` · ${report.scope.status}`:''}{filters.search?` · Search: ${filters.search}`:''}</span></div>
          <div className="reports-preview-grid"><section className="reports-preview-content">{type==='disease'?<><h3>Confirmed Cases Trend</h3><div className="reports-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={report.trend} margin={{top:24,right:18,left:-18,bottom:5}}><defs><linearGradient id="reportTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10862f" stopOpacity={0.23}/><stop offset="100%" stopColor="#10862f" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid stroke="#e4ece6" vertical={false}/><XAxis dataKey="label" tick={{fontSize:11}} interval="preserveStartEnd" minTickGap={18}/><YAxis allowDecimals={false} domain={[0,max=>Math.max(1,max)]} tick={{fontSize:11}}/><Tooltip formatter={value=>[value,'Released confirmed cases']} labelFormatter={(label,payload)=>`${label}${payload?.[0]?.payload?.suppressed?' · Some groups withheld':''}`}/><Area type="linear" dataKey="cases" stroke="#0a852d" fill="url(#reportTrend)" strokeWidth={2.5} dot={{r:3}} connectNulls={false}><LabelList dataKey="cases" position="top" formatter={value=>value>0?value:''} fontSize={12} fill="#145426"/></Area></AreaChart></ResponsiveContainer></div></>:<><h3>{report.sections[0].title}</h3><ReportTable section={report.sections[0]} limit={10}/></>}</section><section className="reports-summary"><h3>Summary</h3><dl>{report.summary.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></div>
          <p className="reports-caption">{type==='signals'?'Potential signals require review and do not confirm an outbreak.':'Confirmed cases only. Privacy protections apply.'}</p>

        </>}
      </section>
      <details className="reports-panel reports-recent"><summary>Recent downloads (this session)</summary><div className="reports-table-scroll"><table><thead><tr><th>Report Name</th><th>Generated (Asia/Manila)</th><th>Format</th><th>Action</th></tr></thead><tbody>{generatedReports.map(row=><tr key={row.id}><td><strong>{row.name}</strong><small className="reports-file-scope">{row.scope.disease} · {row.scope.clinic} · {row.scope.area}{row.scope.status!=='Not applicable'?` · ${row.scope.status}`:''}</small></td><td>{reportTime(row.generatedAt)}</td><td>{row.format}</td><td><button className="reports-download" disabled={!canExport||!!downloading} onClick={()=>download(row)}>{downloading===row.id?'Downloading…':'Download'}</button></td></tr>)}{!generatedReports.length&&<tr><td colSpan={4} className="reports-empty">No downloads yet.</td></tr>}</tbody></table></div>{!canExport&&<p className="reports-caption">Your role cannot download report files.</p>}</details>
    </div>}
  </main>;
}
