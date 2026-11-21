import assert from 'node:assert/strict';
import {buildSurveillanceReport,reportRows} from '../admin/src/utils/surveillanceReports.js';
import {createSurveillanceFile} from '../admin/src/utils/surveillanceReportExport.js';

const scope={days:'30',disease:'',clinic_id:'',area:'',search:''};
const data={
  generated_at:'2026-11-15T04:00:00Z',period:{start:'2026-10-17',end:'2026-11-15',previous_start:'2026-09-17',previous_end:'2026-10-16',days:30},
  total_cases:7,active_clinics:3,affected_clinics:1,date_basis:'Diagnosis episode date (first recorded)',privacy:{notice:'Small foreign groups are withheld; withheld values are not zero.'},
  disease_options:[{disease_key:'a',disease:'Disease A'},{disease_key:'b',disease:'Disease B'}],clinic_options:[{id:1,name:'Clinic One'},{id:2,name:'Clinic Two'},{id:3,name:'Clinic Three'}],
  diseases:[{disease_key:'a',disease:'Disease A',cases:5},{disease_key:'b',disease:'Disease B',cases:2}],
  trend:[{case_date:'2026-10-17',period_end:'2026-10-18',cases:2,partial:true},{case_date:'2026-10-19',period_end:'2026-10-25',cases:null,suppressed:true},{case_date:'2026-10-26',period_end:'2026-11-01',cases:5}],
  case_summaries:[{disease:'Disease A',clinic_name:'Clinic One',area:'Area A',cases:5,previous_cases:null,has_withheld:true},{disease:'Disease B',clinic_name:'Clinic One',area:'Area A',cases:2,previous_cases:0,has_withheld:false}],
  clinic_participation:[{clinic_name:'Clinic One',area:'Area A',cases:7,diseases_reported:2,has_withheld:false},{clinic_name:'Clinic Two',area:'Area B',cases:0,diseases_reported:0,has_withheld:false},{clinic_name:'Clinic Three',area:'Area C',cases:null,diseases_reported:null,has_withheld:true}],
  alerts:['new','under_review','resolved'].map((status,index)=>({id:index+1,disease:'Disease A',area:'Area A',period_start:'2026-11-09',period_end:'2026-11-15',observed_cases:5,baseline_cases:index===0?null:2,alert_type:index===0?'Threshold Exceeded':'Threshold and Growth Increase',rule_description:'Configured weekly rule, not an automatic outbreak declaration.',status})),
};
const captured=buildSurveillanceReport(data,scope,'disease');
assert.equal(captured.summary[0][1],7);
assert.equal(captured.trend.length,3,'Every weekly interval must remain in the preview/export model');
assert.equal(captured.trend[1].cases,null,'Withheld values must remain gaps, not zero');
assert.equal(captured.sections[0].rows.length,2,'All reported diseases belong in the file');
assert.equal(captured.sections[1].rows[1][2],'Withheld');
const resolved=buildSurveillanceReport(data,scope,'signals','resolved');
assert.equal(resolved.summary.find(([name])=>name==='Signals Included')[1],1);
assert.equal(resolved.sections[0].rows.length,1);
assert.equal(resolved.sections[0].rows[0].at(-1),'Resolved');
assert.equal(buildSurveillanceReport(data,scope,'disease','resolved').summary[0][1],7,'Signal status must not change case reports');
const clinics=buildSurveillanceReport(data,scope,'clinics');
assert.equal(clinics.sections[0].rows[1][2],0,'Connected clinics with zero released cases must be included');
assert.equal(clinics.sections[0].rows[2][2],'Withheld','Wholly protected clinic totals must not become zero');
assert.match(clinics.notice,/does not establish/);
assert.throws(()=>buildSurveillanceReport({...data,total_cases:99},scope,'disease'),/do not reconcile/);
assert.throws(()=>buildSurveillanceReport({...data,clinic_participation:undefined},scope,'disease'),/service needs an update/);
const generatedAt='2026-11-15T04:30:00Z';
data.total_cases=999;data.trend[0].cases=999;data.case_summaries[0].cases=999;
const csv=await(await createSurveillanceFile(captured,'CSV',generatedAt)).text();
assert.match(csv,/"Total Confirmed Cases","7"/);
assert.ok(!csv.includes('999'),'Export must retain the captured preview when source data later changes');
assert.match(csv,/"Withheld"/);assert.match(csv,/2026-10-17/);assert.match(csv,/2026-11-15/);
assert.match(csv,/Date basis/);assert.match(csv,/Asia\/Manila/);
assert.equal(reportRows(captured,generatedAt).filter(row=>row[0]==='Case Summaries').length,1);
for(const report of [captured,resolved,clinics]){
  const pdf=await createSurveillanceFile(report,'PDF',generatedAt),bytes=Buffer.from(await pdf.arrayBuffer());
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  assert.ok(bytes.toString('latin1').includes(report.title),'PDF contains the same report type as the preview');
  assert.ok(bytes.toString('latin1').includes('Withheld')||report===resolved);
}
console.log('PASS: preview/export snapshot stability, exact dates, complete weekly intervals, status-specific reports, zero versus withheld clinic counts, reconciling totals, CSV content and three PDF report types.');
