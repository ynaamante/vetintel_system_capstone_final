import { useEffect, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import Topbar from './Topbar';
import FilterSelect from './FilterSelect';
import { Icons } from '../icons';
import { canViewFeature, hasAction, roleProfile } from '../utils/permissionUtils';
import './diseaseCaseExplorer.css';
import './monitoringSummary.css';

const shortDate = value => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-PH', {month:'short',day:'numeric',timeZone:'UTC'});
const change = row => row.has_withheld || row.cases === null || row.previous_cases === null ? 'Unavailable' : row.previous_cases === 0 ? row.cases > 0 ? 'New' : '—' : `${row.cases > row.previous_cases ? '+' : ''}${Math.round((row.cases-row.previous_cases)/row.previous_cases*100)}%`;
function groupedRows(rows, mode) {
  if (mode === 'disease') return rows;
  const groups = new Map();
  for (const row of rows) {
    const key = mode === 'clinic' ? String(row.clinic_id) : row.area;
    if (!groups.has(key)) groups.set(key, {clinic_id:mode==='clinic'?row.clinic_id:'',clinic_name:mode==='clinic'?row.clinic_name:'All selected clinics',area:mode==='area'?row.area:row.area,disease:'All selected diseases',cases:0,previous_cases:0,has_withheld:false,has_current:false,has_previous_hidden:false});
    const group = groups.get(key);
    if (row.cases !== null) { group.cases += row.cases; group.has_current = true; }
    if (row.previous_cases === null) group.has_previous_hidden = true;
    else group.previous_cases += row.previous_cases;
    group.has_withheld ||= row.has_withheld;
  }
  return [...groups.values()].map(row=>({...row,cases:row.has_current?row.cases:null,previous_cases:row.has_previous_hidden?null:row.previous_cases})).sort((a,b)=>(b.cases||0)-(a.cases||0));
}

export default function DiseaseCaseExplorer({user,data,loading,error,filters,search,onSearch,onApply,onRetry,onExport,onRules,onNavigate}) {
  const [draft,setDraft] = useState(filters);
  const [mode,setMode] = useState('disease');
  const [selected,setSelected] = useState(null);
  const [limit,setLimit] = useState(10);
  const [toolsOpen,setToolsOpen] = useState(false);
  const dirty = ['disease','clinic_id','area','days'].some(key=>String(draft[key]||'')!==String(filters[key]||''));
  const rows = groupedRows(data.case_summaries || [],mode);
  const diseases = (data.diseases || []).filter(row=>row.cases>0).sort((a,b)=>b.cases-a.cases);
  const trend = (data.trend || []).map(row=>({...row,label:`${shortDate(row.case_date)}–${shortDate(row.period_end)}${row.partial?'*':''}`}));
  const value = number => loading || error ? '—' : number;
  const apply = next => {setDraft(next);setLimit(10);onApply(next);};
  const rowFilters = row => ({...filters,disease:row.disease_key||filters.disease,clinic_id:row.clinic_id?String(row.clinic_id):filters.clinic_id,area:row.area||filters.area});
  const navigate = (page,context=filters) => onNavigate?.(page,context);
  const field = (key,label,options) => <div className="dce-field"><span>{label}</span><FilterSelect label={label} value={draft[key]} onChange={value=>setDraft(current=>({...current,[key]:value}))} options={options}/></div>;
  return <div className="dm-page dce-page">
    <Topbar className="dm-topbar" user={user} title="Disease Monitoring" subtitle="Explore confirmed cases by disease, participating clinic, and reporting barangay." actions={<label className="dm-search">{Icons.search}<input aria-label="Search diseases, areas, or reporting clinics" placeholder="Search diseases, clinics, or reporting areas…" value={search} onChange={event=>onSearch(event.target.value)}/></label>}/>
    <div className="dm-body">
      <form className="dce-filters" onSubmit={event=>{event.preventDefault();apply(draft);}}>
        {field('disease','Disease',[{value:'',label:'All Diseases'},...(data.disease_options||[]).map(row=>({value:row.disease_key,label:row.disease}))])}
        {field('clinic_id','Participating Clinic',[{value:'',label:'All Clinics'},...(data.clinic_options||[]).map(row=>({value:String(row.id),label:row.name}))])}
        {field('area','Reporting Barangay',[{value:'',label:'All Reporting Barangays'},...[...new Set([...(data.area_options||[]),...(filters.area?[filters.area]:[])])].map(area=>({value:area,label:area}))])}
        {field('days','Date Range',[30,60,90].map(days=>({value:String(days),label:`Last ${days} Days`})))}
        <button className="dm-primary" disabled={loading}>Apply Filters</button>
      </form>
      {dirty&&<p className="dm-footnote" role="status">Filters changed. Select Apply Filters to update the results.</p>}
      {error&&<p role="alert" className="dm-error">{error} <button onClick={onRetry}>Retry</button></p>}
      <div className="dce-metrics monitoring-summary monitoring-summary-four" aria-busy={loading}>
        <article><h2>Confirmed Cases</h2><strong>{value(data.total_cases??0)}</strong><p>Finalized diagnoses in the selected period.</p></article>
        <article><h2>Participating Clinics</h2><strong>{value(data.active_clinics??'—')}</strong><p>Total connected clinics.</p></article>
        <article><h2>Clinics Reporting Cases</h2><strong>{value(data.affected_clinics??0)}</strong><p>Clinics with released confirmed cases.</p></article>
        <article><h2>Diseases Reported</h2><strong>{value(diseases.length)}</strong><p>Unique diseases in the selected period.</p></article>
      </div>
      {loading&&<p role="status">Loading confirmed surveillance data…</p>}
      <div className="dce-charts">
        <section className="dm-panel"><header><div><h2>Confirmed Cases Over Time</h2><p>New confirmed case episodes per week within the selected period.</p></div></header>
          <div className="dm-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{top:20,right:20,left:-22,bottom:0}}><defs><linearGradient id="dceCases" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#138a37" stopOpacity={0.22}/><stop offset="100%" stopColor="#138a37" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e3ebe5"/><XAxis dataKey="label" tick={{fontSize:12}} minTickGap={12} interval="preserveStartEnd" tickLine={false}/><YAxis allowDecimals={false} domain={[0,max=>Math.max(1,max)]} tick={{fontSize:12}} tickLine={false}/><Tooltip formatter={value=>[value,'Released cases']} labelFormatter={(label,payload)=>`${label}${payload?.[0]?.payload?.partial?' (partial week)':''}`}/><Area type="linear" dataKey="cases" stroke="#0a852d" fill="url(#dceCases)" strokeWidth={2.5} dot={{r:3}} connectNulls={false}><LabelList dataKey="cases" position="top" formatter={value=>value>0?value:''} fill="#155326" fontSize={12}/></Area></AreaChart></ResponsiveContainer></div>
        </section>
        <section className="dm-panel"><h2>Cases by Disease</h2><p>All diseases with released cases in the selected period.</p>
          {diseases.length?<ul className="dce-disease-bars" aria-label="Cases by disease">{diseases.map(row=><li key={row.disease_key}><span title={row.disease}>{row.disease}</span><div className="dce-bar-track" aria-hidden="true"><div style={{width:`${row.cases/diseases[0].cases*100}%`}}/></div><strong>{row.cases}</strong></li>)}</ul>:<p className="dm-empty">{loading?'Loading diseases…':error?'Disease counts unavailable.':'No released cases for these filters.'}</p>}
        </section>
      </div>
      <section className="dm-panel dce-summaries"><header><div><h2>Case Summaries</h2><p>Grouped confirmed case counts matching the applied filters.</p></div><div className="dce-view-controls">{[['disease','By Disease'],['clinic','By Clinic'],['area','By Barangay']].map(([key,label])=><button key={key} aria-pressed={mode===key} onClick={()=>{setMode(key);setLimit(10);}}>{label}</button>)}{canViewFeature(user.permissions,user.role,'Reports')&&<button className="monitoring-report-shortcut" onClick={()=>navigate('reports',{...filters,report_type:'disease'})}>Download Report</button>}</div></header>
        <div className="dm-scroll"><table><thead><tr>{mode==='disease'&&<th>Disease</th>}{mode!=='area'&&<th>Participating Clinic</th>}<th>Reporting Barangay</th><th>Cases</th><th>Previous {filters.days} Days</th><th>Change</th><th><span className="dm-sr">Details</span></th></tr></thead><tbody>{rows.slice(0,limit).map((row,index)=><tr key={index}><td>{mode==='disease'?<strong>{row.disease}</strong>:mode==='clinic'?row.clinic_name:row.area}</td>{mode==='disease'&&<td>{row.clinic_name}</td>}{mode!=='area'&&<td>{row.area}</td>}<td><strong>{row.cases??'Withheld'}</strong>{row.has_withheld&&row.cases!==null&&<small className="dce-partial">Partial data</small>}</td><td>{row.previous_cases??'Withheld'}</td><td className={change(row).startsWith('+')?'dm-red':''}>{change(row)}</td><td><button className="dm-chevron" disabled={loading||!!error} aria-label={`View summary for ${mode==='disease'?row.disease:mode==='clinic'?row.clinic_name:row.area}`} onClick={()=>setSelected(row)}>{Icons.chevronRight}</button></td></tr>)}{!rows.length&&<tr><td colSpan={7} className="dm-empty">{loading?'Loading case summaries…':error?'Summaries unavailable.':'No case summaries match these filters.'}</td></tr>}</tbody></table></div>
        <div className="dce-table-footer"><span>Showing {Math.min(limit,rows.length)} of {rows.length} summaries · Total released cases: {value(data.total_cases??0)}</span>{limit<rows.length&&<button onClick={()=>setLimit(current=>current+10)}>Show more</button>}</div>
        <p className="dce-brief-note">{Icons.info} Finalized, confirmed cases only. Dates use the diagnosis episode’s first-recorded date.</p>
      </section>
      <div className="dce-bottom-tools"><button aria-expanded={toolsOpen} onClick={()=>setToolsOpen(open=>!open)}>Monitoring details &amp; tools {toolsOpen?'−':'+'}</button>{data.period&&<span>{shortDate(data.period.start)} – {shortDate(data.period.end)} · {filters.days} days</span>}</div>
      {toolsOpen&&<section className="dce-details"><div className="dce-actions">
        {roleProfile(user.role)==='owner'&&hasAction(user.permissions,user.role,'Configure Alert Rules')&&<button disabled={loading} onClick={onRules}>Alert Rules</button>}
        {canViewFeature(user.permissions,user.role,'Risk Monitoring')&&<button onClick={()=>navigate('risk')}>Review signals →</button>}
        {hasAction(user.permissions,user.role,'Export Reports')&&<button disabled={loading||!!error} onClick={onExport}>Export Report</button>}
      </div><p>Reporting barangay is assigned to the clinic, not the patient’s home barangay. * Partial weeks include selected dates only. Change compares equal-length periods; “New” means the previous count was zero. Comparisons are unavailable when data is withheld.</p><p>{data.privacy?.notice}</p>{data.period&&<p>Reporting period: {data.period.start} – {data.period.end} (Asia/Manila). Previous period: {data.period.previous_start} – {data.period.previous_end}.</p>}</section>}
    </div>
    {selected&&<SummaryModal row={selected} onClose={()=>setSelected(null)} onExplore={()=>{apply(rowFilters(selected));setSelected(null);}} onSignals={canViewFeature(user.permissions,user.role,'Risk Monitoring')?()=>navigate('risk',rowFilters(selected)):null}/>}
  </div>;
}

function SummaryModal({row,onClose,onExplore,onSignals}) {
  const ref=useRef(null);
  useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>previous?.focus();},[]);
  return <dialog ref={ref} className="dm-dialog" onCancel={event=>{event.preventDefault();onClose();}}><header><h2>Case Summary</h2><button aria-label="Close summary" onClick={onClose}>×</button></header><dl className="dm-details">{[['Disease',row.disease],['Participating Clinic',row.clinic_name],['Reporting Barangay',row.area],['Released Cases',row.cases??'Withheld'],['Previous Period',row.previous_cases??'Withheld'],['Change',change(row)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>Shared summaries contain no patient or owner identities.{row.has_withheld?' Protected groups are withheld; changes cannot be calculated.':''}</p><footer><button onClick={onExplore}>Explore this group</button>{onSignals&&<button className="dm-primary" onClick={onSignals}>Review related signals</button>}</footer></dialog>;
}
