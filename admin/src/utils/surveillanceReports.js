import { signalStatus, signalTrigger } from './diseaseSignals.js';

export const REPORT_TYPES = [
  {id:'disease',title:'Disease Cases',description:'What diseases were reported, where, and when?'},
  {id:'signals',title:'Disease Signals',description:'Which disease patterns needed review, and what happened?'},
  {id:'clinics',title:'Clinic Reporting',description:'Which clinics have released case data in this period?'},
];
export const reportTime = value => new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
export const reportDay = value => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-PH',{timeZone:'UTC',month:'short',day:'numeric'});
const count = value => value===null||value===undefined?'Withheld':value;
const total = rows => rows.reduce((sum,row)=>sum+(row.cases??0),0);

// One immutable report model drives the preview, PDF and CSV. Generation never
// requests a second set of counts that could differ from the displayed snapshot.
export function buildSurveillanceReport(data,filters,type,status='') {
  const config=REPORT_TYPES.find(item=>item.id===type);
  if(!config||!data.period||!Array.isArray(data.case_summaries)||!Array.isArray(data.clinic_participation))throw new Error('The reporting service needs an update. Restart the backend and refresh the preview.');
  if(total(data.trend)!==data.total_cases||total(data.case_summaries)!==data.total_cases)throw new Error('Report counts do not reconcile. Refresh the preview before generating a file.');
  const diseases=(data.diseases||[]).filter(row=>row.cases>0).sort((a,b)=>b.cases-a.cases);
  const signals=(data.alerts||[]).filter(row=>!status||row.status===status);
  const diseaseLabel=(data.disease_options||[]).find(row=>row.disease_key===filters.disease||row.disease===filters.disease)?.disease||filters.disease||'All Diseases';
  const clinicLabel=(data.clinic_options||[]).find(row=>String(row.id)===String(filters.clinic_id))?.name|| (filters.clinic_id?`Clinic #${filters.clinic_id}`:'All Participating Clinics');
  const scope={disease:diseaseLabel,clinic:clinicLabel,area:filters.area||'All Reporting Barangays',search:filters.search||'None',status:type==='signals'?(status?signalStatus(status):'All Statuses'):'Not applicable'};
  const trend=data.trend.map(row=>({...row,label:`${reportDay(row.case_date)}–${reportDay(row.period_end)}${row.partial?'*':''}`}));
  let summary,sections;
  if(type==='disease') {
    summary=[['Total Confirmed Cases',data.total_cases],['Diseases Reported',diseases.length],['Clinics Reporting Cases',data.affected_clinics],['Participating Clinics',data.active_clinics]];
    sections=[
      {title:'Cases by Disease',columns:['Disease','Released Cases'],rows:diseases.map(row=>[row.disease,row.cases])},
      {title:'Confirmed Cases Over Time',columns:['Week Start','Week End','Released Cases','Coverage'],rows:trend.map(row=>[row.case_date,row.period_end,count(row.cases),row.suppressed?'Some groups withheld':row.partial?'Partial week':'Full week'])},
      {title:'Case Summaries',columns:['Disease','Participating Clinic','Reporting Barangay','Cases','Previous Period','Data Coverage'],rows:data.case_summaries.map(row=>[row.disease,row.clinic_name,row.area,count(row.cases),count(row.previous_cases),row.has_withheld?'Partial / withheld':'Released'])},
    ];
  } else if(type==='signals') {
    summary=[['Signals Included',signals.length],['Open Signals',signals.filter(row=>row.status!=='resolved').length],['Needs Review',signals.filter(row=>row.status==='new').length],['Under Review',signals.filter(row=>row.status==='under_review').length],['Resolved',signals.filter(row=>row.status==='resolved').length]];
    sections=[
      {title:'Potential Disease Signals',columns:['Disease','Reporting Barangay','Signal Week','Cases','Previous Calendar Week','Trigger','Status'],rows:signals.map(row=>[row.disease,row.area,`${row.period_start} to ${row.period_end}`,row.observed_cases,count(row.baseline_cases),signalTrigger(row.alert_type),signalStatus(row.status)])},
      {title:'Signal Rules and Reviewers',columns:['Disease','Reporting Barangay','Signal Week','Triggering Rule','Assigned Reviewer'],rows:signals.map(row=>[row.disease,row.area,`${row.period_start} to ${row.period_end}`,row.rule_description,row.reviewed_by_name|| (row.reviewed_by?`Staff #${row.reviewed_by}`:'Unassigned')])},
    ];
  } else {
    const clinics=data.clinic_participation;
    if(total(clinics)!==data.total_cases)throw new Error('Clinic totals do not reconcile. Refresh the preview before generating a file.');
    summary=[['Clinics Included',clinics.length],['Clinics Reporting Cases',clinics.filter(row=>row.cases>0).length],['Total Confirmed Cases',data.total_cases],['Diseases Reported',diseases.length]];
    sections=[{title:'Clinic Reporting',columns:['Participating Clinic','Reporting Barangay','Released Cases','Diseases Reported','Data Coverage'],rows:clinics.map(row=>[row.clinic_name,row.area,count(row.cases),count(row.diseases_reported),row.has_withheld?'Partial / withheld':row.cases>0?'Released cases':'No released cases under these filters'])}];
  }
  return {type,title:config.title,scope,period:{...data.period},snapshotAt:data.generated_at||data.checked_at,dateBasis:data.date_basis,privacy:data.privacy?.notice||'Shared counts follow privacy safeguards.',summary,sections,trend:type==='disease'?trend:[],notice:type==='signals'?'The date range selects reporting weeks overlapping the selected period. Counts compare the signal week with the previous calendar week. Signals require verification and do not confirm an outbreak.':type==='clinics'?'Zero released cases does not establish that a clinic submitted no reports. Counts reflect finalized, confirmed cases available under the applied privacy rules.':'Counts reflect finalized, confirmed cases available under the applied privacy rules. * Partial weeks include selected dates only; withheld values are not zero.'};
}

export function reportRows(report,generatedAt) {
  return [
    [report.title],['Generated (Asia/Manila)',reportTime(generatedAt)],['Data snapshot (Asia/Manila)',reportTime(report.snapshotAt)],
    ['Exact reporting dates',report.period.start,report.period.end],report.type==='signals'?['Comparison basis','Each signal week versus its previous calendar week']:['Previous comparison period',report.period.previous_start,report.period.previous_end],
    ['Disease',report.scope.disease],['Participating clinic',report.scope.clinic],['Reporting barangay',report.scope.area],['Search',report.scope.search],['Status',report.scope.status],
    ['Date basis',report.dateBasis],['Privacy',report.privacy],['Notes',report.notice],[],['Summary'],...report.summary,
    ...report.sections.flatMap(section=>[[],[section.title],section.columns,...(section.rows.length?section.rows:[['No matching data for these filters.']])]),
  ];
}
