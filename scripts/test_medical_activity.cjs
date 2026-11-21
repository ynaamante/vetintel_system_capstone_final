const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../petwatch-rn/node_modules/typescript');
const source=fs.readFileSync(path.join(__dirname,'../petwatch-rn/src/utils/medicalActivity.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};new Function('exports','module',compiled)(mod.exports,mod);
const {medicalActivity,filterMedicalActivity,escapeReportHtml}=mod.exports;
const records=medicalActivity([
  {petId:7,createdAt:'2026-11-17',clinicName:'Clinic A',records:[{id:'vaccine:2',type:'vaccine',category:'Vaccine',title:'Rabies',clinicVerified:true,date:'2026-11-10'}]},
  {petId:7,createdAt:'2026-11-16',clinicName:'Clinic A',records:[{id:'vaccine:2',type:'vaccine',category:'Vaccine',title:'Older duplicate'},{id:'visit:1',type:'visit',category:'Visit',title:'Follow-up',detail:'Visit · completed',date:'2026-11-15'},{id:'update:1',category:'Diagnosis',title:'Clinical assessment',detail:'Shared assessment'}]},
  {petId:99,createdAt:'2026-11-18',records:[{id:'visit:99',title:'Different pet'}]},
],'7');
assert.equal(records.length,3,'Repeated shares are deduplicated and different pets excluded.');
assert.equal(records.find(r=>r.key==='vaccine:2').title,'Rabies');
assert.equal(records.find(r=>r.key==='vaccine:2').status,'Verified');
assert.equal(records.find(r=>r.key==='visit:1').status,'Completed');
assert.equal(records.find(r=>r.key==='update:1').status,'Shared','Do not invent a clinical status.');
assert.equal(filterMedicalActivity(records,'Vaccinations','rabies').length,1);
assert.equal(filterMedicalActivity(records,'Visits','Clinic A').length,1);
assert.equal(filterMedicalActivity(records,'Tests & Results','').length,0);
assert.equal(filterMedicalActivity(records,'All','missing').length,0);
assert.equal(escapeReportHtml('<script>"test" & private</script>'),'&lt;script&gt;&quot;test&quot; &amp; private&lt;/script&gt;');
console.log('PASS: pet-scoped shared records, deduplication, category/search filters, factual statuses, and escaped PDF content.');
