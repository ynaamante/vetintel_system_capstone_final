import { useState } from 'react';
import Topbar from './Topbar';
import FilterSelect from './FilterSelect';
import { Icons } from '../icons';
import { hasAction, roleProfile } from '../utils/permissionUtils';
import { signalStatus, signalTrigger, signalWeek } from '../utils/diseaseSignals';
import './riskSignalExplorer.css';
import './monitoringSummary.css';

export default function RiskSignalExplorer({user,data,loading,error,filters,status,search,onSearch,onApply,onSelect,onRetry,onRules}) {
  const [limit,setLimit]=useState(10);
  const all=data.alerts||[];
  const rows=all.filter(row=>!status||row.status===status);
  const stats=[['Open Signals',all.filter(row=>row.status!=='resolved').length,'Potential signals requiring review.'],['Needs Review',all.filter(row=>row.status==='new').length,'New signals for veterinarian review.'],['Under Review',all.filter(row=>row.status==='under_review').length,'Currently being evaluated.']];
  const currentFilters = { ...filters, status };
  const changeFilter = (key, value) => {
    if (String(currentFilters[key]) === String(value)) return;
    setLimit(10);
    onApply({ ...currentFilters, [key]: value });
  };
  const field=(key,label,options)=><div className="risk-field"><span>{label}</span><FilterSelect className="risk-filter-select" label={label} value={currentFilters[key]} onChange={value=>changeFilter(key,value)} options={options}/></div>;
  return <main className="dm-page risk-page">
    <Topbar className="dm-topbar" user={user} title="Risk Monitoring" subtitle="Review potential disease signals across participating veterinary clinics." actions={<label className="dm-search">{Icons.search}<input aria-label="Search disease signals" placeholder="Search diseases or reporting barangays…" value={search} onChange={event=>onSearch(event.target.value)}/></label>}/>
    <div className="dm-body">
      <div className="risk-filters" role="group" aria-label="Risk monitoring filters">
        {field('disease','Disease',[{value:'',label:'All Diseases'},...(data.disease_options||[]).map(row=>({value:row.disease_key,label:row.disease}))])}
        {field('area','Reporting Barangay',[{value:'',label:'All Barangays'},...[...new Set([...(data.area_options||[]),...(filters.area?[filters.area]:[])])].map(area=>({value:area,label:area}))])}
        {field('status','Status',[{value:'',label:'All Statuses'},...['new','under_review','resolved'].map(value=>({value,label:signalStatus(value)}))])}
        {field('days','Date Range',[30,60,90].map(days=>({value:String(days),label:`Last ${days} Days`})))}
      </div>
      {filters.clinic_id&&<p className="risk-scope">Clinic scope carried over from monitoring: {(data.clinic_options||[]).find(row=>String(row.id)===String(filters.clinic_id))?.name||`Clinic #${filters.clinic_id}`} <button type="button" onClick={()=>changeFilter('clinic_id','')}>Show all participating clinics</button></p>}
      {error&&<p className="dm-error" role="alert">{error} <button onClick={onRetry}>Retry</button></p>}
      <div className="risk-metrics monitoring-summary" aria-busy={loading}>{stats.map(([title,count,description])=><article key={title}><h2>{title}</h2><strong>{loading||error?'—':count}</strong><p>{description}</p></article>)}</div>
      <p className="risk-scope">Open Signals = Needs Review + Under Review. Status filters the list only.</p>
      {loading&&<p role="status" className="risk-scope">Loading potential disease signals…</p>}
      <section className="dm-panel risk-signals"><header><div><h2>Potential Disease Signals</h2><p>Potential signals based on weekly confirmed case reports and configured detection rules.</p></div>{roleProfile(user.role)==='owner'&&hasAction(user.permissions,user.role,'Configure Alert Rules')&&<button type="button" className="risk-rules-action" disabled={loading} onClick={onRules}>Alert Rules</button>}</header>
        <div className="dm-scroll"><table><thead><tr><th>Disease</th><th>Reporting Barangay</th><th>Signal Week</th><th>Cases<small>Signal week vs. previous calendar week</small></th><th>Trigger</th><th>Status</th><th><span className="dm-sr">Details</span></th></tr></thead><tbody>{rows.slice(0,limit).map(row=><tr key={row.id} tabIndex={0} onClick={()=>onSelect(row)} onKeyDown={event=>{if(event.target===event.currentTarget&&['Enter',' '].includes(event.key)){event.preventDefault();onSelect(row);}}}><td><strong>{row.disease}</strong></td><td>{row.area}</td><td>{signalWeek(row)}</td><td><strong className="risk-case-count">{row.observed_cases} vs {row.baseline_cases??'Withheld'}</strong></td><td>{signalTrigger(row.alert_type)}</td><td><span className={`risk-status ${row.status}`}><i/>{signalStatus(row.status)}</span></td><td><button type="button" className="dm-chevron" aria-label={`View ${row.disease} signal details`} onClick={event=>{event.stopPropagation();onSelect(row);}}>{Icons.chevronRight}</button></td></tr>)}{!rows.length&&<tr><td colSpan={7} className="dm-empty">{loading?'Loading signals…':error?'Signals unavailable.':!data.rules?.length?(roleProfile(user.role)==='owner'&&hasAction(user.permissions,user.role,'Configure Alert Rules')?'No detection rules configured. Select Alert Rules to set up detection.':'No detection rules configured. A clinic owner must configure rules before signals can be evaluated.'):'No potential disease signals match the applied filters.'}</td></tr>}</tbody></table></div>
        <div className="risk-table-footer"><span>Showing {Math.min(limit,rows.length)} of {rows.length} signals</span>{limit<rows.length&&<button onClick={()=>setLimit(value=>value+10)}>Show more</button>}</div>
      </section>
      <p className="risk-notice">{Icons.info}<strong>A signal highlights disease activity that needs review. It does not confirm an outbreak.</strong></p>
      {data.period&&<p className="risk-scope">Reporting period: {data.period.start} to {data.period.end} (Asia/Manila)</p>}
    </div>
  </main>;
}
